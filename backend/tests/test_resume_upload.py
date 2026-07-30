"""Structuring resume text into experiences, and the upload endpoint around it."""

import main
from conftest import make_pdf
from services import resume_extractor
from services.resume_extractor import (
    ExtractedBullet,
    ExtractedExperience,
    ExtractedResume,
    ExtractionResult,
    extract_experiences,
)

RESUME_TEXT = """
Jane Doe
jane@example.com

EXPERIENCE
Acme Corp | Backend Engineer | Jun 2022 - Aug 2024
- Built the payments API serving 2M requests per day
- Cut p99 latency by 40%

Globex | Data Intern | Summer 2021
- Shipped an ETL pipeline in Python

PROJECTS
ResumeTailor | Creator | 2026
- Built a FastAPI and Next.js app for tailoring resumes

EDUCATION
UC San Diego | B.S. Computer Science | 2027
- Relevant coursework: data structures, algorithms

SKILLS
Python, TypeScript, FastAPI
"""


def use_heuristic(monkeypatch):
    """Force the keyless path so extraction is deterministic and offline."""
    monkeypatch.setattr(resume_extractor, "client", None)


# ---------------------------------------------------------------------------
# Heuristic extraction
# ---------------------------------------------------------------------------

def test_heuristic_splits_sections_into_experiences(monkeypatch):
    use_heuristic(monkeypatch)

    result = extract_experiences(RESUME_TEXT)

    assert result.used_ai is False
    companies = [e.company for e in result.resume.experiences]
    assert companies == ["Acme Corp", "Globex", "ResumeTailor"]


def test_heuristic_reads_role_and_dates_off_the_heading(monkeypatch):
    use_heuristic(monkeypatch)

    acme = extract_experiences(RESUME_TEXT).resume.experiences[0]

    assert acme.role == "Backend Engineer"
    assert acme.dates == "Jun 2022 - Aug 2024"
    assert [b.text for b in acme.bullets] == [
        "Built the payments API serving 2M requests per day",
        "Cut p99 latency by 40%",
    ]


def test_heuristic_assigns_the_section_category(monkeypatch):
    use_heuristic(monkeypatch)

    experiences = extract_experiences(RESUME_TEXT).resume.experiences

    assert [e.category for e in experiences] == ["Work", "Work", "Project"]


def test_heuristic_skips_education_and_skills_sections(monkeypatch):
    use_heuristic(monkeypatch)

    experiences = extract_experiences(RESUME_TEXT).resume.experiences

    assert not any("San Diego" in e.company for e in experiences)
    assert not any("coursework" in b.text for e in experiences for b in e.bullets)


def test_heuristic_returns_nothing_for_text_with_no_experiences(monkeypatch):
    use_heuristic(monkeypatch)

    result = extract_experiences("Jane Doe\njane@example.com\n(555) 123-4567")

    assert result.resume.experiences == []


def test_model_output_is_normalized_into_the_four_ui_categories(monkeypatch):
    """Whatever the model calls a section, the Vault only knows four categories."""
    monkeypatch.setattr(resume_extractor, "client", object())
    monkeypatch.setattr(
        resume_extractor,
        "_call_model",
        lambda text: ExtractedResume(
            experiences=[
                ExtractedExperience(
                    company="Acme",
                    role="Engineer",
                    category="Work Experience",
                    bullets=[ExtractedBullet(text="Did the thing")],
                ),
                ExtractedExperience(
                    company="Side Thing",
                    role="Creator",
                    category="wizardry",
                    bullets=[ExtractedBullet(text="Made a thing")],
                ),
            ]
        ),
    )

    result = extract_experiences("irrelevant")

    assert result.used_ai is True
    assert [e.category for e in result.resume.experiences] == ["Work", "Work"]


def test_model_failure_falls_back_to_the_heuristic(monkeypatch):
    monkeypatch.setattr(resume_extractor, "client", object())

    def explode(text):
        raise RuntimeError("rate limited")

    monkeypatch.setattr(resume_extractor, "_call_model", explode)

    result = extract_experiences(RESUME_TEXT)

    assert result.used_ai is False
    assert [e.company for e in result.resume.experiences] == [
        "Acme Corp",
        "Globex",
        "ResumeTailor",
    ]


def test_blank_entries_are_dropped(monkeypatch):
    monkeypatch.setattr(resume_extractor, "client", object())
    monkeypatch.setattr(
        resume_extractor,
        "_call_model",
        lambda text: ExtractedResume(
            experiences=[
                ExtractedExperience(company="", role="", bullets=[]),
                ExtractedExperience(
                    company="Acme",
                    role="Engineer",
                    bullets=[
                        ExtractedBullet(text="  "),
                        ExtractedBullet(text="Real bullet"),
                    ],
                ),
            ]
        ),
    )

    experiences = extract_experiences("irrelevant").resume.experiences

    assert len(experiences) == 1
    assert [b.text for b in experiences[0].bullets] == ["Real bullet"]


