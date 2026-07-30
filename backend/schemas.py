from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class BulletPointCreate(BaseModel):
    text: str
    skills: Optional[str] = ""


class BulletPointResponse(BulletPointCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    experience_id: int


class ExperienceCreate(BaseModel):
    company: str
    role: str
    # Optional on the Vault form and often absent from a parsed resume.
    dates: str = ""
    category: str = "Work"
    bullets: List[BulletPointCreate] = []


class ExperienceResponse(ExperienceCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    bullets: List[BulletPointResponse] = []


class ExperienceBulkCreate(BaseModel):
    """Body for importing several experiences at once, e.g. from a resume upload."""

    experiences: List[ExperienceCreate] = []


class ResumeUploadResponse(BaseModel):
    """
    What an upload produces: a proposal, not a commit. The user reviews these
    experiences and POSTs the ones they want to /api/experiences/bulk.
    """

    filename: str
    # False when the file was structured heuristically because the model was
    # unavailable, which is worth surfacing as a "check this" hint in the UI.
    ai_structured: bool
    experiences: List[ExperienceCreate] = []


class TailorRequest(BaseModel):
    job_description: str