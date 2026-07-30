"""Text recovery from the three supported resume formats."""

import pytest
from conftest import make_docx, make_pdf

from services.resume_parser import MAX_CHARS, ResumeParseError, extract_text


def test_pdf_text_is_recovered():
    data = make_pdf(
        [
            "EXPERIENCE",
            "Acme Corp | Backend Engineer | 2022 - 2024",
            "- Built the payments API",
        ]
    )

    text = extract_text("resume.pdf", data)

    assert "Acme Corp" in text
    assert "Built the payments API" in text


def test_docx_text_is_recovered():
    data = make_docx(["EXPERIENCE", "Globex - Data Intern", "- Shipped an ETL pipeline"])

    text = extract_text("resume.docx", data)

    assert "Globex" in text
    assert "Shipped an ETL pipeline" in text


def test_docx_tables_are_not_dropped():
    """Two-column resume templates keep their content in tables, not paragraphs."""
    import io

    import docx

    document = docx.Document()
    table = document.add_table(rows=1, cols=2)
    table.rows[0].cells[0].text = "Jun 2024 - Present"
    table.rows[0].cells[1].text = "Research Assistant, UCSD"

    buffer = io.BytesIO()
    document.save(buffer)

    text = extract_text("resume.docx", buffer.getvalue())

    assert "Research Assistant, UCSD" in text
    assert "Jun 2024 - Present" in text


LATEX_RESUME = r"""
\documentclass[letterpaper,11pt]{article}
\usepackage{geometry}
\newcommand{\resumeItem}[1]{\item\small{#1}}

\begin{document}
% a comment that must not survive
\section{Experience}
\resumeSubheading{Acme Corp}{Backend Engineer}{Jun 2022 -- Aug 2024}
\begin{itemize}
  \resumeItem{Built the \textbf{payments} API serving 2M requests/day}
  \resumeItem{Cut p99 latency by 40\%}
\end{itemize}
\href{https://example.com}{Portfolio}
\end{document}
"""


def test_latex_markup_is_stripped_to_readable_text():
    text = extract_text("resume.tex", LATEX_RESUME.encode())

    assert "Acme Corp" in text
    assert "Backend Engineer" in text
    # Nested \textbf inside \resumeItem must unwrap, not vanish.
    assert "Built the payments API serving 2M requests/day" in text
    assert "Cut p99 latency by 40%" in text
    # \href keeps the label rather than the URL.
    assert "Portfolio" in text
    assert "example.com" not in text
    # No LaTeX plumbing leaks through.
    assert "\\" not in text
    assert "a comment that must not survive" not in text
    assert "geometry" not in text


def test_latex_preamble_is_discarded():
    text = extract_text(
        "resume.tex", (r"\documentclass{article}" + LATEX_RESUME).encode()
    )

    assert "documentclass" not in text


def test_unsupported_extension_is_rejected():
    with pytest.raises(ResumeParseError, match="Unsupported file type"):
        extract_text("resume.txt", b"plain text resume")


def test_file_with_no_extension_is_rejected():
    with pytest.raises(ResumeParseError, match="Unsupported file type"):
        extract_text("resume", b"data")


def test_corrupt_pdf_is_reported_not_crashed():
    with pytest.raises(ResumeParseError):
        extract_text("resume.pdf", b"this is definitely not a pdf")


def test_doc_renamed_to_docx_gives_an_actionable_message():
    with pytest.raises(ResumeParseError, match="legacy .doc"):
        extract_text("resume.docx", b"\xd0\xcf\x11\xe0 legacy word binary")


def test_pdf_with_no_extractable_text_suggests_a_text_based_export():
    # A page with no text operators stands in for a scanned/image-only resume.
    with pytest.raises(ResumeParseError, match="scanned or image-based"):
        extract_text("resume.pdf", make_pdf([]))


def test_output_is_capped_so_a_runaway_file_never_reaches_the_model():
    long_resume = r"\begin{document}" + ("word " * 30_000) + r"\end{document}"

    text = extract_text("resume.tex", long_resume.encode())

    assert len(text) <= MAX_CHARS


def test_whitespace_is_normalized():
    data = make_docx(["Acme    Corp   ", "", "", "", "  Backend Engineer"])

    text = extract_text("resume.docx", data)

    assert "Acme Corp" in text
    # Runs of blank lines collapse to at most one.
    assert "\n\n\n" not in text
