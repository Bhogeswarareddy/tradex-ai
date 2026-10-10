from datetime import datetime, timezone
from typing import Any, Dict, Generic, List, Optional, Sequence, Tuple, Type, TypeVar, Union
from uuid import UUID
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from app.models.base import Base, SoftDeleteMixin
from app.schemas.pagination import PaginatedResponse, PaginationParams

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """Generic base repository providing async CRUD, pagination, filtering and soft-delete."""

    def __init__(self, model: Type[ModelType], session: AsyncSession) -> None:
        self.model = model
        self.session = session

    async def get(self, id: Union[UUID, str], include_deleted: bool = False) -> Optional[ModelType]:
        stmt = select(self.model).where(self.model.id == id)
        if not include_deleted and issubclass(self.model, SoftDeleteMixin):
            stmt = stmt.where(self.model.deleted_at.is_(None))
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def list(
        self,
        params: PaginationParams,
        filters: Optional[Dict[str, Any]] = None,
        order_by: Optional[InstrumentedAttribute] = None,
        descending: bool = True,
        include_deleted: bool = False,
    ) -> PaginatedResponse[ModelType]:
        # Base query
        stmt = select(self.model)
        count_stmt = select(func.count()).select_from(self.model)

        # Soft delete handling
        if not include_deleted and issubclass(self.model, SoftDeleteMixin):
            stmt = stmt.where(self.model.deleted_at.is_(None))
            count_stmt = count_stmt.where(self.model.deleted_at.is_(None))

        # Dynamic equality filters
        if filters:
            for field_name, value in filters.items():
                if hasattr(self.model, field_name) and value is not None:
                    col = getattr(self.model, field_name)
                    stmt = stmt.where(col == value)
                    count_stmt = count_stmt.where(col == value)

        # Total count
        total_result = await self.session.execute(count_stmt)
        total = total_result.scalar_one()

        # Sorting
        if order_by is not None:
            stmt = stmt.order_by(order_by.desc() if descending else order_by.asc())
        elif hasattr(self.model, "created_at"):
            stmt = stmt.order_by(getattr(self.model, "created_at").desc())

        # Pagination offset and limit
        stmt = stmt.offset(params.offset).limit(params.page_size)
        items_result = await self.session.execute(stmt)
        items: Sequence[ModelType] = items_result.scalars().all()

        return PaginatedResponse.create(items=list(items), total=total, params=params)

    async def create(self, attributes: Dict[str, Any]) -> ModelType:
        instance = self.model(**attributes)
        self.session.add(instance)
        await self.session.commit()
        await self.session.refresh(instance)
        return instance

    async def update(self, id: Union[UUID, str], attributes: Dict[str, Any]) -> Optional[ModelType]:
        instance = await self.get(id)
        if not instance:
            return None

        for key, value in attributes.items():
            if hasattr(instance, key):
                setattr(instance, key, value)

        if hasattr(instance, "updated_at"):
            setattr(instance, "updated_at", datetime.now(timezone.utc))

        await self.session.commit()
        await self.session.refresh(instance)
        return instance

    async def soft_delete(self, id: Union[UUID, str]) -> bool:
        """Marks deleted_at timestamp if model supports soft delete."""
        instance = await self.get(id)
        if not instance:
            return False

        if issubclass(self.model, SoftDeleteMixin):
            instance.deleted_at = datetime.now(timezone.utc)
            await self.session.commit()
            return True
        else:
            # Fall back to hard delete if model has no soft delete
            await self.session.delete(instance)
            await self.session.commit()
            return True
