import uuid
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
from app.core.security import validate_password_strength


class UserRegisterRequest(BaseModel):
    email: EmailStr = Field(..., description="User unique email address")
    password: str = Field(..., min_length=10, description="Password (min 10 chars, 1 digit)")
    full_name: str = Field(..., min_length=2, max_length=100, description="Full name of contact")
    role: str = Field(default="buyer", description="Role: 'buyer' or 'supplier'")
    company_name: str = Field(..., min_length=2, max_length=150, description="Registered company name")
    country: str = Field(..., min_length=2, max_length=100, description="Country of business incorporation")

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        valid, msg = validate_password_strength(v)
        if not valid:
            raise ValueError(msg)
        return v

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        cleaned = v.lower().strip()
        if cleaned in ("admin", "administrator"):
            raise ValueError("Public registration cannot create ADMIN accounts")
        if cleaned not in {"buyer", "supplier"}:
            raise ValueError("Role must be 'buyer' or 'supplier'")
        return cleaned


class UserLoginRequest(BaseModel):
    email: EmailStr = Field(..., description="Registered email address")
    password: str = Field(..., description="Account password")


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: Optional[str]
    role: str
    is_active: bool
    email_verified: bool
    company_name: Optional[str] = None
    company_id: Optional[uuid.UUID] = None
    company_country: Optional[str] = None
    company_city: Optional[str] = None
    company_website: Optional[str] = None
    company_description: Optional[str] = None
    company_years_in_business: Optional[int] = None
    verified_status: Optional[str] = "unverified"
    settings: Optional[dict] = None

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int = 900  # 15 minutes in seconds
    user: UserResponse


class VerifyEmailRequest(BaseModel):
    token: str = Field(..., description="Email verification token")


class ForgotPasswordRequest(BaseModel):
    email: EmailStr = Field(..., description="Registered email to receive password reset instructions")


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., description="Password reset verification token")
    new_password: str = Field(..., min_length=10, description="New password (min 10 chars, 1 digit)")

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        valid, msg = validate_password_strength(v)
        if not valid:
            raise ValueError(msg)
        return v


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=10, description="New password (min 10 chars, 1 digit)")

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        valid, msg = validate_password_strength(v)
        if not valid:
            raise ValueError(msg)
        return v


class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    company_name: Optional[str] = Field(None, min_length=2, max_length=150)
    country: Optional[str] = Field(None, min_length=2, max_length=100)
    city: Optional[str] = Field(None, min_length=2, max_length=100)
    website: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    years_in_business: Optional[int] = Field(None, ge=0)


class UserSettingsUpdateRequest(BaseModel):
    notifications: Optional[dict] = None
    currency: Optional[str] = Field(None, max_length=10)
    language: Optional[str] = Field(None, max_length=10)
    theme: Optional[str] = Field(None, max_length=10)
