"""LaTeX tailoring: locating bullets, splicing rewrites, building, compiling."""

import pytest

import main
from services import latex_compiler, latex_tailor
from services.latex_builder import Profile, build_resume, escape
from services.latex_tailor import (
    BulletRewrite,
    LatexTailorAI,
    find_bullets,
    latex_safe,
    tailor_latex,
)

RESUME = r"""\documentclass[letterpaper,11pt]{article}
\usepackage{geometry}
\newcommand{\resumeItem}[1]{\item\small{#1}}

\begin{document}
\begin{center}\textbf{Jane Doe} \\ jane@example.com\end{center}

\section{Experience}
\resumeSubheading{Acme Corp}{Backend Engineer}{Jun 2022 -- Aug 2024}
\begin{itemize}
  \resumeItem{Built REST endpoints for the internal tools team}
  \resumeItem{Worked on database integration and migrations}
\end{itemize}

\section{Education}
\resumeSubheading{UC San Diego}{B.S. Computer Science}{2027}
\end{document}
"""


def stub_model(monkeypatch, rewrites, *, score=88, keywords=None):
    monkeypatch.setattr(latex_tailor, "client", object())
    monkeypatch.setattr(
        latex_tailor,
        "_call_model",
        lambda bullets, jd: LatexTailorAI(
            match_score=score,
            extracted_keywords=keywords if keywords is not None else ["FastAPI"],
            rewrites=rewrites,
        ),
    )


# ---------------------------------------------------------------------------
# Finding bullets
# ---------------------------------------------------------------------------

def test_finds_braced_macro_bullets():
    bullets = find_bullets(RESUME)

    assert [text for _, _, text in bullets] == [
        "Built REST endpoints for the internal tools team",
        "Worked on database integration and migrations",
    ]


def test_offsets_bound_the_text_not_the_macro():
    start, end, text = find_bullets(RESUME)[0]

    # Slicing by the reported offsets must reproduce exactly the bullet text,
    # leaving \resumeItem{ and its closing brace outside the span.
    assert RESUME[start:end] == text
    assert RESUME[start - 1] == "{"
    assert RESUME[end] == "}"


def test_finds_bare_item_bullets():
    source = r"""\begin{itemize}
  \item Shipped an ETL pipeline in Python
  \item Cut p99 latency by 40\%
\end{itemize}"""

    assert [t for _, _, t in find_bullets(source)] == [
        "Shipped an ETL pipeline in Python",
        r"Cut p99 latency by 40\%",
    ]


def test_nested_commands_inside_a_bullet_stay_with_it():
    source = r"\resumeItem{Built the \textbf{payments} API for \emph{2M} users}"

    assert [t for _, _, t in find_bullets(source)] == [
        r"Built the \textbf{payments} API for \emph{2M} users"
    ]


def test_overlapping_bullets_are_not_double_counted():
    """A bare \\item inside a braced item must not yield two overlapping spans."""
    source = r"\resumeItem{\item Built the payments API}"

    bullets = find_bullets(source)

    assert len(bullets) == 1


def test_unbalanced_braces_do_not_crash_the_scan():
    assert find_bullets(r"\resumeItem{never closed") == []


# ---------------------------------------------------------------------------
# Escaping
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "raw, expected",
    [
        ("Cut latency by 40%", r"Cut latency by 40\%"),
        ("Led R&D efforts", r"Led R\&D efforts"),
        ("Saved $2M annually", r"Saved \$2M annually"),
        ("Refactored user_profile module", r"Refactored user\_profile module"),
        ("Wrote C# services", r"Wrote C\# services"),
    ],
)
def test_prose_specials_are_escaped(raw, expected):
    assert latex_safe(raw) == expected


def test_already_escaped_characters_are_not_escaped_twice():
    assert latex_safe(r"Cut latency by 40\%") == r"Cut latency by 40\%"


