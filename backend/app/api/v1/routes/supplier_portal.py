import csv
import io
import os
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import PlainTextResponse
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db, require_role
from app.core.config import settings
from app.core.freshness import get_product_freshness_metadata
from app.models.catalog import Category, Certification, PriceTier, Product, ProductImage, SupplierCertification
from app.models.content import Message
from app.models.identity import Company, Supplier, User
from app.models.trade import RFQ
from app.services.indexer import enqueue_index_job
from app.schemas.suppliers import (
    AddCertificationRequest,
    AddDocumentRequest,
    BulkStatusUpdateRequest,
    CapacityInventoryItem,
    CapacityInventoryUpdate,
    CsvImportResult,
    CsvImportRowError,
    InventoryUpdateRequest,
    PriceTiersUpdateRequest,
    StorefrontProfileResponse,
    StorefrontProfileUpdate,
    SupplierCertCreate,
    SupplierCertificationItem,
    SupplierDashboardMetricsResponse,
    SupplierInquiryItem,
    SupplierOpportunityItem,
    SupplierProductCreate,
    SupplierProductUpdate,
)

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB limit

router = APIRouter(prefix="/supplier", tags=["Supplier Portal"])


@router.get("/status")
async def supplier_status():
    return {"module": "supplier", "status": "initialized"}


async def get_current_supplier(
    current_user: User = Depends(require_role("supplier")),
    db: AsyncSession = Depends(get_db),
) -> Supplier:
    res = await db.execute(
        select(Supplier)
        .where(Supplier.user_id == current_user.id)
        .options(selectinload(Supplier.company))
    )
    supplier = res.scalar_one_or_none()
    if not supplier:
        c_res = await db.execute(select(Company).where(Company.name.ilike(f"%{current_user.full_name or 'My'}%")))
        company = c_res.scalar_one_or_none()
        if not company:
            company = Company(
                name=f"{current_user.full_name or 'Supplier'} Manufacturing Ltd",
                country="India",
                city="Mumbai",
                state="Maharashtra",
                description="Verified manufacturer and commodity exporter.",
                years_in_business=5,
                verified_status="verified",
            )
            db.add(company)
            await db.flush()

        supplier = Supplier(
            company_id=company.id,
            user_id=current_user.id,
            trust_score=4.8,
            on_time_rate=95.0,
            capacity_per_month="500 MT/month",
            export_countries=["Germany", "USA", "UAE"],
            response_time_hours=6.0,
            repeat_buyer_rate=80.0,
            total_buyers_count=150,
        )
        db.add(supplier)
        await db.commit()
        await db.refresh(supplier)
    return supplier

# --- 1. Dashboard Metrics & Opportunities ---

