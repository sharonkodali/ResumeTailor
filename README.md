# ResumeTailor

An AI-powered resume tailoring tool with two workflows built on a shared
data layer: a structured career-history "Vault," and a LaTeX-aware tailoring
engine that rewrites resume bullets in place without touching document
structure.

**[Live demo](https://resume-tailor-seven-zeta.vercel.app)**

## What it does

1. **The Vault** — a structured store of your career history (experiences,
   dates, categories, skill-tagged bullets). Hand-enter data, or upload an
   existing PDF/DOCX/TeX resume to have it parsed and auto-structured.
2. **Plain-text tailoring** — paste a job description; get back rewritten
   bullets targeted to it, an ATS match score, extracted keywords, and
   per-bullet reasoning.
3. **LaTeX tailoring** — upload your actual .tex resume (or generate one
   from the Vault), then tailor it in place: the model rewrites only bullet
   text, which is spliced back at exact character offsets so the preamble,
   macros, and formatting come through byte-identical. Renders a side-by-side
   diff and compiles a live PDF preview via `tectonic`.

## Why offset-splicing instead of full-document generation

Asking a model to emit an entire .tex file produces documents that don't
compile and diffs no one can review. [`latex_tailor.py`](backend/services/latex_tailor.py) never lets the
model touch document structure — it only ever rewrites bullet text at known
offsets, so the output is guaranteed to still compile.

## Tech stack

| Layer     | What it is |
|-----------|-----------|
| Frontend  | Next.js 16.2 (App Router), React 19, TypeScript (strict mode), Tailwind v4, framer-motion |
| Backend   | Python / FastAPI, SQLAlchemy 2.0 ORM, Pydantic v2 — 18 REST endpoints |
| Database  | SQLite via SQLAlchemy, relational schema with FK cascade |
| AI        | OpenAI gpt-4o-mini with structured Pydantic response parsing |
| Tests     | pytest — 96 tests passing |

## Setup

**Backend** (Python 3.10+, run from inside `backend/`):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env              # add your OPENAI_API_KEY
uvicorn main:app --reload         # http://localhost:8000, docs at /docs
```

Optional: `brew install tectonic` to enable live PDF preview.

**Frontend:**

```bash
cd frontend
npm install
cp .env.local.example .env.local  # points at http://localhost:8000
npm run dev                       # http://localhost:3000
```

**Tests:** `cd backend && python -m pytest`

See [backend/README.md](backend/README.md) for API details and setup quirks.