def test_commands_survive_escaping():
    """A \\textbf carried over from the original must stay a command."""
    assert latex_safe(r"Built the \textbf{payments} API") == (
        r"Built the \textbf{payments} API"
    )


def test_builder_escape_is_total():
    """Vault text is literal, so even braces and backslashes get escaped."""
    assert escape(r"50% of {a\b} & more") == (
        r"50\% of \{a\textbackslash{}b\} \& more"
    )


# ---------------------------------------------------------------------------
# Splicing rewrites back in
# ---------------------------------------------------------------------------

def test_tailoring_replaces_only_the_bullet_text(monkeypatch):
    stub_model(
        monkeypatch,
        [BulletRewrite(index=0, tailored="Engineered FastAPI endpoints", reasoning="why")],
    )

    result = tailor_latex(RESUME, "FastAPI engineer wanted")

    assert "Engineered FastAPI endpoints" in result.tailored_latex
    assert "Built REST endpoints" not in result.tailored_latex
    # The untouched bullet, preamble, header and education are byte-identical.
    assert r"\resumeItem{Worked on database integration and migrations}" in result.tailored_latex
    assert r"\newcommand{\resumeItem}[1]{\item\small{#1}}" in result.tailored_latex
    assert r"\textbf{Jane Doe}" in result.tailored_latex
    assert "UC San Diego" in result.tailored_latex


def test_the_document_structure_is_preserved_line_for_line(monkeypatch):
    stub_model(
        monkeypatch,
        [BulletRewrite(index=0, tailored="Engineered FastAPI endpoints", reasoning="")],
    )

    result = tailor_latex(RESUME, "FastAPI engineer")

    original_lines = RESUME.splitlines()
    tailored_lines = result.tailored_latex.splitlines()
    assert len(original_lines) == len(tailored_lines)
    differing = [
        i for i, (a, b) in enumerate(zip(original_lines, tailored_lines)) if a != b
    ]
    assert len(differing) == 1


def test_multiple_rewrites_do_not_corrupt_each_others_offsets(monkeypatch):
    stub_model(
        monkeypatch,
        [
            BulletRewrite(index=0, tailored="First rewritten bullet here", reasoning=""),
            BulletRewrite(index=1, tailored="Second rewritten bullet here", reasoning=""),
        ],
    )

    result = tailor_latex(RESUME, "job")

    assert r"\resumeItem{First rewritten bullet here}" in result.tailored_latex
    assert r"\resumeItem{Second rewritten bullet here}" in result.tailored_latex


def test_rewrites_are_escaped_before_splicing(monkeypatch):
    """An unescaped % from the model would comment out the rest of the line."""
    stub_model(
        monkeypatch,
        [BulletRewrite(index=0, tailored="Cut deploy time by 60% for the team", reasoning="")],
    )

    result = tailor_latex(RESUME, "job")

    assert r"Cut deploy time by 60\% for the team" in result.tailored_latex


def test_a_rewrite_with_unbalanced_braces_is_rejected(monkeypatch):
    stub_model(
        monkeypatch,
        [BulletRewrite(index=0, tailored=r"Built \textbf{payments API", reasoning="")],
    )

    result = tailor_latex(RESUME, "job")

    assert result.tailored_latex == RESUME
    assert result.changes == []


def test_a_rewrite_for_a_nonexistent_bullet_is_ignored(monkeypatch):
    stub_model(monkeypatch, [BulletRewrite(index=99, tailored="ghost", reasoning="")])

    result = tailor_latex(RESUME, "job")

    assert result.tailored_latex == RESUME


def test_changes_report_both_sides_of_every_edit(monkeypatch):
    stub_model(
        monkeypatch,
        [BulletRewrite(index=0, tailored="Engineered FastAPI endpoints", reasoning="keyword match")],
    )

    changes = tailor_latex(RESUME, "job").changes

    assert len(changes) == 1
    assert changes[0].original == "Built REST endpoints for the internal tools team"
    assert changes[0].tailored == "Engineered FastAPI endpoints"
    assert changes[0].reasoning == "keyword match"


