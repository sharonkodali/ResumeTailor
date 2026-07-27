from pydantic import BaseModel
from typing import List, Optional

class BulletPointCreate(BaseModel):
    text: str
    skills: Optional[str] = ""

class BulletPointResponse(BulletPointCreate):
    id: int
    experience_id: int
    class Config:
        from_attributes = True

class ExperienceCreate(BaseModel):
    company: str
    role: str
    dates: str
    category: str
    bullets: List[BulletPointCreate] = []

class ExperienceResponse(ExperienceCreate):
    id: int
    bullets: List[BulletPointResponse] = []
    class Config:
        from_attributes = True