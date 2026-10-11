import uuid
from datetime import date
from sqlalchemy import Date, Float, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class MarketSeries(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "market_series"
    __table_args__ = (
        Index("idx_market_series_product_date", "product", "date"),
        Index("idx_market_series_category_date", "category", "date"),
        Index("idx_market_series_destination_date", "destination", "date"),
    )

    product: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    destination: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    demand_index: Mapped[float] = mapped_column(Float, nullable=False)
    avg_price: Mapped[float] = mapped_column(Float, nullable=False)
    volume: Mapped[float] = mapped_column(Float, nullable=False)