def test_score_and_keywords_are_passed_through(monkeypatch):
    stub_model(monkeypatch, [], score=91, keywords=["FastAPI", "Python"])

    result = tailor_latex(RESUME, "job")

    assert result.match_score == 91
    assert result.extracted_keywords == ["FastAPI", "Python"]


def test_without_a_model_the_document_is_returned_untouched(monkeypatch):
    monkeypatch.setattr(latex_tailor, "client", None)

    result = tailor_latex(RESUME, "job")

    assert result.tailored_latex == RESUME
    assert result.ai_tailored is False
    assert result.changes == []


def test_a_model_failure_leaves_the_document_untouched(monkeypatch):
    monkeypatch.setattr(latex_tailor, "client", object())

    def explode(bullets, jd):
        raise RuntimeError("rate limited")

    monkeypatch.setattr(latex_tailor, "_call_model", explode)

    result = tailor_latex(RESUME, "job")

    assert result.tailored_latex == RESUME
    assert result.ai_tailored is False


# ---------------------------------------------------------------------------
# Building a resume from the Vault
# ---------------------------------------------------------------------------

VAULT = [
    {
        "company": "Acme Corp",
        "role": "Backend Engineer",
        "dates": "2022 - 2024",
        "category": "Work",
        "bullets": [{"text": "Built the payments API", "skills": "python"}],
    },
    {
        "company": "ResumeTailor",
        "role": "Creator",
        "dates": "2026",
        "category": "Project",
        "bullets": [{"text": "Shipped a FastAPI and Next.js app", "skills": ""}],
    },
]


def test_built_resume_contains_every_entry():
    latex = build_resume(Profile(name="Jane Doe", email="jane@example.com"), VAULT)

    assert "Jane Doe" in latex
    assert "jane@example.com" in latex
    assert "Acme Corp" in latex
    assert "Built the payments API" in latex
    assert "ResumeTailor" in latex


def test_built_resume_groups_categories_into_sections():
    latex = build_resume(Profile(name="Jane"), VAULT)

    assert r"\section{Experience}" in latex
    assert r"\section{Projects}" in latex
    # Nothing in the Vault is Research or Leadership, so those are omitted.
    assert r"\section{Research}" not in latex


def test_unknown_categories_still_appear():
    """A category the template does not know must not silently drop the entry."""
    latex = build_resume(
        Profile(name="Jane"),
        [{**VAULT[0], "category": "Volunteering"}],
    )

    assert "Acme Corp" in latex


def test_optional_sections_appear_only_when_filled():
    without = build_resume(Profile(name="Jane"), VAULT)
    with_extras = build_resume(
        Profile(name="Jane", education="UC San Diego, B.S. CS", skills="Python, Go"),
        VAULT,
    )

    assert r"\section{Education}" not in without
    assert r"\section{Education}" in with_extras
    assert "UC San Diego, B.S. CS" in with_extras
    assert r"\section{Skills}" in with_extras


def test_vault_text_is_escaped_into_the_document():
    latex = build_resume(
        Profile(name="Jane"),
        [{**VAULT[0], "bullets": [{"text": "Cut costs by 30% & sped up R&D", "skills": ""}]}],
    )

    assert r"Cut costs by 30\% \& sped up R\&D" in latex


def test_bullets_the_builder_produces_are_found_by_the_tailorer():
    """The two halves have to agree, or generated resumes cannot be tailored."""
    latex = build_resume(Profile(name="Jane"), VAULT)

    found = [text for _, _, text in find_bullets(latex)]

    assert "Built the payments API" in found
    assert "Shipped a FastAPI and Next.js app" in found


# ---------------------------------------------------------------------------
# Compiling
# ---------------------------------------------------------------------------

