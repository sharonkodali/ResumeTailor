from datetime import datetime, timezone

from fastapi import FastAPI, Depends, File, HTTPException, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from dotenv import load_dotenv

from database import engine, Base, get_db
import models, schemas
from services import latex_compiler
from services.ai_tailor import tailor_resume_bullets
from services.latex_builder import build_resume
from services.latex_tailor import tailor_latex
from services.resume_extractor import extract_experiences
from services.resume_parser import SUPPORTED_EXTENSIONS, ResumeParseError, extract_text

# Load environment variables (e.g., OPENAI_API_KEY)
load_dotenv()

# Create SQLite database tables if they don't exist yet
Base.metadata.create_all(bind=engine)

app = FastAPI(title="ResumeTailor API")

# Configure CORS so your Next.js frontend (http://localhost:3000) can make requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
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

def _to_row(exp: schemas.ExperienceCreate) -> models.Experience:
    """Build an unsaved Experience row, bullets included, from a request body."""
    return models.Experience(
        company=exp.company,
        role=exp.role,
        dates=exp.dates,
        category=exp.category,
        bullets=[
            models.BulletPoint(text=bullet.text, skills=bullet.skills)
            for bullet in exp.bullets
        ],
    )


@app.post("/api/experiences", response_model=schemas.ExperienceResponse)
def create_experience(exp: schemas.ExperienceCreate, db: Session = Depends(get_db)):
    """
    Save a new experience (with its associated bullet points) to the Master Vault.
    """
    db_exp = _to_row(exp)
    db.add(db_exp)
    db.commit()
    db.refresh(db_exp)
    return db_exp


