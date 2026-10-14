import uuid
from datetime import datetime, timezone
from typing import Optional
from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AISearch(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "ai_searches"

    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    query: Mapped[str] = mapped_column(Text, nullable=False)
    filters: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    requirement: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    results_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    execution_time_ms: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)


class AILog(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "ai_logs"
    __table_args__ = (
        Index("idx_ai_logs_feature", "feature_name"),
        Index("idx_ai_logs_created_at", "created_at"),
    )

    feature_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    prompt_name: Mapped[str] = mapped_column(String(100), nullable=False)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    latency_ms: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    success: Mapped[bool] = mapped_column(Integer, default=1, nullable=False)
    fallback: Mapped[bool] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)


class AIRecommendation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "ai_recommendations"
    __table_args__ = (
        Index("idx_ai_recs_user_entity", "user_id", "entity_type", "entity_id"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)  # 'supplier' or 'product'
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    reasoning: Mapped[str] = mapped_column(Text, nullable=False)


from typing import List, Optional
from sqlalchemy.orm import Mapped, mapped_column, relationship


class KnowledgeDocument(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "knowledge_documents"
    __table_args__ = (
        Index("idx_knowledge_docs_source", "source_type", "source_id"),
        Index("idx_knowledge_docs_product", "product_id"),
        Index("idx_knowledge_docs_supplier", "supplier_id"),
        Index("idx_knowledge_docs_visibility", "visibility"),
        Index("idx_knowledge_docs_content_hash", "content_hash"),
    )

    source_type: Mapped[str] = mapped_column(String(50), nullable=False)  # product, company, certificate_document, trade_guide, faq
    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    product_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=True, index=True
    )
    supplier_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=True, index=True
    )
    visibility: Mapped[str] = mapped_column(String(50), default="public", nullable=False)  # public, supplier_private, admin_only
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)  # active, inactive, stale
    content_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    embedding_model: Mapped[str] = mapped_column(String(100), default="mock-embed-v1", nullable=False)

    chunks: Mapped[List["KnowledgeChunk"]] = relationship("KnowledgeChunk", back_populates="document", cascade="all, delete-orphan")


class KnowledgeChunk(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "knowledge_chunks"
    __table_args__ = (
        Index("idx_knowledge_chunks_entity", "entity_type", "entity_id"),
        Index("idx_knowledge_chunks_guide_slug", "guide_slug"),
        Index("idx_knowledge_chunks_is_public", "is_public"),
        Index("idx_knowledge_chunks_company_id", "company_id"),
        Index("idx_knowledge_chunks_document_id", "document_id"),
        Index("idx_knowledge_chunks_is_active", "is_active"),
    )

    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("knowledge_documents.id", ondelete="CASCADE"), nullable=True, index=True
    )
    document: Mapped[Optional["KnowledgeDocument"]] = relationship("KnowledgeDocument", back_populates="chunks")
    entity_type: Mapped[str] = mapped_column(String(50), default="guide", nullable=False)  # 'guide', 'supplier', 'product', 'spec'
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    embedding = mapped_column(Vector(1536), nullable=True)
    chunk_metadata: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)
    guide_slug: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    source_uri: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    embedding_model: Mapped[Optional[str]] = mapped_column(String(100), default="mock-embed-v1", nullable=True)
    company_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=True, index=True
    )



class MarketInsight(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "market_insights"
    __table_args__ = (
        Index("idx_market_insights_commodity", "commodity"),
    )

    commodity: Mapped[str] = mapped_column(String(100), nullable=False)
    region: Mapped[str] = mapped_column(String(100), nullable=False)
    price_trend: Mapped[str] = mapped_column(String(50), default="stable", nullable=False)  # 'bullish', 'bearish', 'stable'
    commentary: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(150), nullable=False)
    published_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class AuditLog(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("idx_audit_logs_action", "action"),
        Index("idx_audit_logs_entity", "entity_type", "entity_id"),
    )

    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    details: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)


class SystemSetting(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    value: Mapped[dict] = mapped_column(JSONB, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
