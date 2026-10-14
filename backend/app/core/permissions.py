"""
Permissions & Ownership Enforcement Service (Prompt 14)

Provides:
- RoleEnum: canonical ADMIN, SUPPLIER, BUYER roles.
- require_roles(*allowed_roles): dependency checking user role against allowed roles.
- assert_owns(user, resource, resource_type): object-level ownership check.
- audit_log(...): helper to record append-only audit log rows.
"""
import uuid
from enum import Enum
from typing import Any, Callable, Dict, Optional, Sequence
from fastapi import Depends, Request
from sqlalchemy import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.errors import PermissionDeniedError
from app.models.ai_ops import AuditLog
from app.models.identity import User


class RoleEnum(str, Enum):
    ADMIN = "admin"
    SUPPLIER = "supplier"
    BUYER = "buyer"


CANONICAL_ROLES = {RoleEnum.ADMIN.value, RoleEnum.SUPPLIER.value, RoleEnum.BUYER.value}


def normalize_role(role_str: Optional[str]) -> str:
    """Maps legacy/variant role strings onto canonical ADMIN, SUPPLIER, BUYER."""
    if not role_str:
        return RoleEnum.BUYER.value
    clean = role_str.strip().lower()
    if clean in ("admin", "administrator"):
        return RoleEnum.ADMIN.value
    if clean in ("supplier", "exporter", "seller", "vendor"):
        return RoleEnum.SUPPLIER.value
    if clean in ("buyer", "importer", "customer"):
        return RoleEnum.BUYER.value
    return clean


def require_roles(*allowed_roles: str) -> Callable:
    """
    Dependency factory declaring which roles may access an endpoint.
    Denies by default if current user does not hold an authorized role.
    """
    normalized_allowed = [normalize_role(r) for r in allowed_roles]

    async def role_dependency(current_user: User = Depends(get_current_user)) -> User:
        user_role = normalize_role(current_user.role)
        if user_role not in normalized_allowed:
            raise PermissionDeniedError(
                f"Role '{user_role}' is not authorized to access this resource. Required: {', '.join(allowed_roles)}"
            )
        return current_user

    return role_dependency


def assert_owns(
    user: User,
    resource: Any,
    resource_type: str = "resource",
    owner_id_field: str = "user_id",
) -> None:
    """
    Verifies that the given user owns the resource or has an ADMIN role.
    Raises PermissionDeniedError on IDOR attempt.
    """
    if not user:
        raise PermissionDeniedError("Authentication required")

    # Admins possess global oversight
    if normalize_role(user.role) == RoleEnum.ADMIN.value:
        return

    user_id = getattr(user, "id", None)
    if not user_id:
        raise PermissionDeniedError("Invalid user context")

    # Check direct owner_id_field on resource (e.g. user_id, buyer_id, supplier_id)
    owner_id = getattr(resource, owner_id_field, None)
    if owner_id is not None:
        if str(owner_id) == str(user_id):
            return

    # Check if resource has buyer / supplier association matching user
    if hasattr(resource, "buyer") and getattr(resource.buyer, "user_id", None):
        if str(resource.buyer.user_id) == str(user_id):
            return

    if hasattr(resource, "supplier") and getattr(resource.supplier, "user_id", None):
        if str(resource.supplier.user_id) == str(user_id):
            return

    # Check if resource is Order with buyer_id/supplier_id matching user's buyer/supplier profile
    if hasattr(user, "buyers") and user.buyers:
        buyer_ids = {str(b.id) for b in user.buyers}
        res_buyer_id = getattr(resource, "buyer_id", None)
        if res_buyer_id and str(res_buyer_id) in buyer_ids:
            return

    if hasattr(user, "suppliers") and user.suppliers:
        supplier_ids = {str(s.id) for s in user.suppliers}
        res_supplier_id = getattr(resource, "supplier_id", None)
        if res_supplier_id and str(res_supplier_id) in supplier_ids:
            return

    raise PermissionDeniedError(
        f"Access denied: you do not have ownership permission to access or modify this {resource_type}"
    )


async def record_audit_log(
    db: AsyncSession,
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    user_id: Optional[uuid.UUID] = None,
    ip_address: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> AuditLog:
    """Writes an append-only audit log row for auditable administrative and security actions."""
    audit_entry = AuditLog(
        id=uuid.uuid4(),
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id else None,
        ip_address=ip_address,
        details=details or {},
    )
    db.add(audit_entry)
    await db.commit()
    return audit_entry
