from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict

from services.latex_builder import Profile


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


# -------------------------------------------------------------------
# LaTeX resume tailoring
# -------------------------------------------------------------------

class ResumeSourceSummary(BaseModel):
    """List view — omits the LaTeX body, which can be tens of KB per row."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    created_at: datetime


class ResumeSourceResponse(ResumeSourceSummary):
    latex: str


class ResumeSourceCreate(BaseModel):
    name: str
    latex: str


class GenerateResumeRequest(BaseModel):
    """Build a .tex from the Vault. Profile carries what the Vault cannot."""

    profile: Profile = Profile()
    # Save the result as a reusable source rather than only returning it.
    save_as: Optional[str] = None


class LatexTailorRequest(BaseModel):
    """
    Tailor either a stored source (source_id) or ad-hoc LaTeX (latex).

    Exactly one must be supplied; the endpoint rejects the request otherwise.
    """

    job_description: str
    source_id: Optional[int] = None
    latex: Optional[str] = None


class LatexChange(BaseModel):
    original: str
    tailored: str
    reasoning: str


class LatexTailorResponse(BaseModel):
    original_latex: str
    tailored_latex: str
    changes: List[LatexChange] = []
    match_score: int = 0
    extracted_keywords: List[str] = []
    ai_tailored: bool = True


class CompileRequest(BaseModel):
    latex: str