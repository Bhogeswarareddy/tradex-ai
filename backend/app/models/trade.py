import uuid
from datetime import date, datetime, timezone
from typing import List, Optional
from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, Float, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class RFQ(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "rfqs"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="chk_rfq_quantity_positive"),
        CheckConstraint("target_price_min >= 0", name="chk_rfq_price_min_non_negative"),
        CheckConstraint("target_price_max >= target_price_min", name="chk_rfq_price_range_valid"),
        Index("idx_rfqs_status", "status"),
        Index("idx_rfqs_destination_country", "destination_country"),
    )

    rfq_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    buyer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("buyers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    product: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit: Mapped[str] = mapped_column(String(50), default="kg", nullable=False)
    target_price_min: Mapped[float] = mapped_column(Numeric(12, 4), default=0.0, nullable=False)
    target_price_max: Mapped[float] = mapped_column(Numeric(12, 4), default=0.0, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="EUR", nullable=False)
    destination_country: Mapped[str] = mapped_column(String(100), nullable=False)
    destination_port: Mapped[str] = mapped_column(String(100), nullable=False)
    deadline: Mapped[date] = mapped_column(Date, nullable=False)
    rfq_deadline: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    delivery_deadline: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    incoterm: Mapped[str] = mapped_column(String(20), default="CIF", nullable=False)
    payment_terms: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    specifications: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    quality_requirements: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    required_certifications: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    attachments: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    buyer: Mapped["Buyer"] = relationship("Buyer")
    items: Mapped[List["RFQItem"]] = relationship("RFQItem", back_populates="rfq", cascade="all, delete-orphan")
    quotations: Mapped[List["Quotation"]] = relationship("Quotation", back_populates="rfq", cascade="all, delete-orphan")


class RFQItem(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "rfq_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="chk_rfq_item_quantity_positive"),
        CheckConstraint("target_price >= 0", name="chk_rfq_item_price_non_negative"),
    )

    rfq_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rfqs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True
    )
    item_name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit: Mapped[str] = mapped_column(String(50), default="kg", nullable=False)
    target_price: Mapped[float] = mapped_column(Numeric(12, 4), default=0.0, nullable=False)
    specifications: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    rfq: Mapped["RFQ"] = relationship("RFQ", back_populates="items")


class Quotation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "quotations"
    __table_args__ = (
        UniqueConstraint("rfq_id", "supplier_id", name="uq_quote_rfq_supplier"),
        CheckConstraint("unit_price >= 0", name="chk_quote_unit_price_non_negative"),
        CheckConstraint("landed_cost >= 0", name="chk_quote_landed_cost_non_negative"),
        CheckConstraint("lead_time_days >= 0", name="chk_quote_lead_time_non_negative"),
        CheckConstraint("ai_score >= 0.0 AND ai_score <= 100.0", name="chk_quote_ai_score_range"),
        Index("idx_quotations_status", "status"),
    )

    quote_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    rfq_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rfqs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    unit_price: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    landed_cost: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    freight_cost: Mapped[float] = mapped_column(Numeric(12, 4), default=0.0, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="EUR", nullable=False)
    moq: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    lead_time_days: Mapped[int] = mapped_column(Integer, nullable=False)
    payment_terms: Mapped[str] = mapped_column(String(100), default="LC at sight", nullable=False)
    valid_until: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="submitted", nullable=False)
    ai_score: Mapped[float] = mapped_column(Float, default=85.0, nullable=False)
    attachments: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    rfq: Mapped["RFQ"] = relationship("RFQ", back_populates="quotations")
    supplier: Mapped["Supplier"] = relationship("Supplier")


