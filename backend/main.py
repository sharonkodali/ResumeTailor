from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from dotenv import load_dotenv

from database import engine, Base, get_db
import models, schemas
from services.ai_tailor import tailor_resume_bullets

# Load environment variables (e.g., OPENAI_API_KEY)
load_dotenv()

# Create SQLite database tables if they don't exist yet
Base.metadata.create_all(bind=engine)

app = FastAPI(title="ResumeTailor API")

# Configure CORS so your Next.js frontend (http://localhost:3000) can make requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"message": "ResumeTailor API is running!"}


# -------------------------------------------------------------------
# Master Vault Endpoints
# -------------------------------------------------------------------

@app.post("/api/experiences", response_model=schemas.ExperienceResponse)
def create_experience(exp: schemas.ExperienceCreate, db: Session = Depends(get_db)):
    """
    Save a new experience (with its associated bullet points) to the Master Vault.
    """
    db_exp = models.Experience(
        company=exp.company,
        role=exp.role,
        dates=exp.dates,
        category=exp.category
    )
    db.add(db_exp)
    db.commit()
    db.refresh(db_exp)

    for bullet in exp.bullets:
        db_bullet = models.BulletPoint(
            experience_id=db_exp.id,
            text=bullet.text,
            skills=bullet.skills
        )
        db.add(db_bullet)

    db.commit()
    db.refresh(db_exp)
    return db_exp


@app.get("/api/experiences", response_model=List[schemas.ExperienceResponse])
def get_experiences(db: Session = Depends(get_db)):
    """
    Retrieve all stored experiences and bullet points from the Master Vault.
    """
    return db.query(models.Experience).all()


# -------------------------------------------------------------------
# AI Tailoring Endpoint
# -------------------------------------------------------------------

@app.post("/api/tailor")
def tailor_resume(req: schemas.TailorRequest, db: Session = Depends(get_db)):
    """
    Take a job description, retrieve all Vault entries, and use OpenAI 
    to output structured, tailored bullet points + ATS match metrics.
    """
    experiences = db.query(models.Experience).all()
    if not experiences:
        raise HTTPException(
            status_code=400, 
            detail="No experiences found in Master Vault. Please add experiences to your vault first."
        )

    # Format database rows into a clean structure for the OpenAI prompt
    raw_exps = []
    for exp in experiences:
        raw_exps.append({
            "company": exp.company,
            "role": exp.role,
            "category": exp.category,
            "bullets": [b.text for b in exp.bullets]
        })

    try:
        return tailor_resume_bullets(req.job_description, raw_exps)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI Service Error: {str(e)}")