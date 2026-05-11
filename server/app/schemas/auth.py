"""Pydantic schemas for auth request and response bodies."""

from pydantic import BaseModel, EmailStr, UUID4, field_validator, model_validator
from typing import Optional
from datetime import datetime


class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    confirm_password: str

    @field_validator("password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @model_validator(mode="after")
    def passwords_match(self) -> "RegisterRequest":
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    first_name: Optional[str] = None
    onboarding_completed: bool = False


class UserProfileUpdate(BaseModel):
    """PATCH body for /api/auth/me — all fields optional so callers update one at a time."""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    university: Optional[str] = None
    graduation_year: Optional[int] = None
    skills_summary: Optional[str] = None


class UserProfileResponse(BaseModel):
    id: UUID4
    email: EmailStr
    first_name: Optional[str]
    last_name: Optional[str]
    full_name: Optional[str]
    phone: Optional[str]
    location: Optional[str]
    linkedin_url: Optional[str]
    portfolio_url: Optional[str]
    university: Optional[str]
    graduation_year: Optional[int]
    skills_summary: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