@app.post(
    "/api/experiences/bulk",
    response_model=List[schemas.ExperienceResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_experiences_bulk(
    payload: schemas.ExperienceBulkCreate, db: Session = Depends(get_db)
):
    """
    Import several experiences in one transaction — the commit step of a resume
    upload, after the user has reviewed what was extracted.
    """
    if not payload.experiences:
        raise HTTPException(status_code=400, detail="No experiences to import.")

    rows = [_to_row(exp) for exp in payload.experiences]
    db.add_all(rows)
    db.commit()
    for row in rows:
        db.refresh(row)
    return rows


@app.get("/api/experiences", response_model=List[schemas.ExperienceResponse])
def get_experiences(db: Session = Depends(get_db)):
    """
    Retrieve all stored experiences and bullet points from the Master Vault.
    """
    return db.query(models.Experience).all()


@app.put("/api/experiences/{experience_id}", response_model=schemas.ExperienceResponse)
def update_experience(
    experience_id: int,
    exp: schemas.ExperienceCreate,
    db: Session = Depends(get_db)
):
    """
    Replace an existing Vault entry. Bullets are swapped wholesale rather than
    diffed, so the request body is always the complete desired state.
    """
    db_exp = db.query(models.Experience).filter(models.Experience.id == experience_id).first()
    if db_exp is None:
        raise HTTPException(status_code=404, detail=f"Experience {experience_id} not found")

    db_exp.company = exp.company
    db_exp.role = exp.role
    db_exp.dates = exp.dates
    db_exp.category = exp.category

    # Reassigning the collection lets the delete-orphan cascade drop the old rows.
    db_exp.bullets = [
        models.BulletPoint(text=bullet.text, skills=bullet.skills)
        for bullet in exp.bullets
    ]

    db.commit()
    db.refresh(db_exp)
    return db_exp


@app.delete("/api/experiences/{experience_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_experience(experience_id: int, db: Session = Depends(get_db)):
    """
    Remove a Vault entry. Its bullet points go with it via the cascade.
    """
    db_exp = db.query(models.Experience).filter(models.Experience.id == experience_id).first()
    if db_exp is None:
        raise HTTPException(status_code=404, detail=f"Experience {experience_id} not found")

    db.delete(db_exp)
    db.commit()


# -------------------------------------------------------------------
# Resume Upload Endpoint
# -------------------------------------------------------------------

# A text resume is a few hundred KB at most; the ceiling is generous enough for
# an image-heavy PDF while still refusing files that were never a resume.
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
_UPLOAD_CHUNK = 64 * 1024


async def _read_upload(file: UploadFile) -> bytes:
    """Read the upload, aborting as soon as it exceeds the size ceiling."""
    chunks: List[bytes] = []
    total = 0

    while chunk := await file.read(_UPLOAD_CHUNK):
        total += len(chunk)
        if total > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail=f"That file is larger than {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
            )
        chunks.append(chunk)

    return b"".join(chunks)


@app.post("/api/resume/upload", response_model=schemas.ResumeUploadResponse)
async def upload_resume(file: UploadFile = File(...)):
    """
    Read an uploaded resume and propose Vault entries from it.

    Nothing is written to the database here. The response is a draft for the
    user to review and edit; importing it is a separate call to
    /api/experiences/bulk, so a bad parse never silently pollutes the Vault.
    """
    data = await _read_upload(file)
    if not data:
        raise HTTPException(status_code=400, detail="That file is empty.")

    try:
        text = extract_text(file.filename or "", data)
    except ResumeParseError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    result = extract_experiences(text)
    if not result.resume.experiences:
        raise HTTPException(
            status_code=422,
            detail=(
                "No experiences could be identified in that resume. "
                "You can still add entries manually."
            ),
        )

    return schemas.ResumeUploadResponse(
        filename=file.filename or "resume",
        ai_structured=result.used_ai,
        experiences=[
            schemas.ExperienceCreate(**exp.model_dump())
            for exp in result.resume.experiences
        ],
    )


@app.get("/api/resume/supported-types")
def supported_resume_types():
    """Lets the frontend build its file picker from one source of truth."""
    return {"extensions": list(SUPPORTED_EXTENSIONS)}


# -------------------------------------------------------------------
# LaTeX Resume Sources
# -------------------------------------------------------------------

def _get_source(source_id: int, db: Session) -> models.ResumeSource:
    source = (
        db.query(models.ResumeSource)
        .filter(models.ResumeSource.id == source_id)
        .first()
    )
    if source is None:
        raise HTTPException(status_code=404, detail=f"Resume source {source_id} not found")
    return source


def _save_source(name: str, latex: str, db: Session) -> models.ResumeSource:
    source = models.ResumeSource(name=name, latex=latex)
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


@app.get("/api/resume/sources", response_model=List[schemas.ResumeSourceSummary])
def list_resume_sources(db: Session = Depends(get_db)):
    """Base resumes available to tailor from, newest first."""
    return (
        db.query(models.ResumeSource)
        .order_by(models.ResumeSource.created_at.desc(), models.ResumeSource.id.desc())
        .all()
    )


@app.get("/api/resume/sources/{source_id}", response_model=schemas.ResumeSourceResponse)
def get_resume_source(source_id: int, db: Session = Depends(get_db)):
    return _get_source(source_id, db)


@app.post(
    "/api/resume/sources",
    response_model=schemas.ResumeSourceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_resume_source(
    payload: schemas.ResumeSourceCreate, db: Session = Depends(get_db)
):
    """Store LaTeX pasted or edited in the browser as a reusable base."""
    if not payload.latex.strip():
        raise HTTPException(status_code=400, detail="That LaTeX source is empty.")
    return _save_source(payload.name or "Untitled resume", payload.latex, db)


@app.post(
    "/api/resume/sources/upload",
    response_model=schemas.ResumeSourceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_resume_source(
    file: UploadFile = File(...), db: Session = Depends(get_db)
):
    """
    Store an uploaded .tex verbatim.

    Unlike /api/resume/upload, which reduces a resume to text to mine it for
    Vault entries, this keeps the source byte-for-byte — tailoring has to splice
    rewrites back into the user's own template.
    """
    data = await _read_upload(file)
    if not data:
        raise HTTPException(status_code=400, detail="That file is empty.")

    filename = file.filename or "resume.tex"
    if not filename.lower().endswith(".tex"):
        raise HTTPException(
            status_code=400,
            detail="Tailoring needs LaTeX source. Upload a .tex file.",
        )

    try:
        latex = data.decode("utf-8")
    except UnicodeDecodeError:
        latex = data.decode("latin-1")

    if not latex.strip():
        raise HTTPException(status_code=400, detail="That .tex file has no content.")

    return _save_source(filename, latex, db)


@app.delete(
    "/api/resume/sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_resume_source(source_id: int, db: Session = Depends(get_db)):
    db.delete(_get_source(source_id, db))
    db.commit()


@app.post("/api/resume/generate", response_model=schemas.ResumeSourceResponse)
def generate_resume(
    payload: schemas.GenerateResumeRequest, db: Session = Depends(get_db)
):
    """Build a .tex from the Master Vault for someone with no resume yet."""
    experiences = db.query(models.Experience).all()
    if not experiences:
        raise HTTPException(
            status_code=400,
            detail="No experiences found in Master Vault. Add experiences first.",
        )

    latex = build_resume(
        payload.profile,
        [
            {
                "company": exp.company,
                "role": exp.role,
                "dates": exp.dates,
                "category": exp.category,
                "bullets": [{"text": b.text, "skills": b.skills} for b in exp.bullets],
            }
            for exp in experiences
        ],
    )

    if payload.save_as:
        return _save_source(payload.save_as, latex, db)

    # Unsaved drafts still need the response shape; id 0 marks "not stored".
    return schemas.ResumeSourceResponse(
        id=0,
        name="Generated from Vault",
        latex=latex,
        created_at=datetime.now(timezone.utc),
    )


# -------------------------------------------------------------------
# LaTeX Tailoring and Compilation
# -------------------------------------------------------------------

@app.post("/api/resume/tailor-latex", response_model=schemas.LatexTailorResponse)
def tailor_resume_latex(
    payload: schemas.LatexTailorRequest, db: Session = Depends(get_db)
):
    """
    Rewrite a resume's bullet points for a job description.

    Only bullet text changes; the template, header, and education sections are
    returned byte-identical, which is what keeps the diff reviewable and the
    document compilable.
    """
    if not payload.job_description.strip():
        raise HTTPException(status_code=400, detail="A job description is required.")

    if payload.source_id is not None:
        latex = _get_source(payload.source_id, db).latex
    elif payload.latex and payload.latex.strip():
        latex = payload.latex
    else:
        raise HTTPException(
            status_code=400,
            detail="Provide either source_id or latex to tailor.",
        )

    try:
        result = tailor_latex(latex, payload.job_description)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Tailoring failed: {exc}") from exc

    return schemas.LatexTailorResponse(**result.model_dump())


@app.get("/api/resume/compiler")
def compiler_status():
    """Lets the UI hide PDF preview when no LaTeX engine is installed."""
    return {
        "available": latex_compiler.is_available(),
        "engine": latex_compiler.engine_path(),
        "hint": None if latex_compiler.is_available() else latex_compiler.INSTALL_HINT,
    }


@app.post("/api/resume/compile")
def compile_resume(payload: schemas.CompileRequest):
    """Render LaTeX to a PDF for preview and download."""
    if not payload.latex.strip():
        raise HTTPException(status_code=400, detail="There is no LaTeX to compile.")

    if not latex_compiler.is_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=latex_compiler.INSTALL_HINT,
        )

    try:
        pdf = latex_compiler.compile_pdf(payload.latex)
    except latex_compiler.LatexCompileError as exc:
        # 422: the request was well-formed, the document itself is the problem.
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": 'inline; filename="resume.pdf"'},
    )


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
        resp = tailor_resume_bullets(req.job_description, raw_exps)

        # Normalize response keys to match frontend expectations:
        # Frontend expects tailored_bullets -> [{ original_text, tailored_text, reasoning }, ...]
        # Backend AI service returns TailorResponse with TailoredBullet items that may
        # include fields like original_bullet, tailored_bullet, impact_reasoning.
        if resp is None:
            return {
                "match_score": 0,
                "extracted_keywords": [],
                "tailored_bullets": [],
            }

        # If resp is a Pydantic model, access attributes; if dict, use keys.
        match_score = getattr(resp, "match_score", resp.get("match_score") if isinstance(resp, dict) else 0)
        extracted = getattr(resp, "extracted_keywords", resp.get("extracted_keywords") if isinstance(resp, dict) else [])
        bullets = getattr(resp, "tailored_bullets", resp.get("tailored_bullets") if isinstance(resp, dict) else [])

        # Convert Pydantic models to plain dicts when present so key lookups are consistent
        bullets_list = []
        for b in bullets:
            if hasattr(b, "dict"):
                try:
                    bullets_list.append(b.dict())
                except Exception:
                    bullets_list.append({})
            else:
                bullets_list.append(b if isinstance(b, dict) else {})

        normalized_bullets = []
        for b in bullets_list:
            original = b.get("original_bullet") or b.get("original_text") or ""
            tailored = b.get("tailored_bullet") or b.get("tailored_text") or ""
            reasoning = b.get("impact_reasoning") or b.get("reasoning") or ""

            normalized_bullets.append({
                "original_text": original,
                "tailored_text": tailored,
                "reasoning": reasoning,
            })

        return {
            "match_score": match_score or 0,
            "extracted_keywords": extracted or [],
            "tailored_bullets": normalized_bullets,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI Service Error: {str(e)}")