import uuid
from datetime import date, datetime
from typing import List, Optional
from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, Float, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Category(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "categories"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id", ondelete="CASCADE"), nullable=True, index=True
    )

    parent: Mapped[Optional["Category"]] = relationship("Category", remote_side="Category.id", back_populates="children")
    children: Mapped[List["Category"]] = relationship("Category", back_populates="parent")
    products: Mapped[List["Product"]] = relationship("Product", back_populates="category")


class Certification(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "certifications"

    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    issuing_body: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    supplier_certifications: Mapped[List["SupplierCertification"]] = relationship(
        "SupplierCertification", back_populates="certification"
    )


class SupplierCertification(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "supplier_certifications"

    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    certification_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("certifications.id", ondelete="CASCADE"), nullable=False, index=True
    )
    certificate_no: Mapped[str] = mapped_column(String(100), nullable=False)
    issued_at: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    expires_at: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)

    supplier: Mapped["Supplier"] = relationship("Supplier", back_populates="certifications")
    certification: Mapped["Certification"] = relationship("Certification", back_populates="supplier_certifications")


class Product(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("moq > 0", name="chk_product_moq_positive"),
        CheckConstraint("lead_time_days >= 0", name="chk_product_lead_time_non_negative"),
        Index("idx_products_origin_country", "origin_country"),
        Index("idx_products_is_active", "is_active"),
        Index("idx_products_status", "status"),
    )

    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    hs_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    moq: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    unit: Mapped[str] = mapped_column(String(50), default="kg", nullable=False)
    origin_country: Mapped[str] = mapped_column(String(100), nullable=False)
    lead_time_days: Mapped[int] = mapped_column(Integer, default=14, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    specifications: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    stock_available: Mapped[int] = mapped_column(Integer, default=1000, nullable=False)
    next_available_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # Prompt 15 Catalog Enhancements
    product_form: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    production_region: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="USD", nullable=False)
    price_valid_from: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    price_valid_until: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    available_quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reserved_quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    availability_status: Mapped[str] = mapped_column(String(50), default="in_stock", nullable=False)
    monthly_capacity: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    packaging: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    storage: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    export_details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    supported_destinations: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    incoterms: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    payment_terms: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    supporting_documents: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    certifications_json: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="draft", nullable=False, index=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    admin_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    price_confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    inventory_confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    supplier: Mapped["Supplier"] = relationship("Supplier", back_populates="products")
    category: Mapped["Category"] = relationship("Category", back_populates="products")
    images: Mapped[List["ProductImage"]] = relationship("ProductImage", back_populates="product", cascade="all, delete-orphan")
    price_tiers: Mapped[List["PriceTier"]] = relationship("PriceTier", back_populates="product", cascade="all, delete-orphan")


class ProductImage(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "product_images"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    image_url: Mapped[str] = mapped_column(String(512), nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    product: Mapped["Product"] = relationship("Product", back_populates="images")


class PriceTier(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "price_tiers"
    __table_args__ = (
        CheckConstraint("min_qty > 0", name="chk_price_tier_min_qty_positive"),
        CheckConstraint("unit_price >= 0", name="chk_price_tier_price_non_negative"),
    )

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    min_qty: Mapped[int] = mapped_column(Integer, nullable=False)
    max_qty: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="USD", nullable=False)

    product: Mapped["Product"] = relationship("Product", back_populates="price_tiers")


class IndexJob(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "index_jobs"

    entity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    entity_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    operation: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="Pending", nullable=False, index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    payload: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

