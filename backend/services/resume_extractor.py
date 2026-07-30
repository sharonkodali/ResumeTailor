"""
Turn the plain text of a resume into structured Vault entries.

resume_parser.py recovers the text; this module gives it shape. The model does
the structuring when a key is available, and a heuristic pass covers the case
where it is not — an imperfect split of the user's real text is far more useful
here than placeholder data they might import into their Vault by mistake.
"""

import os
import re
from typing import List

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel

load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key) if api_key else None

# Mirrors the category <select> on the Vault page. Anything the model invents
# outside this set is mapped back onto it before it reaches the database.
CATEGORIES = ("Work", "Project", "Research", "Leadership")


class ExtractedBullet(BaseModel):
    text: str
    skills: str = ""  # comma-separated, matching BulletPoint.skills


class ExtractedExperience(BaseModel):
    company: str
    role: str
    dates: str = ""
    category: str = "Work"
    bullets: List[ExtractedBullet] = []


class ExtractedResume(BaseModel):
    """The model's response schema — kept free of metadata fields it must not fill."""

    experiences: List[ExtractedExperience] = []


class ExtractionResult(BaseModel):
    resume: ExtractedResume
    # False when the heuristic fallback ran, so the UI can warn that the split
    # is approximate and worth reviewing before import.
    used_ai: bool


SYSTEM_PROMPT = (
    "You extract structured work history from resume text. "
    "Return every distinct role, project, research position, and leadership "
    "position you find, each with its own bullet points.\n"
    "Rules:\n"
    "1. Copy bullet text verbatim from the resume. Do not rewrite, embellish, "
    "or invent accomplishments — a later step handles rewriting.\n"
    "2. 'category' must be exactly one of: Work, Project, Research, Leadership.\n"
    "3. 'skills' is a comma-separated list of technologies named in or clearly "
    "implied by that single bullet. Leave it empty if none apply.\n"
    "4. 'dates' should read as it does on the resume, e.g. 'Jun 2024 - Present'.\n"
    "5. For projects with no employer, use the project name as 'company'.\n"
    "6. Skip education, skills lists, and awards sections — those are not experiences."
)


def extract_experiences(resume_text: str) -> ExtractionResult:
    """
    Structure resume text into experiences. Never raises: on any model failure
    it falls back to the heuristic split so the upload still returns something
    the user can edit.
    """
    if client is None:
        return ExtractionResult(resume=_heuristic_extract(resume_text), used_ai=False)

    try:
        parsed = _call_model(resume_text)
    except Exception:
        # Quota, rate limits, network — none of it should cost the user the upload.
        parsed = None

    if parsed is None:
        return ExtractionResult(resume=_heuristic_extract(resume_text), used_ai=False)

    normalized = _normalize(parsed)
    if not normalized.experiences:
        # The model answered but found nothing; the heuristic may still see
        # structure, and an empty result is no worse than what we already have.
        return ExtractionResult(resume=_heuristic_extract(resume_text), used_ai=False)

    return ExtractionResult(resume=normalized, used_ai=True)


def _call_model(resume_text: str) -> ExtractedResume | None:
    completion = client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"RESUME TEXT:\n{resume_text}"},
        ],
        response_format=ExtractedResume,
    )
    return completion.choices[0].message.parsed


def _normalize(resume: ExtractedResume) -> ExtractedResume:
    """Drop empty entries and force categories into the four the UI knows about."""
    cleaned: List[ExtractedExperience] = []

    for exp in resume.experiences:
        bullets = [
            ExtractedBullet(text=b.text.strip(), skills=(b.skills or "").strip())
            for b in exp.bullets
            if b.text and b.text.strip()
        ]
        company = (exp.company or "").strip()
        role = (exp.role or "").strip()

        # An entry with no identity and no content is noise, not an experience.
        if not company and not role and not bullets:
            continue

        cleaned.append(
            ExtractedExperience(
                company=company or "Unknown",
                role=role or "Unknown",
                dates=(exp.dates or "").strip(),
                category=_coerce_category(exp.category),
                bullets=bullets,
            )
        )

    return ExtractedResume(experiences=cleaned)


