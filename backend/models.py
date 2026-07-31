from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class Experience(Base):
    __tablename__ = "experiences"

    id = Column(Integer, primary_key=True, index=True)
    company = Column(String, nullable=False)
    role = Column(String, nullable=False)
    dates = Column(String)
    category = Column(String)  # Work, Project, Research, Leadership

    bullets = relationship("BulletPoint", back_populates="experience", cascade="all, delete-orphan")

class BulletPoint(Base):
    __tablename__ = "bullet_points"

    id = Column(Integer, primary_key=True, index=True)
    experience_id = Column(Integer, ForeignKey("experiences.id"))
    text = Column(Text, nullable=False)
    skills = Column(String)  # Comma-separated tags e.g. "Python, SQL, FastApi"

    experience = relationship("Experience", back_populates="bullets")


class ResumeSource(Base):
    """
    A base LaTeX resume to tailor from — either an uploaded .tex or one built
    from the Vault. The source is stored verbatim so tailoring can splice
    rewritten bullets back into the user's own template.
    """

    __tablename__ = "resume_sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    latex = Column(Text, nullable=False)
    created_at = Column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )