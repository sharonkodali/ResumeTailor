# Backend — ResumeTailor API

FastAPI service holding the Master Vault, the resume parsing pipeline, and the
two tailoring paths (plain-text bullets and in-place LaTeX rewriting).

## Layout

| Path | What it holds |
| --- | --- |
| `main.py` | All 18 HTTP endpoints; the only module the frontend talks to |
| `models.py` | SQLAlchemy tables — `Experience`, `BulletPoint`, `ResumeSource` |
| `schemas.py` | Pydantic request/response shapes |
| `database.py` | Engine, session factory, and the `get_db` dependency |
| `services/resume_parser.py` | Uploaded `.pdf` / `.docx` / `.tex` → plain text |
| `services/resume_extractor.py` | Plain text → structured Vault entries |
| `services/ai_tailor.py` | Rewrites Vault bullets against a job description |
| `services/latex_tailor.py` | Rewrites bullets *inside* a `.tex` at exact character offsets |
| `services/latex_builder.py` | Builds a `.tex` resume from Vault contents |
| `services/latex_compiler.py` | Renders `.tex` → PDF via `tectonic` |

## Running it standalone

Requires Python 3.10+ (developed on 3.13).

```bash
cd backend
python -m pip install -r requirements.txt
uvicorn main:app --reload
```

Serves on `http://localhost:8000`. Interactive API docs at `/docs`.

**Run it from inside `backend/`.** Two things depend on the working directory:
`main.py` imports its siblings as top-level modules (`import models`), and the
database URL is relative (`sqlite:///./vault.db`), so launching from the repo
root creates a second, empty `vault.db` one level up.

The SQLite file is created on first start — there are no migrations, and
`Base.metadata.create_all` only ever *adds* missing tables. If you change a
column on an existing table, delete `vault.db` and let it be rebuilt.

## Setup quirks

**`OPENAI_API_KEY`** goes in `backend/.env` (gitignored, loaded via
`python-dotenv`). Nothing crashes without it, but the three AI-backed features
degrade differently — worth knowing before you conclude something is broken:

| Without a key | Behaviour |
| --- | --- |
| `POST /api/tailor` | Fails with a readable error. It will not invent bullets — a rewrite the candidate never earned is worse than none, and the UI cannot tell the two apart. |
| `POST /api/resume/tailor-latex` | Returns the document untouched with `ai_tailored: false`. |
| `POST /api/resume/upload` | Still works. Falls back to heuristic parsing of the real text. |

**`tectonic`** is optional and only needed for PDF preview
(`brew install tectonic`). Without it, `GET /api/resume/compiler` reports
unavailable and the UI hides the preview rather than erroring. It is preferred
over a full TeX Live because it is self-contained and runs with shell-escape
disabled, so compiling an uploaded document cannot execute host commands.

**`python-multipart`** is not optional despite looking like a transitive
dependency — without it every `UploadFile` endpoint fails at import time.

**CORS** is pinned to `http://localhost:3000` and `:3001` in `main.py`. Point
the frontend at a deployed backend and you will need to widen this.

## Tests

```bash
cd backend
python -m pytest
```

96 tests. No network and no API key required — the model client is stubbed
out, and the suite passes with `backend/.env` absent entirely. The five
compile tests skip themselves when no LaTeX engine is installed.

The bulk of them cover LaTeX bullet-finding, escaping, and offset splicing,
which is where the subtle breakage lives.

## Endpoints

| Method | Path |
| --- | --- |
| GET | `/` |
| POST | `/api/experiences` |
| POST | `/api/experiences/bulk` |
| GET | `/api/experiences` |
| PUT | `/api/experiences/{experience_id}` |
| DELETE | `/api/experiences/{experience_id}` |
| POST | `/api/resume/upload` |
| GET | `/api/resume/supported-types` |
| GET | `/api/resume/sources` |
| GET | `/api/resume/sources/{source_id}` |
| POST | `/api/resume/sources` |
| POST | `/api/resume/sources/upload` |
| DELETE | `/api/resume/sources/{source_id}` |
| POST | `/api/resume/generate` |
| POST | `/api/resume/tailor-latex` |
| GET | `/api/resume/compiler` |
| POST | `/api/resume/compile` |
| POST | `/api/tailor` |
