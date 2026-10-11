import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import Boolean, CheckConstraint, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Role(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    users: Mapped[List["User"]] = relationship("User", back_populates="role_rel")


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="buyer", nullable=False, index=True)
    role_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roles.id", ondelete="SET NULL"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    settings: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict, nullable=True)

    role_rel: Mapped[Optional["Role"]] = relationship("Role", back_populates="users")
    buyers: Mapped[List["Buyer"]] = relationship("Buyer", back_populates="user")
    suppliers: Mapped[List["Supplier"]] = relationship("Supplier", back_populates="user")
    refresh_tokens: Mapped[List["RefreshToken"]] = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")


class RefreshToken(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "refresh_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, default=None)

    user: Mapped["User"] = relationship("User", back_populates="refresh_tokens")


class Company(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "companies"
    __table_args__ = (
        CheckConstraint("years_in_business >= 0", name="chk_company_years_non_negative"),
        Index("idx_companies_country", "country"),
        Index("idx_companies_verified_status", "verified_status"),
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    country: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    website: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    banner_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    years_in_business: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    verified_status: Mapped[str] = mapped_column(String(50), default="unverified", nullable=False)
    languages: Mapped[Optional[List[str]]] = mapped_column(ARRAY(String), nullable=True)
    factory_details: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    suppliers: Mapped[List["Supplier"]] = relationship("Supplier", back_populates="company")
    buyers: Mapped[List["Buyer"]] = relationship("Buyer", back_populates="company")


class Buyer(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "buyers"

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    import_destinations: Mapped[Optional[List[str]]] = mapped_column(ARRAY(String), nullable=True)

    company: Mapped["Company"] = relationship("Company", back_populates="buyers")
    user: Mapped["User"] = relationship("User", back_populates="buyers")


class Supplier(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "suppliers"
    __table_args__ = (
        CheckConstraint("trust_score >= 0.0 AND trust_score <= 5.0", name="chk_supplier_trust_score"),
        CheckConstraint("on_time_rate >= 0.0 AND on_time_rate <= 100.0", name="chk_supplier_on_time_rate"),
        CheckConstraint("response_time_hours >= 0.0", name="chk_supplier_response_time"),
        Index("idx_suppliers_trust_score", "trust_score"),
    )

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    trust_score: Mapped[float] = mapped_column(Float, default=5.0, nullable=False)
    on_time_rate: Mapped[float] = mapped_column(Float, default=100.0, nullable=False)
    capacity_per_month: Mapped[str] = mapped_column(String(100), default="100 MT", nullable=False)
    export_countries: Mapped[Optional[List[str]]] = mapped_column(ARRAY(String), nullable=True)
    response_time_hours: Mapped[float] = mapped_column(Float, default=24.0, nullable=False)
    repeat_buyer_rate: Mapped[float] = mapped_column(Float, default=84.0, nullable=False)
    total_buyers_count: Mapped[int] = mapped_column(Integer, default=320, nullable=False)

    company: Mapped["Company"] = relationship("Company", back_populates="suppliers")
    user: Mapped["User"] = relationship("User", back_populates="suppliers")
    certifications: Mapped[List["SupplierCertification"]] = relationship(
        "SupplierCertification", back_populates="supplier"
    )
    products: Mapped[List["Product"]] = relationship("Product", back_populates="supplier")