# ---------------------------------------------------------------------------
# POST /api/resume/upload
# ---------------------------------------------------------------------------

def stub_extractor(monkeypatch, *, used_ai=True, experiences=None):
    if experiences is None:
        experiences = [
            ExtractedExperience(
                company="Acme Corp",
                role="Backend Engineer",
                dates="2022 - 2024",
                category="Work",
                bullets=[ExtractedBullet(text="Built the payments API", skills="python")],
            )
        ]

    monkeypatch.setattr(
        main,
        "extract_experiences",
        lambda text: ExtractionResult(
            resume=ExtractedResume(experiences=experiences), used_ai=used_ai
        ),
    )


def upload(client, name="resume.pdf", data=None):
    if data is None:
        data = make_pdf(["EXPERIENCE", "Acme Corp | Backend Engineer | 2022 - 2024"])
    return client.post("/api/resume/upload", files={"file": (name, data)})


def test_upload_returns_experiences_for_review(client, monkeypatch):
    stub_extractor(monkeypatch)

    resp = upload(client)

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["filename"] == "resume.pdf"
    assert body["ai_structured"] is True
    assert body["experiences"][0]["company"] == "Acme Corp"
    assert body["experiences"][0]["bullets"][0]["text"] == "Built the payments API"


def test_upload_saves_nothing_until_the_user_imports(client, monkeypatch):
    stub_extractor(monkeypatch)

    assert upload(client).status_code == 200

    assert client.get("/api/experiences").json() == []


def test_upload_reports_when_structuring_had_no_ai(client, monkeypatch):
    stub_extractor(monkeypatch, used_ai=False)

    assert upload(client).json()["ai_structured"] is False


def test_upload_result_can_be_imported_as_is(client, monkeypatch):
    """The upload response body feeds the bulk endpoint without reshaping."""
    stub_extractor(monkeypatch)
    extracted = upload(client).json()["experiences"]

    resp = client.post("/api/experiences/bulk", json={"experiences": extracted})

    assert resp.status_code == 201, resp.text
    assert len(client.get("/api/experiences").json()) == 1


def test_upload_rejects_an_unsupported_file_type(client, monkeypatch):
    stub_extractor(monkeypatch)

    resp = upload(client, name="resume.txt", data=b"plain text")

    assert resp.status_code == 400
    assert "Unsupported file type" in resp.json()["detail"]


def test_upload_rejects_an_empty_file(client):
    resp = upload(client, name="resume.pdf", data=b"")

    assert resp.status_code == 400
    assert "empty" in resp.json()["detail"]


def test_upload_rejects_a_file_over_the_size_ceiling(client):
    oversized = b"x" * (main.MAX_UPLOAD_BYTES + 1)

    resp = upload(client, data=oversized)

    assert resp.status_code == 413
    assert "larger than" in resp.json()["detail"]


def test_upload_surfaces_a_parse_failure_as_a_readable_error(client, monkeypatch):
    stub_extractor(monkeypatch)

    resp = upload(client, data=b"not actually a pdf")

    assert resp.status_code == 400
    assert resp.json()["detail"]


def test_upload_422s_when_no_experiences_are_found(client, monkeypatch):
    stub_extractor(monkeypatch, experiences=[])

    resp = upload(client)

    assert resp.status_code == 422
    assert "No experiences" in resp.json()["detail"]


def test_upload_end_to_end_without_a_model(client, monkeypatch):
    """Real PDF, real parser, real heuristic extractor — no stubs, no network."""
    use_heuristic(monkeypatch)
    data = make_pdf(
        [
            "EXPERIENCE",
            "Acme Corp | Backend Engineer | Jun 2022 - Aug 2024",
            "- Built the payments API",
            "- Cut p99 latency by 40%",
        ]
    )

    resp = client.post("/api/resume/upload", files={"file": ("resume.pdf", data)})

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ai_structured"] is False
    experience = body["experiences"][0]
    assert experience["company"] == "Acme Corp"
    assert experience["role"] == "Backend Engineer"
    assert experience["dates"] == "Jun 2022 - Aug 2024"
    assert len(experience["bullets"]) == 2


def test_supported_types_are_published_for_the_file_picker(client):
    resp = client.get("/api/resume/supported-types")

    assert resp.status_code == 200
    assert set(resp.json()["extensions"]) == {".pdf", ".docx", ".tex"}
