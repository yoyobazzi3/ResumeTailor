"""Pydantic schemas for resume bullets, sections, education, and tailored resumes."""

from pydantic import BaseModel, Field, UUID4
from typing import Optional
from datetime import datetime


class BulletCreate(BaseModel):
    content: str
    category: Optional[str] = None
    section_id: Optional[UUID4] = None


class BulletResponse(BaseModel):
    id: UUID4
    content: str
    category: Optional[str]
    section_id: Optional[UUID4]
    created_at: datetime
    model_config = {"from_attributes": True}


class TailorRequest(BaseModel):
    application_id: UUID4


class UploadPreviewExperience(BaseModel):
    company: str
    job_title: str


class UploadPreviewProject(BaseModel):
    name: str
    tech_stack: list[str]


class UploadPreviewEducation(BaseModel):
    institution: str
    degree: str
    graduation_year: Optional[int]


class UploadPreview(BaseModel):
    work_experience: list[UploadPreviewExperience]
    projects: list[UploadPreviewProject]
    education: list[UploadPreviewEducation]


class ResumeUploadResponse(BaseModel):
    work_experience_imported: int
    projects_imported: int
    education_imported: int
    skills_parsed: bool
    total_bullets_imported: int
    skills_summary: Optional[str]
    preview: UploadPreview


class BulletsEditRequest(BaseModel):
    edited_bullets: list[str]


class TailoredResumeResponse(BaseModel):
    id: UUID4
    application_id: UUID4
    original_bullets: list
    tailored_bullets: list
    edited_bullets: Optional[list]
    missing_keywords: Optional[list[str]]
    match_score: Optional[int]
    reasoning: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}


class ResumeSectionCreate(BaseModel):
    category_name: str
    job_title: Optional[str] = None
    company_location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    section_type: str = "experience"
    tech_stack: Optional[str] = None
    display_order: int = 0


class ResumeSectionUpdate(BaseModel):
    category_name: Optional[str] = None
    job_title: Optional[str] = None
    company_location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    section_type: Optional[str] = None
    tech_stack: Optional[str] = None
    display_order: Optional[int] = None


class ResumeSectionResponse(BaseModel):
    id: UUID4
    category_name: str
    job_title: Optional[str]
    company_location: Optional[str]
    start_date: Optional[str]
    end_date: Optional[str]
    section_type: str
    tech_stack: Optional[str]
    display_order: int
    bullets: list[BulletResponse] = Field(default_factory=list)
    model_config = {"from_attributes": True}


class EducationCreate(BaseModel):
    institution: str
    degree: str
    field_of_study: str
    graduation_year: int
    graduation_month: Optional[str] = None
    gpa: Optional[str] = None
    display_order: int = 0


class EducationUpdate(BaseModel):
    institution: Optional[str] = None
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    graduation_year: Optional[int] = None
    graduation_month: Optional[str] = None
    gpa: Optional[str] = None
    display_order: Optional[int] = None


class EducationResponse(BaseModel):
    id: UUID4
    institution: str
    degree: str
    field_of_study: str
    graduation_year: int
    graduation_month: Optional[str]
    gpa: Optional[str]
    display_order: int
    model_config = {"from_attributes": True}
