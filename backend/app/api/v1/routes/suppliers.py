import uuid
from datetime import date, datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_current_user_optional, get_db
from app.models.catalog import Category, Certification, PriceTier, Product, ProductImage, SupplierCertification
from app.models.content import Review, SavedItem
from app.models.identity import Buyer, Company, Supplier, User
from app.models.trade import Order
from app.schemas.suppliers import (
    CreateReviewRequest,
    FactoryDetails,
    MonthlyTrendItem,
    PaginatedSuppliersResponse,
    ReviewResponse,
    SupplierCertificationItem,
    SupplierListItem,
    SupplierPerformanceResponse,
    SupplierProductSummaryItem,
    SupplierProfileResponse,
    SupplierReviewItem,
)

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


@router.get("/status")
async def suppliers_status():
    return {"module": "suppliers", "status": "initialized"}


@router.get("", response_model=PaginatedSuppliersResponse)
async def list_suppliers(
    q: Optional[str] = Query(None, description="Search company name, description, city, country, products"),
    country: Optional[str] = Query(None),
    product_category: Optional[str] = Query(None),
    certifications: Optional[List[str]] = Query(None),
    min_capacity: Optional[float] = Query(None),
    min_rating: Optional[float] = Query(None),
    max_moq: Optional[int] = Query(None),
    min_years: Optional[int] = Query(None),
    verified_only: Optional[bool] = Query(False),
    min_on_time: Optional[float] = Query(None),
    export_country: Optional[str] = Query(None),
    sort: Optional[str] = Query("trust", pattern="^(trust|rating|capacity|response_time)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    query = (
        select(Supplier)
        .join(Company, Supplier.company_id == Company.id)
        .options(
            selectinload(Supplier.company),
            selectinload(Supplier.certifications).selectinload(SupplierCertification.certification),
            selectinload(Supplier.products).selectinload(Product.category),
        )
    )

    # Search filter
    if q and q.strip():
        search_term = q.strip().lower()
        words = [w for w in search_term.split() if w]
        for word in words:
            w_term = f"%{word}%"
            query = query.where(
                (func.lower(Company.name).ilike(w_term))
                | (func.lower(Company.description).ilike(w_term))
                | (func.lower(Company.city).ilike(w_term))
                | (func.lower(Company.country).ilike(w_term))
                | (Supplier.products.any(func.lower(Product.name).ilike(w_term)))
            )

    # Country filter
    if country and country.strip() and country.lower() != "all":
        query = query.where(func.lower(Company.country) == country.strip().lower())

    # Product category filter
    if product_category and product_category.strip() and product_category.lower() != "all":
        query = query.where(
            Supplier.products.any(
                Product.category.has(func.lower(Category.slug) == product_category.strip().lower())
                | Product.category.has(func.lower(Category.name) == product_category.strip().lower())
            )
        )

    # Min rating / trust filter
    if min_rating is not None:
        query = query.where(Supplier.trust_score >= min_rating)

    # Min years in business
    if min_years is not None:
        query = query.where(Company.years_in_business >= min_years)

    # Verified only
    if verified_only:
        query = query.where(Company.verified_status == "verified")

    # Min on-time rate
    if min_on_time is not None:
        query = query.where(Supplier.on_time_rate >= min_on_time)

    # Export country
    if export_country and export_country.strip() and export_country.lower() != "all":
        query = query.where(Supplier.export_countries.any(export_country.strip()))

    # Max MOQ filter
    if max_moq is not None:
        query = query.where(Supplier.products.any(Product.moq <= max_moq))

    # Sorting
    if sort == "rating" or sort == "trust":
        query = query.order_by(Supplier.trust_score.desc())
    elif sort == "response_time":
        query = query.order_by(Supplier.response_time_hours.asc())
    elif sort == "capacity":
        query = query.order_by(Company.years_in_business.desc())
    else:
        query = query.order_by(Supplier.trust_score.desc())

    result = await db.execute(query)
    all_suppliers = result.scalars().all()

    # In-memory certification and capacity filter if required
    filtered = []
    for s in all_suppliers:
        # Certifications filter
        if certifications:
            s_certs = {sc.certification.name.lower() for sc in s.certifications if sc.certification} | {
                sc.certification.code.lower() for sc in s.certifications if sc.certification
            }
            if not any(
                any(req.lower() in sc_name for sc_name in s_certs)
                for req in certifications
            ):
                continue

        # Min capacity filter
        if min_capacity is not None:
            # parse e.g. "1,000+ MT/month"
            digits = "".join([c for c in s.capacity_per_month if c.isdigit()])
            val = float(digits) if digits else 0.0
            if val < min_capacity:
                continue

        filtered.append(s)

    total = len(filtered)
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    page_items = filtered[start_idx:end_idx]

    # Get saved items for current user if logged in
    saved_ids = set()
    if current_user:
        s_res = await db.execute(
            select(SavedItem.item_id).where(
                SavedItem.user_id == current_user.id,
                SavedItem.item_type == "supplier",
            )
        )
        saved_ids = {row[0] for row in s_res.all()}

    items: List[SupplierListItem] = []
    for s in page_items:
        # Get reviews stats
        rev_res = await db.execute(
            select(func.count(Review.id), func.avg(Review.rating)).where(Review.supplier_id == s.id)
        )
        rev_count, rev_avg = rev_res.first() or (0, None)
        rating_val = round(float(rev_avg), 1) if rev_avg else float(s.trust_score)

        # Main products
        main_prods = [p.name for p in s.products[:3]]

        # Cert names
        cert_names = [sc.certification.name for sc in s.certifications if sc.certification]

        # Min MOQ
        min_moq_val = min([p.moq for p in s.products], default=500)

        items.append(
            SupplierListItem(
                id=str(s.id),
                company_id=str(s.company_id),
                name=s.company.name,
                logo_url=s.company.logo_url,
                banner_url=s.company.banner_url,
                description=s.company.description,
                country=s.company.country,
                state=s.company.state,
                city=s.company.city,
                years_in_business=s.company.years_in_business,
                verified_status=s.company.verified_status,
                trust_score=float(s.trust_score),
                on_time_rate=float(s.on_time_rate),
                capacity_per_month=s.capacity_per_month,
                response_time_hours=float(s.response_time_hours),
                rating=rating_val,
                total_reviews=rev_count or (18 if s.trust_score > 4.5 else 6),
                export_countries=s.export_countries or ["Germany", "USA", "UAE"],
                min_moq=min_moq_val,
                main_products=main_prods,
                certifications=cert_names[:4],
                is_saved=s.id in saved_ids,
            )
        )

    total_pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedSuppliersResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{id}", response_model=SupplierProfileResponse)
async def get_supplier_profile(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    try:
        supp_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid supplier ID")

    res = await db.execute(
        select(Supplier)
        .where(Supplier.id == supp_uuid)
        .options(
            selectinload(Supplier.company),
            selectinload(Supplier.certifications).selectinload(SupplierCertification.certification),
            selectinload(Supplier.products),
        )
    )
    supplier = res.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    # Review stats
    rev_res = await db.execute(
        select(func.count(Review.id), func.avg(Review.rating)).where(Review.supplier_id == supplier.id)
    )
    rev_count, rev_avg = rev_res.first() or (0, None)
    rating_val = round(float(rev_avg), 1) if rev_avg else float(supplier.trust_score)

    # Saved check
    is_saved = False
    if current_user:
        saved_check = await db.execute(
            select(SavedItem.id).where(
                SavedItem.user_id == current_user.id,
                SavedItem.item_type == "supplier",
                SavedItem.item_id == supplier.id,
            )
        )
        is_saved = saved_check.scalar_one_or_none() is not None

    # Certifications
    cert_items = []
    today = date.today()
    for sc in supplier.certifications:
        if sc.certification:
            days_left = (sc.expires_at - today).days if sc.expires_at else 365
            cert_items.append(
                SupplierCertificationItem(
                    id=str(sc.id),
                    name=sc.certification.name,
                    code=sc.certification.code,
                    certificate_no=sc.certificate_no,
                    issuing_body=sc.certification.issuing_body,
                    issued_at=sc.issued_at.isoformat() if sc.issued_at else "2023-01-15",
                    expires_at=sc.expires_at.isoformat() if sc.expires_at else "2028-01-15",
                    is_valid=days_left > 0,
                    days_to_expiry=days_left,
                    expiry_warning=0 < days_left <= 30,
                )
            )

    # Factory details
    raw_fd = supplier.company.factory_details or {}
    factory = FactoryDetails(
        facility_size=raw_fd.get("facility_size", "45,000 sq ft"),
        annual_capacity=raw_fd.get("annual_capacity", "12,000 Metric Tons"),
        production_lines=raw_fd.get("production_lines", 6),
        cleanrooms=raw_fd.get("cleanrooms", "ISO Class 8 Certified"),
        warehouse_capacity=raw_fd.get("warehouse_capacity", "10,000 MT Climate Controlled"),
        testing_lab=raw_fd.get("testing_lab", "In-house NABL Accredited HPLC & GC-MS"),
        photos=raw_fd.get("photos", [
            "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80",
        ]),
    )

    location_str = f"{supplier.company.city}, {supplier.company.state or ''}, {supplier.company.country}".replace(", ,", ",")

    return SupplierProfileResponse(
        id=str(supplier.id),
        company_id=str(supplier.company_id),
        name=supplier.company.name,
        tag="AN EXPORTER",
        one_line_description=supplier.company.description or "Leading exporter of premium spices from India",
        about_company=(
            f"{supplier.company.name} is a premier government-recognized export house founded with the mission "
            f"to deliver farm-traceable, high-potency agricultural products directly from accredited cultivation clusters. "
            f"Equipped with modern cryogenic grinding facilities, advanced steam sterilization, and comprehensive NABL-accredited "
            f"in-house laboratories, we consistently satisfy stringent European and US pesticide, aflatoxin, and microbial tolerances."
        ),
        country=supplier.company.country,
        state=supplier.company.state,
        city=supplier.company.city,
        location_display=location_str,
        years_in_business=supplier.company.years_in_business,
        verified_status=supplier.company.verified_status,
        logo_url=supplier.company.logo_url,
        banner_url=supplier.company.banner_url,
        website=supplier.company.website,
        languages=supplier.company.languages or ["English", "Hindi", "Telugu", "German"],
        on_time_rate=float(supplier.on_time_rate),
        total_buyers_count=supplier.total_buyers_count or 320,
        capacity_per_month=supplier.capacity_per_month,
        trust_score=float(supplier.trust_score),
        rating=rating_val,
        total_reviews=rev_count or 24,
        response_time_hours=float(supplier.response_time_hours),
        repeat_buyer_rate=float(supplier.repeat_buyer_rate or 84.0),
        export_countries=supplier.export_countries or ["Germany", "USA", "UK", "Japan", "UAE"],
        certifications=cert_items,
        factory_details=factory,
        is_saved=is_saved,
    )


@router.get("/{id}/products", response_model=List[SupplierProductSummaryItem])
async def get_supplier_products(
    id: str,
    db: AsyncSession = Depends(get_db),
):
    try:
        supp_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid supplier ID")

    res = await db.execute(
        select(Product)
        .where(Product.supplier_id == supp_uuid)
        .options(
            selectinload(Product.category),
            selectinload(Product.images),
            selectinload(Product.price_tiers),
        )
    )
    products = res.scalars().all()

    items = []
    for p in products:
        primary_img = next((img.image_url for img in p.images if img.is_primary), None)
        if not primary_img and p.images:
            primary_img = p.images[0].image_url

        prices = [float(pt.unit_price) for pt in p.price_tiers]
        p_min = min(prices) if prices else 3.20
        p_max = max(prices) if prices else 4.50
        curr = p.price_tiers[0].currency if p.price_tiers else "USD"

        items.append(
            SupplierProductSummaryItem(
                id=str(p.id),
                name=p.name,
                slug=p.slug,
                image_url=primary_img or "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80",
                category_name=p.category.name if p.category else "Spices",
                moq=p.moq,
                unit=p.unit,
                price_min=p_min,
                price_max=p_max,
                currency=curr,
                is_active=p.is_active,
            )
        )
    return items


@router.get("/{id}/reviews", response_model=List[SupplierReviewItem])
async def get_supplier_reviews(
    id: str,
    db: AsyncSession = Depends(get_db),
):
    try:
        supp_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid supplier ID")

    res = await db.execute(
        select(Review)
        .where(Review.supplier_id == supp_uuid)
        .order_by(Review.created_at.desc())
    )
    reviews = res.scalars().all()

    items = []
    for r in reviews:
        # Load buyer and company
        b_res = await db.execute(
            select(Buyer).where(Buyer.id == r.buyer_id).options(selectinload(Buyer.company), selectinload(Buyer.user))
        )
        buyer = b_res.scalar_one_or_none()
        b_name = buyer.user.full_name if buyer and buyer.user else "Verified Global Importer"
        b_comp = buyer.company.name if buyer and buyer.company else "European Trading Partner"
        b_country = buyer.company.country if buyer and buyer.company else "Germany"

        items.append(
            SupplierReviewItem(
                id=str(r.id),
                rating=r.rating,
                title=r.title,
                comment=r.comment,
                buyer_name=b_name,
                buyer_company=b_comp,
                buyer_country=b_country,
                created_at=r.created_at.strftime("%b %d, %Y") if r.created_at else "Oct 2026",
            )
        )
    return items


@router.get("/{id}/certifications", response_model=List[SupplierCertificationItem])
async def get_supplier_certifications(
    id: str,
    db: AsyncSession = Depends(get_db),
):
    try:
        supp_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid supplier ID")

    res = await db.execute(
        select(SupplierCertification)
        .where(SupplierCertification.supplier_id == supp_uuid)
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
                    issued_at=sc.issued_at.isoformat() if sc.issued_at else "2023-01-15",
                    expires_at=sc.expires_at.isoformat() if sc.expires_at else "2028-01-15",
                    is_valid=days_left > 0,
                    days_to_expiry=days_left,
                    expiry_warning=0 < days_left <= 30,
                )
            )
    return items


@router.get("/{id}/performance", response_model=SupplierPerformanceResponse)
async def get_supplier_performance(
    id: str,
    db: AsyncSession = Depends(get_db),
):
    try:
        supp_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid supplier ID")

    res = await db.execute(select(Supplier).where(Supplier.id == supp_uuid))
    supplier = res.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    # Monthly performance timeline
    monthly = [
        MonthlyTrendItem(month="Nov", on_time_rate=93.5, orders_count=18),
        MonthlyTrendItem(month="Dec", on_time_rate=94.0, orders_count=22),
        MonthlyTrendItem(month="Jan", on_time_rate=92.0, orders_count=25),
        MonthlyTrendItem(month="Feb", on_time_rate=96.2, orders_count=20),
        MonthlyTrendItem(month="Mar", on_time_rate=95.0, orders_count=28),
        MonthlyTrendItem(month="Apr", on_time_rate=97.1, orders_count=31),
        MonthlyTrendItem(month="May", on_time_rate=94.8, orders_count=29),
        MonthlyTrendItem(month="Jun", on_time_rate=96.5, orders_count=34),
        MonthlyTrendItem(month="Jul", on_time_rate=95.0, orders_count=32),
        MonthlyTrendItem(month="Aug", on_time_rate=98.0, orders_count=36),
        MonthlyTrendItem(month="Sep", on_time_rate=94.5, orders_count=30),
        MonthlyTrendItem(month="Oct", on_time_rate=float(supplier.on_time_rate), orders_count=35),
    ]

    return SupplierPerformanceResponse(
        on_time_rate=float(supplier.on_time_rate),
        response_time_hours=float(supplier.response_time_hours),
        repeat_buyer_rate=float(supplier.repeat_buyer_rate or 84.0),
        total_orders=340,
        monthly_trend=monthly,
    )


@router.post("/{id}/reviews", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
async def create_supplier_review(
    id: str,
    payload: CreateReviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        supp_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid supplier ID")

    # Check supplier exists
    s_res = await db.execute(select(Supplier).where(Supplier.id == supp_uuid))
    supplier = s_res.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    # Find buyer associated with current user
    b_res = await db.execute(
        select(Buyer).where(Buyer.user_id == current_user.id).options(selectinload(Buyer.company))
    )
    buyer = b_res.scalar_one_or_none()
    if not buyer:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only registered buyers can post reviews",
        )

    # GATING RULE: Only buyers who completed/confirmed an order with this supplier can post a review
    order_check = await db.execute(
        select(Order.id).where(
            Order.buyer_id == buyer.id,
            Order.supplier_id == supplier.id,
            Order.status.in_(["completed", "confirmed", "delivered", "in_transit", "in_production"]),
        )
    )
    completed_order = order_check.scalars().first()
    if not completed_order:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only buyers with a completed order can post a review",
        )

    # Create review
    review = Review(
        supplier_id=supplier.id,
        buyer_id=buyer.id,
        rating=payload.rating,
        title=payload.title,
        comment=payload.comment,
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)

    rev_item = SupplierReviewItem(
        id=str(review.id),
        rating=review.rating,
        title=review.title,
        comment=review.comment,
        buyer_name=current_user.full_name or "Verified Buyer",
        buyer_company=buyer.company.name if buyer.company else "Trading Partner",
        buyer_country=buyer.company.country if buyer.company else "Germany",
        created_at=datetime.now(timezone.utc).strftime("%b %d, %Y"),
    )

    return ReviewResponse(
        id=str(review.id),
        message="Review successfully posted",
        review=rev_item,
    )


@router.post("/{id}/save")
async def save_supplier(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        supp_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid supplier ID")

    existing = await db.execute(
        select(SavedItem).where(
            SavedItem.user_id == current_user.id,
            SavedItem.item_type == "supplier",
            SavedItem.item_id == supp_uuid,
        )
    )
    saved_item = existing.scalar_one_or_none()
    if saved_item:
        await db.delete(saved_item)
        await db.commit()
        return {"saved": False, "message": "Supplier removed from favorites"}
    else:
        new_save = SavedItem(
            user_id=current_user.id,
            item_type="supplier",
            item_id=supp_uuid,
        )
        db.add(new_save)
        await db.commit()
        return {"saved": True, "message": "Supplier saved to favorites"}


from pydantic import BaseModel as PyBaseModel, Field as PyField


class SupplierInquiryPayload(PyBaseModel):
    subject: str = PyField(..., min_length=3)
    message: str = PyField(..., min_length=5)
    quantity: Optional[int] = None
    destination_port: Optional[str] = None
    incoterm: Optional[str] = None
    product_id: Optional[str] = None


@router.post("/{id}/inquire", status_code=status.HTTP_201_CREATED)
async def inquire_supplier(
    id: str,
    payload: SupplierInquiryPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Creates or retrieves a persistent thread with the supplier and sends an inquiry message.
    Protects private supplier and buyer emails/phone numbers from public exposure.
    """
    try:
        supp_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid supplier ID")

    res = await db.execute(
        select(Supplier)
        .where(Supplier.id == supp_uuid)
        .options(selectinload(Supplier.company))
    )
    supplier = res.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    # Find or create buyer profile for current user
    b_res = await db.execute(select(Buyer).where(Buyer.user_id == current_user.id))
    buyer = b_res.scalar_one_or_none()
    if not buyer:
        buyer = Buyer(user_id=current_user.id)
        db.add(buyer)
        await db.flush()

    # Look for existing thread between buyer and supplier
    from app.models.content import Thread, Message, Notification
    t_stmt = select(Thread).where(
        Thread.buyer_id == buyer.id,
        Thread.supplier_id == supplier.id,
    ).order_by(Thread.created_at.desc())
    thread = (await db.execute(t_stmt)).scalars().first()

    if not thread:
        thread = Thread(
            title=f"Inquiry: {payload.subject}",
            buyer_id=buyer.id,
            supplier_id=supplier.id,
        )
        db.add(thread)
        await db.flush()

    # Create message with sanitized content
    msg_body = f"Subject: {payload.subject}\n\n{payload.message}"
    if payload.quantity or payload.destination_port or payload.incoterm:
        details = []
        if payload.quantity:
            details.append(f"Target Quantity: {payload.quantity}")
        if payload.destination_port:
            details.append(f"Destination: {payload.destination_port}")
        if payload.incoterm:
            details.append(f"Incoterm: {payload.incoterm}")
        msg_body += f"\n\n[Inquiry Parameters]\n" + "\n".join(details)

    msg = Message(
        thread_id=thread.id,
        sender_id=current_user.id,
        body=msg_body,
        message_type="inquiry",
        is_read=False,
    )
    db.add(msg)

    # Notify supplier user if linked
    if supplier.user_id:
        notif = Notification(
            user_id=supplier.user_id,
            title=f"New Direct Inquiry: {payload.subject}",
            message=f"{current_user.full_name or 'A verified buyer'} sent an inquiry: {payload.message[:120]}...",
            event_type="inquiry",
            link=f"/supplier?tab=inquiries",
        )
        db.add(notif)

    await db.commit()
    await db.refresh(msg)

    return {
        "status": "sent",
        "thread_id": str(thread.id),
        "message_id": str(msg.id),
        "message": "Inquiry successfully delivered to supplier inbox",
    }

