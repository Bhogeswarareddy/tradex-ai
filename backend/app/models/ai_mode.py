"""
TradeX AI - AI Mode Data Models (Prompt 18)
Tables:
- ai_conversations
- ai_messages
- ai_selected_products
- negotiation_drafts
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class AIConversation(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "ai_conversations"
    __table_args__ = (
        Index("idx_ai_conv_user_id", "user_id"),
        Index("idx_ai_conv_deleted_at", "deleted_at"),
        Index("idx_ai_conv_updated_at", "updated_at"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), default="New Conversation", nullable=False)
    search_state: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    user: Mapped["User"] = relationship("User")
    messages: Mapped[List["AIMessage"]] = relationship(
        "AIMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="AIMessage.created_at.asc()",
    )
    selected_products: Mapped[List["AISelectedProduct"]] = relationship(
        "AISelectedProduct",
        back_populates="conversation",
        cascade="all, delete-orphan",
    )
    negotiation_drafts: Mapped[List["NegotiationDraft"]] = relationship(
        "NegotiationDraft",
        back_populates="conversation",
        cascade="all, delete-orphan",
    )


class AIMessage(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "ai_messages"
    __table_args__ = (
        Index("idx_ai_messages_conv_id", "conversation_id"),
        Index("idx_ai_messages_created_at", "created_at"),
    )

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(50), nullable=False)  # user, assistant, system
    content: Mapped[str] = mapped_column(Text, nullable=False)
    structured: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)  # criteria, product_ids, follow_ups, sources
    provider: Mapped[str] = mapped_column(String(50), default="deterministic_fallback", nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    conversation: Mapped["AIConversation"] = relationship("AIConversation", back_populates="messages")


class AISelectedProduct(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "ai_selected_products"
    __table_args__ = (
        UniqueConstraint("conversation_id", "product_id", name="uq_conv_product_selection"),
        Index("idx_ai_sel_prod_conv", "conversation_id"),
        Index("idx_ai_sel_prod_product", "product_id"),
    )

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    conversation: Mapped["AIConversation"] = relationship("AIConversation", back_populates="selected_products")
    product: Mapped["Product"] = relationship("Product")


class NegotiationDraft(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "negotiation_drafts"
    __table_args__ = (
        Index("idx_neg_drafts_conv", "conversation_id"),
        Index("idx_neg_drafts_product", "product_id"),
        Index("idx_neg_drafts_supplier", "supplier_id"),
        Index("idx_neg_drafts_buyer", "buyer_id"),
    )

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False
    )
    buyer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    original_unit_price: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="USD", nullable=False)
    original_moq: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    target_price: Mapped[float] = mapped_column(Float, nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    ai_suggested_message: Mapped[str] = mapped_column(Text, nullable=False)
    final_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="draft", nullable=False)  # draft, sent, cancelled

    linked_thread_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("threads.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    conversation: Mapped["AIConversation"] = relationship("AIConversation", back_populates="negotiation_drafts")
    product: Mapped["Product"] = relationship("Product")
    supplier: Mapped["Supplier"] = relationship("Supplier")
    buyer: Mapped["User"] = relationship("User")
    linked_thread: Mapped[Optional["Thread"]] = relationship("Thread")
