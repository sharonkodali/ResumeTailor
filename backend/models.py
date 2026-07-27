from sqlalchemy import Column, Integer, String, Text, ForeignKey
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