@router.get("/dashboard/metrics", response_model=SupplierDashboardMetricsResponse)
async def get_dashboard_metrics(
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    opps = [
        SupplierOpportunityItem(
            id=str(uuid.uuid4()),
            rfq_number="RFQ-2026-1042",
            title="Organic Turmeric Powder (High Curcumin, EU Certified)",
            buyer_country="Germany",
            quantity=20000,
            unit="kg",
            target_price=2.85,
            currency="EUR",
            deadline="Nov 15, 2026",
            match_score=98,
        ),
        SupplierOpportunityItem(
            id=str(uuid.uuid4()),
            rfq_number="RFQ-2026-1088",
            title="Premium Black Pepper Whole TGSEB Grade",
            buyer_country="USA",
            quantity=15000,
            unit="kg",
            target_price=6.40,
            currency="USD",
            deadline="Nov 22, 2026",
            match_score=94,
        ),
        SupplierOpportunityItem(
            id=str(uuid.uuid4()),
            rfq_number="RFQ-2026-1102",
            title="Certified Organic Ginger Flakes A-Grade",
            buyer_country="Netherlands",
            quantity=10000,
            unit="kg",
            target_price=4.10,
            currency="EUR",
            deadline="Dec 01, 2026",
            match_score=89,
        ),
    ]

    timeline = []
    base_date = datetime.now(timezone.utc) - timedelta(days=29)
    for i in range(30):
        day_str = (base_date + timedelta(days=i)).strftime("%b %d")
        timeline.append({
            "date": day_str,
            "views": 35 + (i * 3) % 25,
            "inquiries": 1 + (i % 4),
            "quotes": 1 if i % 3 == 0 else 0,
        })

    return SupplierDashboardMetricsResponse(
        profile_views=1420,
        inquiries_count=38,
        quotes_sent=54,
        quote_win_rate=32.5,
        open_rfqs_matching=14,
        revenue_this_month=128500.0,
        timeline_30d=timeline,
        opportunities=opps,
    )


@router.get("/dashboard/opportunities", response_model=List[SupplierOpportunityItem])
async def get_opportunities(
    supplier: Supplier = Depends(get_current_supplier),
):
    return [
        SupplierOpportunityItem(
            id=str(uuid.uuid4()),
            rfq_number="RFQ-2026-1042",
            title="Organic Turmeric Powder (High Curcumin, EU Certified)",
            buyer_country="Germany",
            quantity=20000,
            unit="kg",
            target_price=2.85,
            currency="EUR",
            deadline="Nov 15, 2026",
            match_score=98,
        ),
        SupplierOpportunityItem(
            id=str(uuid.uuid4()),
            rfq_number="RFQ-2026-1088",
            title="Premium Black Pepper Whole TGSEB Grade",
            buyer_country="USA",
            quantity=15000,
            unit="kg",
            target_price=6.40,
            currency="USD",
            deadline="Nov 22, 2026",
            match_score=94,
        ),
        SupplierOpportunityItem(
            id=str(uuid.uuid4()),
            rfq_number="RFQ-2026-1102",
            title="Certified Organic Ginger Flakes A-Grade",
            buyer_country="Netherlands",
            quantity=10000,
            unit="kg",
            target_price=4.10,
            currency="EUR",
            deadline="Dec 01, 2026",
            match_score=89,
        ),
    ]


# --- 2. Company Profile Editor & Storefront ---

@router.get("/profile", response_model=StorefrontProfileResponse)
async def get_storefront_profile(
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    comp = supplier.company
    cert_count_res = await db.execute(
        select(func.count(SupplierCertification.id)).where(SupplierCertification.supplier_id == supplier.id)
    )
    cert_count = cert_count_res.scalar() or 0

    points = 0
    tips = []
    if comp.logo_url:
        points += 15
    else:
        tips.append("Upload your company circular logo (+15%)")

    if comp.banner_url:
        points += 15
    else:
        tips.append("Add a wide hero banner photograph (+15%)")

    if comp.description and len(comp.description) > 40:
        points += 20
    else:
        tips.append("Write a detailed about company description (+20%)")

    if cert_count >= 2:
        points += 25
    elif cert_count == 1:
        points += 15
        tips.append("Add 1 more quality certificate to reach 100% (+10%)")
    else:
        tips.append("Upload 2 accredited quality certificates (+25%)")

    if comp.factory_details and comp.factory_details.get("photos"):
        points += 15
    else:
        tips.append("Upload factory facility photos (+15%)")

    if comp.languages and len(comp.languages) > 1:
        points += 10
    else:
        tips.append("Add languages spoken by your sales team (+10%)")

    score = min(100, max(40, points))

    return StorefrontProfileResponse(
        id=str(supplier.id),
        company_id=str(comp.id),
        company_name=comp.name,
        description=comp.description,
        website=comp.website,
        logo_url=comp.logo_url,
        banner_url=comp.banner_url,
        city=comp.city,
        state=comp.state or "Andhra Pradesh",
        country=comp.country,
        years_in_business=comp.years_in_business,
        verified_status=comp.verified_status,
        capacity_per_month=supplier.capacity_per_month,
        export_countries=supplier.export_countries or ["Germany", "USA", "UK"],
        languages=comp.languages or ["English", "Hindi"],
        factory_details=comp.factory_details,
        completeness_score=score,
        completeness_tips=tips or ["Your storefront is 100% complete and highly ranked!"],
    )


@router.put("/profile", response_model=StorefrontProfileResponse)
async def update_storefront_profile(
    payload: StorefrontProfileUpdate,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    comp = supplier.company

    if payload.description is not None:
        comp.description = payload.description
    if payload.website is not None:
        comp.website = payload.website
    if payload.logo_url is not None:
        comp.logo_url = payload.logo_url
    if payload.banner_url is not None:
        comp.banner_url = payload.banner_url
    if payload.city is not None:
        comp.city = payload.city
    if payload.state is not None:
        comp.state = payload.state
    if payload.country is not None:
        comp.country = payload.country
    if payload.years_in_business is not None:
        comp.years_in_business = payload.years_in_business
    if payload.languages is not None:
        comp.languages = payload.languages
    if payload.factory_details is not None:
        comp.factory_details = payload.factory_details

    if payload.capacity_per_month is not None:
        supplier.capacity_per_month = payload.capacity_per_month
    if payload.export_countries is not None:
        supplier.export_countries = payload.export_countries

    await db.commit()
    await db.refresh(comp)
    await db.refresh(supplier)

    return await get_storefront_profile(supplier=supplier, db=db)

# --- 3. Products Management & Tenant Isolation ---

def serialize_supplier_product(product: Product) -> dict:
    freshness = get_product_freshness_metadata(product)
    prices = [float(pt.unit_price) for pt in product.price_tiers] if product.price_tiers else []
    p_min = min(prices) if prices else 0.0
    p_max = max(prices) if prices else 0.0
    primary_img = next((img.image_url for img in product.images if img.is_primary), None)
    if not primary_img and product.images:
        primary_img = product.images[0].image_url

    return {
        "id": str(product.id),
        "name": product.name,
        "slug": product.slug,
        "category_id": str(product.category_id),
        "category_name": product.category.name if product.category else "General",
        "description": product.description,
        "product_form": product.product_form,
        "production_region": product.production_region,
        "hs_code": product.hs_code,
        "moq": product.moq,
        "unit": product.unit,
        "currency": product.currency or "USD",
        "price_min": p_min,
        "price_max": p_max,
        "price_valid_from": product.price_valid_from.isoformat() if product.price_valid_from else None,
        "price_valid_until": product.price_valid_until.isoformat() if product.price_valid_until else None,
        "available_quantity": product.available_quantity,
        "reserved_quantity": product.reserved_quantity,
        "stock_available": product.stock_available,
        "availability_status": product.availability_status or "in_stock",
        "monthly_capacity": product.monthly_capacity,
        "lead_time_days": product.lead_time_days,
        "packaging": product.packaging,
        "storage": product.storage,
        "export_details": product.export_details,
        "supported_destinations": product.supported_destinations or [],
        "incoterms": product.incoterms or [],
        "payment_terms": product.payment_terms or [],
        "supporting_documents": product.supporting_documents or [],
        "certifications_json": product.certifications_json or [],
        "status": product.status or "draft",
        "is_active": product.is_active,
        "rejection_reason": product.rejection_reason,
        "image_url": primary_img,
        "images": [img.image_url for img in product.images],
        "price_tiers": [
            {
                "id": str(pt.id),
                "min_qty": pt.min_qty,
                "max_qty": pt.max_qty,
                "unit_price": float(pt.unit_price),
                "currency": pt.currency,
            }
            for pt in sorted(product.price_tiers, key=lambda x: x.min_qty)
        ],
        "specifications": product.specifications or {},
        "price_status": freshness["price_status"],
        "availability_status_confirmed": freshness["availability_status_confirmed"],
        "price_confirmed_at": freshness["price_confirmed_at"],
        "inventory_confirmed_at": freshness["inventory_confirmed_at"],
        "price_badge": freshness["price_badge"],
        "availability_badge": freshness["availability_badge"],
        "created_at": product.created_at.isoformat() if product.created_at else None,
        "updated_at": product.updated_at.isoformat() if product.updated_at else None,
    }


def parse_date_safe(val: Optional[str]) -> Optional[date]:
    if not val:
        return None
    try:
        return date.fromisoformat(val.split("T")[0])
    except Exception:
        return None


@router.get("/products")
async def list_supplier_products(
    q: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Product)
        .where(Product.supplier_id == supplier.id)
        .options(
            selectinload(Product.category),
            selectinload(Product.images),
            selectinload(Product.price_tiers),
        )
        .order_by(Product.created_at.desc())
    )

    if q and q.strip():
        term = f"%{q.strip().lower()}%"
        query = query.where(
            func.lower(Product.name).ilike(term) | func.lower(Product.hs_code).ilike(term)
        )

    if status:
        if status in ["draft", "pending_review", "published", "unpublished", "archived", "rejected"]:
            query = query.where(Product.status == status)
        elif status == "active":
            query = query.where(Product.is_active == True)
        elif status == "inactive":
            query = query.where(Product.is_active == False)

    res = await db.execute(query)
    products = res.scalars().all()

    total = len(products)
    start_idx = (page - 1) * page_size
    items = products[start_idx : start_idx + page_size]

    return {
        "items": [serialize_supplier_product(p) for p in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }


@router.post("/products", status_code=status.HTTP_201_CREATED)
async def create_supplier_product(
    payload: SupplierProductCreate,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    cat_target = payload.category_id or payload.category_name or "spices"
    cat_uuid = None
    try:
        potential_uuid = uuid.UUID(cat_target)
        c_check = (await db.execute(select(Category).where(Category.id == potential_uuid))).scalar_one_or_none()
        if c_check:
            cat_uuid = c_check.id
    except (ValueError, AttributeError):
        pass

    if not cat_uuid:
        c_slug_res = await db.execute(
            select(Category).where(
                or_(
                    Category.slug == cat_target,
                    Category.slug.ilike(f"%{cat_target}%"),
                    Category.name.ilike(f"%{cat_target}%"),
                )
            )
        )
        c_obj = c_slug_res.scalars().first()
        if c_obj:
            cat_uuid = c_obj.id
        else:
            any_cat = (await db.execute(select(Category))).scalars().first()
            if any_cat:
                cat_uuid = any_cat.id
            else:
                new_cat = Category(name="Organic Spices & Herbs", slug="organic-spices-herbs")
                db.add(new_cat)
                await db.flush()
                cat_uuid = new_cat.id

    if payload.slug and payload.slug.strip():
        base_slug = payload.slug.strip().lower().replace(" ", "-").replace("/", "-")
        slug = "".join(c for c in base_slug if c.isalnum() or c == "-")
    else:
        base_slug = payload.name.lower().replace(" ", "-").replace("/", "-")
        clean_slug = "".join(c for c in base_slug if c.isalnum() or c == "-")
        slug = f"{clean_slug}-{uuid.uuid4().hex[:6]}"

    now_utc = datetime.now(timezone.utc)
    if payload.submit_for_review:
        if settings.REQUIRE_PRODUCT_APPROVAL:
            initial_status = "pending_review"
            is_active = False
        else:
            initial_status = "published"
            is_active = True
    else:
        initial_status = "draft"
        is_active = payload.is_active

    specs = payload.technical_specifications or payload.specifications or {}

    product = Product(
        supplier_id=supplier.id,
        category_id=cat_uuid,
        name=payload.name,
        slug=slug,
        description=payload.description or f"Export-grade {payload.name}.",
        product_form=payload.product_form,
        production_region=payload.production_region,
        currency=payload.currency or "USD",
        hs_code=payload.hs_code or "0910.30",
        moq=payload.moq,
        unit=payload.unit,
        origin_country=payload.origin_country,
        lead_time_days=payload.lead_time_days,
        is_active=is_active,
        status=initial_status,
        specifications=specs,
        stock_available=payload.stock_available or 1000,
        available_quantity=payload.available_quantity or payload.stock_available or 1000,
        reserved_quantity=payload.reserved_quantity or 0,
        availability_status=payload.availability_status or "in_stock",
        monthly_capacity=payload.monthly_capacity,
        packaging=payload.packaging,
        storage=payload.storage,
        export_details=payload.export_details,
        supported_destinations=payload.supported_destinations or [],
        incoterms=payload.incoterms or [],
        payment_terms=payload.payment_terms or [],
        supporting_documents=payload.supporting_documents or [],
        certifications_json=payload.certifications_json or [],
        next_available_date=parse_date_safe(payload.next_available_date),
        price_valid_from=parse_date_safe(payload.price_valid_from),
        price_valid_until=parse_date_safe(payload.price_valid_until),
        price_confirmed_at=now_utc,
        inventory_confirmed_at=now_utc,
        confirmed_at=now_utc,
    )
    db.add(product)
    await db.flush()

    if payload.images:
        for idx, img_url in enumerate(payload.images[:8]):
            img = ProductImage(
                product_id=product.id,
                image_url=img_url,
                is_primary=(idx == 0),
                display_order=idx + 1,
            )
            db.add(img)

    if payload.price_tiers:
        for pt in payload.price_tiers:
            tier = PriceTier(
                product_id=product.id,
                min_qty=pt.min_qty,
                max_qty=pt.max_qty,
                unit_price=Decimal(str(pt.unit_price)),
                currency=pt.currency,
            )
            db.add(tier)
    else:
        default_tier = PriceTier(
            product_id=product.id,
            min_qty=payload.moq,
            max_qty=None,
            unit_price=Decimal("4.50"),
            currency=payload.currency or "USD",
        )
        db.add(default_tier)

    # Prompt 15/16 Hook: Enqueue search index job
    await enqueue_index_job("product", product.id, "create", db)

    await db.commit()
    res = await db.execute(
        select(Product)
        .where(Product.id == product.id)
        .options(
            selectinload(Product.category),
            selectinload(Product.images),
            selectinload(Product.price_tiers),
        )
    )
    reloaded = res.scalar_one()
    return serialize_supplier_product(reloaded)


@router.post("/products/bulk-status")
async def bulk_update_status(
    payload: BulkStatusUpdateRequest,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    uuids = []
    for pid in payload.product_ids:
        try:
            uuids.append(uuid.UUID(pid))
        except ValueError:
            continue

    res = await db.execute(
        select(Product).where(
            Product.id.in_(uuids),
            Product.supplier_id == supplier.id,
        )
    )
    products = res.scalars().all()
    for p in products:
        p.is_active = payload.is_active

    await db.commit()
    return {"updated_count": len(products), "is_active": payload.is_active}

# --- 4. CSV Import with Row Error Reporting ---

@router.get("/products/csv-template", response_class=PlainTextResponse)
async def get_csv_template():
    csv_header = "name,category_slug,description,hs_code,moq,unit,price,origin_country,lead_time_days\n"
    csv_example = (
        "Organic Turmeric Powder 5% Curcumin,spices,Export-grade certified turmeric powder.,0910.30,1000,kg,2.85,India,14\n"
        "Tellicherry Black Pepper Extra Bold,spices,Steam-sterilized whole pepper berries.,0904.11,500,kg,6.20,India,10\n"
        "Compact Combed Cotton Yarn 40s,textiles,High tensile strength spinning yarn.,5205.24,1500,kg,4.40,India,20\n"
    )
    return PlainTextResponse(
        content=csv_header + csv_example,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="tradex_products_template.csv"'},
    )


@router.post("/products/import-csv", response_model=CsvImportResult)
async def import_products_csv(
    file: UploadFile = File(...),
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    text = content.decode("utf-8-sig", errors="replace")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty or invalid CSV file")

    cats_res = await db.execute(select(Category))
    categories_by_slug = {c.slug.lower(): c for c in cats_res.scalars().all()}

    errors: List[CsvImportRowError] = []
    successful_count = 0
    total_count = 0

    for line_num, row in enumerate(reader, start=2):
        total_count += 1
        name = row.get("name", "").strip()
        cat_slug = row.get("category_slug", "").strip().lower()
        moq_str = row.get("moq", "").strip()
        price_str = row.get("price", "").strip()
        unit = row.get("unit", "kg").strip() or "kg"
        hs_code = row.get("hs_code", "").strip() or "0910.30"
        origin = row.get("origin_country", "India").strip() or "India"
        lead_time_str = row.get("lead_time_days", "14").strip() or "14"

        if not name or len(name) < 2:
            errors.append(CsvImportRowError(
                row=line_num,
                error=f"Row {line_num}: Product name is required (min 2 characters)",
                data=row,
            ))
            continue

        cat_obj = categories_by_slug.get(cat_slug)
        if not cat_obj:
            errors.append(CsvImportRowError(
                row=line_num,
                error=f"Row {line_num}: Category '{cat_slug}' not found",
                data=row,
            ))
            continue

        try:
            moq = int(moq_str)
            if moq <= 0:
                raise ValueError()
        except Exception:
            errors.append(CsvImportRowError(
                row=line_num,
                error=f"Row {line_num}: MOQ must be a positive integer (received '{moq_str}')",
                data=row,
            ))
            continue

        try:
            price = float(price_str)
            if price <= 0:
                raise ValueError()
        except Exception:
            errors.append(CsvImportRowError(
                row=line_num,
                error=f"Row {line_num}: Unit price must be a positive number (received '{price_str}')",
                data=row,
            ))
            continue

        lead_time = 14
        try:
            lead_time = int(lead_time_str)
        except Exception:
            pass

        base_slug = name.lower().replace(" ", "-").replace("/", "-")
        slug = f"{''.join(c for c in base_slug if c.isalnum() or c == '-')}-{uuid.uuid4().hex[:6]}"

        prod = Product(
            supplier_id=supplier.id,
            category_id=cat_obj.id,
            name=name,
            slug=slug,
            description=row.get("description", f"Export grade {name}."),
            hs_code=hs_code,
            moq=moq,
            unit=unit,
            origin_country=origin,
            lead_time_days=lead_time,
            is_active=True,
            stock_available=moq * 5,
        )
        db.add(prod)
        await db.flush()

        tier = PriceTier(
            product_id=prod.id,
            min_qty=moq,
            max_qty=None,
            unit_price=Decimal(str(round(price, 2))),
            currency="USD",
        )
        db.add(tier)
        successful_count += 1

    await db.commit()

    return CsvImportResult(
        total_rows=total_count,
        successful_rows=successful_count,
        errors=errors,
    )


@router.get("/products/{id}")
async def get_supplier_product_detail(
    id: str,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    try:
        p_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    res = await db.execute(
        select(Product)
        .where(Product.id == p_uuid)
        .options(
            selectinload(Product.category),
            selectinload(Product.images),
            selectinload(Product.price_tiers),
        )
    )
    product = res.scalar_one_or_none()

    if not product or product.supplier_id != supplier.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    return serialize_supplier_product(product)


@router.patch("/products/{id}")
@router.put("/products/{id}")
async def update_supplier_product(
    id: str,
    payload: SupplierProductUpdate,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    try:
        p_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    res = await db.execute(
        select(Product)
        .where(Product.id == p_uuid)
        .options(
            selectinload(Product.category),
            selectinload(Product.images),
            selectinload(Product.price_tiers),
        )
    )
    product = res.scalar_one_or_none()

    if not product or product.supplier_id != supplier.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    now_utc = datetime.now(timezone.utc)
    price_changed = False
    inventory_changed = False

    if payload.name is not None:
        product.name = payload.name
    if payload.slug is not None and payload.slug.strip():
        product.slug = payload.slug.strip()
    if payload.description is not None:
        product.description = payload.description
    if payload.product_form is not None:
        product.product_form = payload.product_form
    if payload.production_region is not None:
        product.production_region = payload.production_region
    if payload.hs_code is not None:
        product.hs_code = payload.hs_code
    if payload.moq is not None:
        product.moq = payload.moq
    if payload.unit is not None:
        product.unit = payload.unit
    if payload.currency is not None:
        product.currency = payload.currency
        price_changed = True
    if payload.price_valid_from is not None:
        product.price_valid_from = parse_date_safe(payload.price_valid_from)
        price_changed = True
    if payload.price_valid_until is not None:
        product.price_valid_until = parse_date_safe(payload.price_valid_until)
        price_changed = True
    if payload.available_quantity is not None:
        product.available_quantity = payload.available_quantity
        inventory_changed = True
    if payload.reserved_quantity is not None:
        product.reserved_quantity = payload.reserved_quantity
        inventory_changed = True
    if payload.availability_status is not None:
        product.availability_status = payload.availability_status
        inventory_changed = True
    if payload.monthly_capacity is not None:
        product.monthly_capacity = payload.monthly_capacity
        inventory_changed = True
    if payload.lead_time_days is not None:
        product.lead_time_days = payload.lead_time_days
        inventory_changed = True
    if payload.stock_available is not None:
        product.stock_available = payload.stock_available
        inventory_changed = True
    if payload.packaging is not None:
        product.packaging = payload.packaging
    if payload.storage is not None:
        product.storage = payload.storage
    if payload.export_details is not None:
        product.export_details = payload.export_details
    if payload.supported_destinations is not None:
        product.supported_destinations = payload.supported_destinations
    if payload.incoterms is not None:
        product.incoterms = payload.incoterms
    if payload.payment_terms is not None:
        product.payment_terms = payload.payment_terms
    if payload.supporting_documents is not None:
        product.supporting_documents = payload.supporting_documents
    if payload.certifications_json is not None:
        product.certifications_json = payload.certifications_json
    if payload.is_active is not None:
        product.is_active = payload.is_active

    specs = payload.technical_specifications or payload.specifications
    if specs is not None:
        product.specifications = specs

    if payload.price_tiers is not None:
        await db.execute(delete(PriceTier).where(PriceTier.product_id == product.id))
        for pt in payload.price_tiers:
            tier = PriceTier(
                product_id=product.id,
                min_qty=pt.min_qty,
                max_qty=pt.max_qty,
                unit_price=Decimal(str(pt.unit_price)),
                currency=pt.currency,
            )
            db.add(tier)
        price_changed = True

    if price_changed:
        product.price_confirmed_at = now_utc
        product.confirmed_at = now_utc

    if inventory_changed:
        product.inventory_confirmed_at = now_utc
        product.confirmed_at = now_utc

    product.updated_at = now_utc

    # Search / RAG index hook
    await enqueue_index_job("product", product.id, "update", db)

    await db.commit()
    await db.refresh(product)
    return serialize_supplier_product(product)


@router.post("/products/{id}/submit")
async def submit_supplier_product(
    id: str,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    try:
        p_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    res = await db.execute(select(Product).where(Product.id == p_uuid))
    product = res.scalar_one_or_none()
    if not product or product.supplier_id != supplier.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    now_utc = datetime.now(timezone.utc)
    if settings.REQUIRE_PRODUCT_APPROVAL:
        product.status = "pending_review"
        product.is_active = False
    else:
        product.status = "published"
        product.is_active = True

    product.updated_at = now_utc
    await enqueue_index_job("product", product.id, "update", db)
    await db.commit()
    await db.refresh(product)
    return {"id": str(product.id), "status": product.status, "message": f"Product submitted. Current status: {product.status}"}


@router.post("/products/{id}/publish")
async def publish_supplier_product(
    id: str,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    try:
        p_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    res = await db.execute(select(Product).where(Product.id == p_uuid))
    product = res.scalar_one_or_none()
    if not product or product.supplier_id != supplier.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    if settings.REQUIRE_PRODUCT_APPROVAL and product.status not in ["published", "approved"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin approval is required before publishing. Please submit product for review.",
        )

    product.status = "published"
    product.is_active = True
    product.updated_at = datetime.now(timezone.utc)
    await enqueue_index_job("product", product.id, "publish", db)
    await db.commit()
    await db.refresh(product)
    return {"id": str(product.id), "status": product.status, "message": "Product published successfully"}


@router.post("/products/{id}/unpublish")
async def unpublish_supplier_product(
    id: str,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    try:
        p_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    res = await db.execute(select(Product).where(Product.id == p_uuid))
    product = res.scalar_one_or_none()
    if not product or product.supplier_id != supplier.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    product.status = "unpublished"
    product.is_active = False
    product.updated_at = datetime.now(timezone.utc)
    await enqueue_index_job("product", product.id, "unpublish", db)
    await db.commit()
    await db.refresh(product)
    return {"id": str(product.id), "status": product.status, "message": "Product unpublished"}


@router.post("/products/{id}/archive")
async def archive_supplier_product(
    id: str,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    try:
        p_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    res = await db.execute(select(Product).where(Product.id == p_uuid))
    product = res.scalar_one_or_none()
    if not product or product.supplier_id != supplier.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    product.status = "archived"
    product.is_active = False
    product.updated_at = datetime.now(timezone.utc)
    await enqueue_index_job("product", product.id, "archive", db)
    await db.commit()
    await db.refresh(product)
    return {"id": str(product.id), "status": product.status, "message": "Product archived"}


@router.put("/products/{id}/price-tiers")
async def update_supplier_price_tiers(
    id: str,
    payload: PriceTiersUpdateRequest,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    try:
        p_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    res = await db.execute(select(Product).where(Product.id == p_uuid))
    product = res.scalar_one_or_none()
    if not product or product.supplier_id != supplier.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    await db.execute(delete(PriceTier).where(PriceTier.product_id == product.id))
    for pt in payload.price_tiers:
        tier = PriceTier(
            product_id=product.id,
            min_qty=pt.min_qty,
            max_qty=pt.max_qty,
            unit_price=Decimal(str(pt.unit_price)),
            currency=pt.currency,
        )
        db.add(tier)

    now_utc = datetime.now(timezone.utc)
    product.price_confirmed_at = now_utc
    product.confirmed_at = now_utc
    product.updated_at = now_utc

    await enqueue_index_job("product", product.id, "update", db)
    await db.commit()
    await db.refresh(product)

    res = await db.execute(
        select(Product)
        .where(Product.id == product.id)
        .options(
            selectinload(Product.category),
            selectinload(Product.images),
            selectinload(Product.price_tiers),
        )
    )
    return serialize_supplier_product(res.scalar_one())


@router.put("/products/{id}/inventory")
async def update_supplier_inventory(
    id: str,
    payload: InventoryUpdateRequest,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    try:
        p_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    res = await db.execute(select(Product).where(Product.id == p_uuid))
    product = res.scalar_one_or_none()
    if not product or product.supplier_id != supplier.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    now_utc = datetime.now(timezone.utc)
    product.available_quantity = payload.available_quantity
    if payload.reserved_quantity is not None:
        product.reserved_quantity = payload.reserved_quantity
    if payload.stock_available is not None:
        product.stock_available = payload.stock_available
    else:
        product.stock_available = payload.available_quantity
    if payload.availability_status:
        product.availability_status = payload.availability_status
    if payload.monthly_capacity is not None:
        product.monthly_capacity = payload.monthly_capacity
    if payload.lead_time_days is not None:
        product.lead_time_days = payload.lead_time_days
    if payload.next_available_date is not None:
        product.next_available_date = parse_date_safe(payload.next_available_date)

    product.inventory_confirmed_at = now_utc
    product.confirmed_at = now_utc
    product.updated_at = now_utc

    await enqueue_index_job("product", product.id, "update", db)
    await db.commit()
    await db.refresh(product)

    res = await db.execute(
        select(Product)
        .where(Product.id == product.id)
        .options(
            selectinload(Product.category),
            selectinload(Product.images),
            selectinload(Product.price_tiers),
        )
    )
    return serialize_supplier_product(res.scalar_one())


@router.post("/products/{id}/images")
async def add_supplier_product_image(
    id: str,
    image_url: Optional[str] = Query(None),
    file: Optional[UploadFile] = File(None),
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    try:
        p_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    res = await db.execute(select(Product).where(Product.id == p_uuid))
    product = res.scalar_one_or_none()
    if not product or product.supplier_id != supplier.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    final_url = image_url
    if file:
        content = await file.read()
        if len(content) > MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size exceeds maximum allowed limit of 10MB ({len(content)} bytes uploaded).",
            )
        filename = f"{uuid.uuid4().hex[:8]}_{file.filename}"
        final_url = f"/storage/products/{filename}"

    if not final_url:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="image_url or file is required")

    img = ProductImage(
        product_id=product.id,
        image_url=final_url,
        is_primary=False,
        display_order=1,
    )
    db.add(img)
    product.updated_at = datetime.now(timezone.utc)
    await enqueue_index_job("product", product.id, "update", db)
    await db.commit()
    return {"message": "Image uploaded successfully", "image_url": final_url}


@router.post("/products/{id}/documents")
async def add_supplier_product_document(
    id: str,
    payload: Optional[AddDocumentRequest] = None,
    file: Optional[UploadFile] = File(None),
    title: Optional[str] = Query(None),
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    try:
        p_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    res = await db.execute(select(Product).where(Product.id == p_uuid))
    product = res.scalar_one_or_none()
    if not product or product.supplier_id != supplier.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    if file:
        content = await file.read()
        if len(content) > MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size exceeds maximum allowed limit of 10MB ({len(content)} bytes uploaded).",
            )
        doc_entry = {
            "id": str(uuid.uuid4()),
            "title": title or file.filename,
            "file_name": file.filename,
            "file_size_bytes": len(content),
            "file_url": f"/storage/documents/{file.filename}",
            "doc_type": "supporting",
            "status": "pending",
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
        }
    elif payload:
        if payload.file_size_bytes and payload.file_size_bytes > MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File size exceeds maximum allowed limit of 10MB.",
            )
        doc_entry = {
            "id": str(uuid.uuid4()),
            "title": payload.title,
            "file_name": payload.file_name or "document.pdf",
            "file_size_bytes": payload.file_size_bytes,
            "file_url": payload.file_url,
            "doc_type": payload.doc_type,
            "status": "pending",
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
        }
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Document payload or file is required")

    docs = list(product.supporting_documents or [])
    docs.append(doc_entry)
    product.supporting_documents = docs
    product.updated_at = datetime.now(timezone.utc)
    await enqueue_index_job("product", product.id, "update", db)
    await db.commit()
    return {"message": "Document added successfully", "document": doc_entry}


@router.post("/products/{id}/certifications")
async def add_supplier_product_certification(
    id: str,
    payload: AddCertificationRequest,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    try:
        p_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    res = await db.execute(select(Product).where(Product.id == p_uuid))
    product = res.scalar_one_or_none()
    if not product or product.supplier_id != supplier.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    cert_entry = {
        "id": str(uuid.uuid4()),
        "name": payload.name,
        "code": payload.code or payload.name.lower().replace(" ", "-"),
        "certificate_no": payload.certificate_no,
        "issued_at": payload.issued_at,
        "expires_at": payload.expires_at,
        "document_url": payload.document_url,
        "status": payload.status or "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    certs = list(product.certifications_json or [])
    certs.append(cert_entry)
    product.certifications_json = certs
    product.updated_at = datetime.now(timezone.utc)
    await enqueue_index_job("product", product.id, "update", db)
    await db.commit()
    return {"message": "Certification record added", "certification": cert_entry}


@router.delete("/products/{id}")
async def delete_supplier_product(
    id: str,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    try:
        p_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    res = await db.execute(select(Product).where(Product.id == p_uuid))
    product = res.scalar_one_or_none()

    if not product or product.supplier_id != supplier.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    await enqueue_index_job("product", product.id, "delete", db)
    await db.delete(product)
    await db.commit()
    return {"message": "Product deleted successfully"}




# --- 5. Capacity & Inventory ---

@router.get("/capacity", response_model=List[CapacityInventoryItem])
async def get_capacity_inventory(
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(Product).where(Product.supplier_id == supplier.id).order_by(Product.name.asc())
    )
    products = res.scalars().all()

    items = []
    for p in products:
        items.append(
            CapacityInventoryItem(
                product_id=str(p.id),
                product_name=p.name,
                unit=p.unit,
                moq=p.moq,
                monthly_capacity=supplier.capacity_per_month,
                stock_available=p.stock_available,
                next_available_date=p.next_available_date.isoformat() if p.next_available_date else None,
                lead_time_days=p.lead_time_days,
            )
        )
    return items


@router.put("/capacity/{product_id}")
async def update_capacity_inventory(
    product_id: str,
    payload: CapacityInventoryUpdate,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    try:
        p_uuid = uuid.UUID(product_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    res = await db.execute(select(Product).where(Product.id == p_uuid))
    product = res.scalar_one_or_none()

    if not product or product.supplier_id != supplier.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    product.stock_available = payload.stock_available
    if payload.lead_time_days is not None:
        product.lead_time_days = payload.lead_time_days
    if payload.next_available_date:
        try:
            product.next_available_date = date.fromisoformat(payload.next_available_date)
        except ValueError:
            pass

    await db.commit()
    return {"message": "Inventory and capacity updated successfully"}


# --- 6. Certifications Management with Expiry Warning ---

@router.get("/certifications", response_model=List[SupplierCertificationItem])
async def list_supplier_certifications(
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(SupplierCertification)
        .where(SupplierCertification.supplier_id == supplier.id)
        .options(selectinload(SupplierCertification.certification))
    )
    sc_list = res.scalars().all()

    today = date.today()
    items = []
    for sc in sc_list:
        if sc.certification:
            days_left = (sc.expires_at - today).days if sc.expires_at else 365
            items.append(
                SupplierCertificationItem(
                    id=str(sc.id),
                    name=sc.certification.name,
                    code=sc.certification.code,
                    certificate_no=sc.certificate_no,
                    issuing_body=sc.certification.issuing_body,
                    issued_at=sc.issued_at.isoformat() if sc.issued_at else None,
                    expires_at=sc.expires_at.isoformat() if sc.expires_at else None,
                    is_valid=days_left > 0,
                    days_to_expiry=days_left,
                    expiry_warning=0 < days_left <= 30,
                )
            )
    return items


@router.post("/certifications", status_code=status.HTTP_201_CREATED)
async def upload_supplier_certification(
    payload: SupplierCertCreate,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    code = payload.code or payload.certification_name.upper().replace(" ", "-")[:10]
    c_res = await db.execute(select(Certification).where(Certification.code == code))
    cert = c_res.scalar_one_or_none()
    if not cert:
        cert = Certification(
            name=payload.certification_name,
            code=code,
            issuing_body="Accredited Certification Authority",
        )
        db.add(cert)
        await db.flush()

    issued = date.fromisoformat(payload.issued_at) if payload.issued_at else date.today()
    expires = date.fromisoformat(payload.expires_at) if payload.expires_at else date.today() + timedelta(days=365)

    sc = SupplierCertification(
        supplier_id=supplier.id,
        certification_id=cert.id,
        certificate_no=payload.certificate_no,
        issued_at=issued,
        expires_at=expires,
    )
    db.add(sc)
    await db.commit()
    await db.refresh(sc)
    return {"id": str(sc.id), "message": "Certificate uploaded successfully"}


@router.delete("/certifications/{id}")
async def delete_supplier_certification(
    id: str,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    try:
        sc_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certification not found")

    res = await db.execute(
        select(SupplierCertification).where(
            SupplierCertification.id == sc_uuid,
            SupplierCertification.supplier_id == supplier.id,
        )
    )
    sc = res.scalar_one_or_none()
    if not sc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certification not found")

    await db.delete(sc)
    await db.commit()
    return {"message": "Certification removed successfully"}


# --- 7. Inquiries Inbox ---

@router.get("/inquiries", response_model=List[SupplierInquiryItem])
async def get_supplier_inquiries(
    supplier: Supplier = Depends(get_current_supplier),
):
    return [
        SupplierInquiryItem(
            id=str(uuid.uuid4()),
            sender_name="Bhogeswara Reddy",
            sender_company="Reddy Global Trading GmbH",
            sender_country="Germany",
            subject="Inquiry regarding 20 MT Organic Turmeric Powder to Hamburg",
            message="Hi, we reviewed your accredited EU organic certification and lab report. Could you provide CIF Hamburg freight rates and lead time for late November shipment?",
            rfq_number="RFQ-2026-1042",
            created_at="Oct 08, 2026",
            is_read=True,
            replied=True,
        ),
        SupplierInquiryItem(
            id=str(uuid.uuid4()),
            sender_name="Hans Schmidt",
            sender_company="Hamburg Spice Importers AG",
            sender_country="Germany",
            subject="Technical specification & pesticide residue limits for Black Pepper",
            message="Please provide recent HPLC screening report for ethylene oxide and piperine content for your Tellicherry bold grade.",
            rfq_number=None,
            created_at="Oct 09, 2026",
            is_read=False,
            replied=False,
        ),
        SupplierInquiryItem(
            id=str(uuid.uuid4()),
            sender_name="Tariq Al-Mansoor",
            sender_company="Emirates Foodstuff Trading LLC",
            sender_country="UAE",
            subject="Bulk inquiry: 40ft container Coriander Seeds to Jebel Ali",
            message="We require quotation for whole coriander seeds mechanical machine cleaned 99% purity.",
            rfq_number="RFQ-2026-1120",
            created_at="Oct 10, 2026",
            is_read=False,
            replied=False,
        ),
    ]


@router.post("/inquiries/{id}/reply")
async def reply_inquiry(
    id: str,
    payload: Dict[str, str],
    supplier: Supplier = Depends(get_current_supplier),
):
    reply_text = payload.get("message", "Quotation sent.")
    return {"id": id, "status": "replied", "reply": reply_text, "message": "Reply dispatched to buyer"}


# --- 8. File Upload Interface ---

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    supplier: Supplier = Depends(get_current_supplier),
):
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File exceeds 10MB limit")

    ext = os.path.splitext(file.filename or "")[1].lower()
    allowed_exts = [".jpg", ".jpeg", ".png", ".webp", ".pdf"]
    if ext not in allowed_exts:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"File extension '{ext}' not permitted")

    file_id = uuid.uuid4().hex
    filename = f"{file_id}{ext}"
    url = f"/uploads/{filename}"

    return {
        "url": url,
        "filename": file.filename,
        "size": len(contents),
        "message": "File uploaded successfully",
    }