def _coerce_category(value: str) -> str:
    candidate = (value or "").strip().lower()
    for category in CATEGORIES:
        if candidate == category.lower():
            return category
    # "Work Experience", "Professional Experience", "Side Projects", ...
    for category in CATEGORIES:
        if category.lower() in candidate:
            return category
    return "Work"


# ---------------------------------------------------------------------------
# Keyless fallback
# ---------------------------------------------------------------------------

# Section headers that introduce experiences, mapped to the category they imply.
_SECTION_CATEGORIES = {
    "experience": "Work",
    "employment": "Work",
    "work history": "Work",
    "internship": "Work",
    "project": "Project",
    "research": "Research",
    "publication": "Research",
    "leadership": "Leadership",
    "activities": "Leadership",
    "volunteer": "Leadership",
}

# Sections whose contents are not experiences and should be skipped wholesale.
_SKIP_SECTIONS = (
    "education",
    "skills",
    "coursework",
    "awards",
    "honors",
    "certification",
    "interests",
    "summary",
    "objective",
)

_BULLET_PREFIX = re.compile(r"^\s*[-•*·‣▪o]\s+")

# One end of a date range: "Jun 2022", "Summer 2021", "2024", "Present".
_DATE_POINT = (
    r"(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|summer|fall|autumn"
    r"|winter|spring)[a-z]*\.?\s*)?(?:19|20)\d{2}|present|current"
)
_DATE_SPAN = re.compile(
    rf"(?:{_DATE_POINT})(?:\s*(?:[-–—]|to)\s*(?:{_DATE_POINT}))?", re.IGNORECASE
)


def _heuristic_extract(resume_text: str) -> ExtractedResume:
    """
    Split text into experiences without a model.

    The shape it relies on is near-universal in resumes: a section header, then
    for each entry a heading line naming company/role/dates, then bullets.
    """
    experiences: List[ExtractedExperience] = []
    category = "Work"
    in_skipped_section = False
    current: ExtractedExperience | None = None

    for raw_line in resume_text.split("\n"):
        line = raw_line.strip()
        if not line:
            continue

        section = _section_for(line)
        if section is not None:
            category, in_skipped_section = section
            current = None
            continue

        if in_skipped_section:
            continue

        bullet_match = _BULLET_PREFIX.match(line)
        if bullet_match:
            if current is None:
                # Bullets before any heading still belong somewhere.
                current = ExtractedExperience(
                    company="Unknown", role="Unknown", category=category
                )
                experiences.append(current)
            current.bullets.append(
                ExtractedBullet(text=line[bullet_match.end():].strip())
            )
            continue

        # A non-bullet line starts a new entry.
        current = _heading_to_experience(line, category)
        experiences.append(current)

    # Headings with no bullets under them are usually stray prose, not entries.
    return _normalize(
        ExtractedResume(experiences=[e for e in experiences if e.bullets])
    )


def _section_for(line: str) -> tuple[str, bool] | None:
    """Return (category, is_skipped) if the line looks like a section header."""
    # Headers are short and standalone; a sentence mentioning "projects" is not one.
    if len(line) > 40 or line.endswith("."):
        return None

    lowered = line.lower().strip(" :|-—_")

    for name in _SKIP_SECTIONS:
        if lowered == name or lowered.startswith(name + " "):
            return ("Work", True)

    for keyword, category in _SECTION_CATEGORIES.items():
        if keyword in lowered:
            return (category, False)

    return None


def _heading_to_experience(line: str, category: str) -> ExtractedExperience:
    """
    Read company / role / dates out of an entry heading.

    Headings arrive as "Company | Role | Dates" or "Company, Role - Dates"
    depending on the template, so split on whichever separator is present.

    The date range comes out first: "Jun 2022 - Aug 2024" contains the same
    dash that separates fields, so splitting before lifting it out would tear
    the range in half.
    """
    dates = ""
    span = _DATE_SPAN.search(line)
    if span:
        dates = span.group(0).strip()
        line = line[: span.start()] + " | " + line[span.end() :]

    parts = [
        p.strip()
        for p in re.split(r"\s*[|·•]\s*|\s{2,}|\s+[-–—]\s+", line)
        if p.strip()
    ]

    company = parts[0] if parts else "Unknown"
    role = parts[1] if len(parts) > 1 else "Unknown"

    return ExtractedExperience(
        company=company, role=role, dates=dates, category=category
    )