requires_engine = pytest.mark.skipif(
    not latex_compiler.is_available(), reason="no LaTeX engine installed"
)


@requires_engine
def test_a_generated_resume_compiles_to_a_pdf():
    latex = build_resume(
        Profile(
            name="Jane Doe",
            email="jane@example.com",
            phone="555-0100",
            links=["github.com/jane"],
            education="UC San Diego, B.S. Computer Science",
            skills="Python, FastAPI",
        ),
        VAULT,
    )

    pdf = latex_compiler.compile_pdf(latex)

    assert pdf.startswith(b"%PDF-")
    assert len(pdf) > 1000


@requires_engine
def test_a_resume_with_escaped_specials_compiles():
    """The escaping is what stands between "40%" and a broken build."""
    latex = build_resume(
        Profile(name="Jane"),
        [{**VAULT[0], "bullets": [{"text": "Cut costs 30% & grew R&D_spend", "skills": ""}]}],
    )

    assert latex_compiler.compile_pdf(latex).startswith(b"%PDF-")


@requires_engine
def test_a_broken_document_raises_a_readable_error():
    with pytest.raises(latex_compiler.LatexCompileError) as exc:
        latex_compiler.compile_pdf(r"\documentclass{article}\begin{document}\bogusmacro")

    assert "LaTeX failed to compile" in str(exc.value)


def test_a_missing_engine_is_reported_as_an_install_hint(monkeypatch):
    monkeypatch.setattr(latex_compiler, "engine_path", lambda: None)

    with pytest.raises(latex_compiler.LatexCompileError, match="brew install tectonic"):
        latex_compiler.compile_pdf(r"\documentclass{article}\begin{document}hi\end{document}")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

def add_source(client, name="resume.tex", latex=RESUME):
    return client.post("/api/resume/sources", json={"name": name, "latex": latex}).json()


def test_sources_can_be_created_listed_and_deleted(client):
    created = client.post("/api/resume/sources", json={"name": "base.tex", "latex": RESUME})
    assert created.status_code == 201, created.text
    source_id = created.json()["id"]

    listed = client.get("/api/resume/sources").json()
    assert [s["name"] for s in listed] == ["base.tex"]
    # The list view omits the LaTeX body.
    assert "latex" not in listed[0]

    fetched = client.get(f"/api/resume/sources/{source_id}").json()
    assert fetched["latex"] == RESUME

    assert client.delete(f"/api/resume/sources/{source_id}").status_code == 204
    assert client.get("/api/resume/sources").json() == []


def test_missing_sources_return_404(client):
    assert client.get("/api/resume/sources/999").status_code == 404
    assert client.delete("/api/resume/sources/999").status_code == 404


def test_empty_source_is_rejected(client):
    resp = client.post("/api/resume/sources", json={"name": "x", "latex": "   "})
    assert resp.status_code == 400


def test_uploading_a_tex_stores_it_verbatim(client):
    resp = client.post(
        "/api/resume/sources/upload",
        files={"file": ("mine.tex", RESUME.encode())},
    )

    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["name"] == "mine.tex"
    # Verbatim matters: tailoring splices into this exact text.
    assert body["latex"] == RESUME


def test_uploading_a_pdf_as_a_source_is_rejected(client):
    resp = client.post(
        "/api/resume/sources/upload", files={"file": ("resume.pdf", b"%PDF-1.4")}
    )

    assert resp.status_code == 400
    assert ".tex" in resp.json()["detail"]