class Order(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint("total_amount >= 0", name="chk_order_total_amount_non_negative"),
        Index("idx_orders_status", "status"),
    )

    order_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    rfq_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rfqs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    quotation_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quotations.id", ondelete="SET NULL"), nullable=True, index=True
    )
    buyer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("buyers.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    total_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="EUR", nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="confirmed", nullable=False)
    incoterm: Mapped[str] = mapped_column(String(20), default="CIF", nullable=False)
    payment_terms: Mapped[str] = mapped_column(String(100), default="LC at sight, 30% advance", nullable=False)
    shipping_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    documents: Mapped[Optional[list]] = mapped_column(JSONB, default=list, nullable=True)

    rfq: Mapped[Optional["RFQ"]] = relationship("RFQ")
    quotation: Mapped[Optional["Quotation"]] = relationship("Quotation")
    buyer: Mapped["Buyer"] = relationship("Buyer")
    supplier: Mapped["Supplier"] = relationship("Supplier")
    items: Mapped[List["OrderItem"]] = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    payments: Mapped[List["Payment"]] = relationship("Payment", back_populates="order", cascade="all, delete-orphan")
    shipments: Mapped[List["Shipment"]] = relationship("Shipment", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "order_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="chk_order_item_qty_positive"),
        CheckConstraint("unit_price >= 0", name="chk_order_item_price_non_negative"),
        CheckConstraint("total_price >= 0", name="chk_order_item_total_non_negative"),
    )

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit: Mapped[str] = mapped_column(String(50), default="kg", nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    total_price: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)

    order: Mapped["Order"] = relationship("Order", back_populates="items")


class Payment(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint("amount >= 0", name="chk_payment_amount_non_negative"),
        Index("idx_payments_status", "status"),
    )

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="EUR", nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    payment_method: Mapped[str] = mapped_column(String(50), default="Escrow", nullable=False)
    payment_type: Mapped[str] = mapped_column(String(50), default="advance", nullable=False)
    simulated: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    transaction_ref: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    order: Mapped["Order"] = relationship("Order", back_populates="payments")


class Shipment(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "shipments"
    __table_args__ = (
        Index("idx_shipments_status", "status"),
    )

    shipment_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    carrier: Mapped[str] = mapped_column(String(100), nullable=False)
    tracking_number: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    origin: Mapped[str] = mapped_column(String(150), nullable=False)
    destination: Mapped[str] = mapped_column(String(150), nullable=False)
    mode: Mapped[str] = mapped_column(String(50), default="sea", nullable=False)
    vessel_or_flight: Mapped[str] = mapped_column(String(100), default="MV Ocean Star", nullable=False)
    container_number: Mapped[str] = mapped_column(String(50), default="TCNU1234567", nullable=False)
    freight_forwarder: Mapped[str] = mapped_column(String(100), default="OceanLink Logistics", nullable=False)
    incoterm: Mapped[str] = mapped_column(String(20), default="FOB", nullable=False)
    goods: Mapped[str] = mapped_column(String(255), default="Organic Turmeric Powder, 20,000 MT", nullable=False)
    eta: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    current_latitude: Mapped[float] = mapped_column(Float, default=15.5, nullable=False)
    current_longitude: Mapped[float] = mapped_column(Float, default=65.2, nullable=False)
    current_location: Mapped[str] = mapped_column(String(150), default="Arabian Sea", nullable=False)
    documents: Mapped[Optional[list]] = mapped_column(JSONB, default=list, nullable=True)
    estimated_delivery: Mapped[date] = mapped_column(Date, nullable=False)
    actual_delivery: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="in_transit", nullable=False)

    order: Mapped["Order"] = relationship("Order", back_populates="shipments")
    events: Mapped[List["ShipmentEvent"]] = relationship("ShipmentEvent", back_populates="shipment", cascade="all, delete-orphan")


class ShipmentEvent(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "shipment_events"

    shipment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shipments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    location: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    shipment: Mapped["Shipment"] = relationship("Shipment", back_populates="events")


class SimulatedFreightRate(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "simulated_freight_rates"
    __table_args__ = (
        Index("idx_freight_route", "origin_port", "destination_port"),
    )

    origin_port: Mapped[str] = mapped_column(String(100), nullable=False)
    origin_country: Mapped[str] = mapped_column(String(100), nullable=False)
    destination_port: Mapped[str] = mapped_column(String(100), nullable=False)
    destination_country: Mapped[str] = mapped_column(String(100), nullable=False)
    container_type: Mapped[str] = mapped_column(String(50), default="20FT", nullable=False)
    rate: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="EUR", nullable=False)
    transit_days: Mapped[int] = mapped_column(Integer, default=21, nullable=False)


class SimulatedTariffDuty(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "simulated_tariff_duties"
    __table_args__ = (
        Index("idx_tariff_hs_dest", "hs_code", "destination_country"),
    )

    hs_code: Mapped[str] = mapped_column(String(50), nullable=False)
    destination_country: Mapped[str] = mapped_column(String(100), nullable=False)
    duty_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    vat_tax_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)


class SimulatedPortHandlingFee(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "simulated_port_handling_fees"
    __table_args__ = (
        Index("idx_port_handling_name", "port_name"),
    )

    port_name: Mapped[str] = mapped_column(String(100), nullable=False)
    country: Mapped[str] = mapped_column(String(100), nullable=False)
    terminal_handling_per_kg: Mapped[float] = mapped_column(Numeric(12, 4), default=0.035, nullable=False)
    customs_clearance_flat: Mapped[float] = mapped_column(Numeric(12, 4), default=150.0, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="EUR", nullable=False)


class SimulatedExchangeRate(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "simulated_exchange_rates"
    __table_args__ = (
        Index("idx_fx_pair", "from_currency", "to_currency"),
    )

    from_currency: Mapped[str] = mapped_column(String(10), nullable=False)
    to_currency: Mapped[str] = mapped_column(String(10), nullable=False)
    rate: Mapped[float] = mapped_column(Numeric(12, 6), nullable=False)