def test_generate_builds_from_the_vault(client):
    client.post(
        "/api/experiences",
        json={
            "company": "Acme",
            "role": "Engineer",
            "dates": "2024",
            "category": "Work",
            "bullets": [{"text": "Built the payments API", "skills": ""}],
        },
    )

    resp = client.post(
        "/api/resume/generate", json={"profile": {"name": "Jane Doe"}}
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "Jane Doe" in body["latex"]
    assert "Built the payments API" in body["latex"]
    # Not saved unless asked, so id 0 marks an unstored draft.
    assert body["id"] == 0
    assert client.get("/api/resume/sources").json() == []


def test_generate_can_save_the_result_as_a_source(client):
    client.post(
        "/api/experiences",
        json={"company": "Acme", "role": "Engineer", "bullets": [{"text": "Did work here", "skills": ""}]},
    )

    resp = client.post(
        "/api/resume/generate",
        json={"profile": {"name": "Jane"}, "save_as": "from-vault.tex"},
    )

    assert resp.status_code == 200
    assert resp.json()["id"] > 0
    assert [s["name"] for s in client.get("/api/resume/sources").json()] == ["from-vault.tex"]


def test_generate_rejects_an_empty_vault(client):
    resp = client.post("/api/resume/generate", json={"profile": {"name": "Jane"}})

    assert resp.status_code == 400
    assert "Master Vault" in resp.json()["detail"]


def test_tailoring_a_stored_source(client, monkeypatch):
    stub_model(
        monkeypatch,
        [BulletRewrite(index=0, tailored="Engineered FastAPI endpoints", reasoning="r")],
    )
    source = add_source(client)

    resp = client.post(
        "/api/resume/tailor-latex",
        json={"source_id": source["id"], "job_description": "FastAPI engineer"},
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["original_latex"] == RESUME
    assert "Engineered FastAPI endpoints" in body["tailored_latex"]
    assert body["changes"][0]["original"] == "Built REST endpoints for the internal tools team"
    assert body["ai_tailored"] is True


def test_tailoring_ad_hoc_latex_without_storing_it(client, monkeypatch):
    stub_model(monkeypatch, [BulletRewrite(index=0, tailored="Engineered endpoints now", reasoning="")])

    resp = client.post(
        "/api/resume/tailor-latex",
        json={"latex": RESUME, "job_description": "engineer"},
    )

    assert resp.status_code == 200
    assert client.get("/api/resume/sources").json() == []


def test_tailoring_needs_a_source_and_a_job_description(client):
    assert (
        client.post("/api/resume/tailor-latex", json={"job_description": "x"}).status_code
        == 400
    )
    assert (
        client.post(
            "/api/resume/tailor-latex", json={"latex": RESUME, "job_description": "  "}
        ).status_code
        == 400
    )


def test_tailoring_an_unknown_source_returns_404(client):
    resp = client.post(
        "/api/resume/tailor-latex",
        json={"source_id": 999, "job_description": "engineer"},
    )

    assert resp.status_code == 404


def test_compiler_status_is_reported(client):
    body = client.get("/api/resume/compiler").json()

    assert body["available"] is latex_compiler.is_available()
    if not body["available"]:
        assert "tectonic" in body["hint"]


@requires_engine
def test_compile_endpoint_returns_a_pdf(client):
    resp = client.post(
        "/api/resume/compile",
        json={"latex": r"\documentclass{article}\begin{document}Hi\end{document}"},
    )

    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content.startswith(b"%PDF-")


@requires_engine
def test_compile_endpoint_422s_on_a_broken_document(client):
    resp = client.post(
        "/api/resume/compile",
        json={"latex": r"\documentclass{article}\begin{document}\bogusmacro"},
    )

    assert resp.status_code == 422
    assert "compile" in resp.json()["detail"].lower()


def test_compile_endpoint_rejects_empty_input(client):
    assert client.post("/api/resume/compile", json={"latex": "  "}).status_code == 400


def test_compile_endpoint_503s_without_an_engine(client, monkeypatch):
    monkeypatch.setattr(main.latex_compiler, "is_available", lambda: False)

    resp = client.post(
        "/api/resume/compile",
        json={"latex": r"\documentclass{article}\begin{document}Hi\end{document}"},
    )

    assert resp.status_code == 503
    assert "brew install tectonic" in resp.json()["detail"]
