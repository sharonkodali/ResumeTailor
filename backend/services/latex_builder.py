"""
Build a complete LaTeX resume from Master Vault entries.

This is the path for someone who has no .tex of their own yet. The output is
deliberately a plain `article` using only packages tectonic can always resolve,
so the first compile never fails on a missing style file.
"""

from typing import Dict, Iterable, List

from pydantic import BaseModel

# Vault categories mapped to the section headings a resume actually uses, in
# the order they should appear.
SECTION_ORDER = (
    ("Work", "Experience"),
    ("Research", "Research"),
    ("Project", "Projects"),
    ("Leadership", "Leadership"),
)


class Profile(BaseModel):
    """
    Everything a resume needs that the Vault does not store.

    The Vault holds experiences only, so identity, education, and the skills
    list have to be supplied by the caller.
    """

    name: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    links: List[str] = []
    education: str = ""
    skills: str = ""


_ESCAPES = {
    "\\": r"\textbackslash{}",
    "&": r"\&",
    "%": r"\%",
    "$": r"\$",
    "#": r"\#",
    "_": r"\_",
    "{": r"\{",
    "}": r"\}",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
}


def escape(text: str) -> str:
    """
    Escape every LaTeX special.

    Vault text was typed into a web form, so any backslash or brace in it is
    literal — unlike a rewritten bullet, where a \\textbf must survive.
    """
    return "".join(_ESCAPES.get(char, char) for char in text or "")


PREAMBLE = r"""\documentclass[letterpaper,11pt]{article}

\usepackage[margin=0.65in]{geometry}
\usepackage{enumitem}
\usepackage{titlesec}
\usepackage[hidelinks]{hyperref}

\pagestyle{empty}
\setlist[itemize]{leftmargin=1.4em, itemsep=1pt, topsep=2pt, parsep=0pt}
\titleformat{\section}{\large\bfseries\scshape}{}{0em}{}[\vspace{-0.7em}\hrule\vspace{0.2em}]
\titlespacing{\section}{0pt}{1.1em}{0.5em}

% One entry heading: company, role, dates.
\newcommand{\resumeEntry}[3]{%
  \noindent\textbf{#1} \hfill \textit{#3}\\
  \textit{#2}\vspace{0.15em}%
}
"""


def build_resume(profile: Profile, experiences: Iterable[dict]) -> str:
    """
    Assemble a .tex document.

    `experiences` are plain dicts with company/role/dates/category/bullets, so
    this stays independent of the ORM layer and is trivial to test.
    """
    parts = [PREAMBLE, r"\begin{document}", "", _header(profile)]

    grouped = _group_by_category(experiences)

    for category, heading in SECTION_ORDER:
        entries = grouped.get(category)
        if entries:
            parts.append(_section(heading, entries))

    if profile.education.strip():
        parts.append(_free_text_section("Education", profile.education))

    if profile.skills.strip():
        parts.append(_free_text_section("Skills", profile.skills))

    parts.append(r"\end{document}")
    return "\n".join(parts) + "\n"


def _header(profile: Profile) -> str:
    name = escape(profile.name.strip()) or "Your Name"
    contact = [
        escape(value.strip())
        for value in (profile.email, profile.phone, profile.location)
        if value and value.strip()
    ]
    contact += [escape(link.strip()) for link in profile.links if link and link.strip()]

    lines = [
        r"\begin{center}",
        rf"  {{\LARGE \textbf{{{name}}}}}\\[0.35em]",
    ]
    if contact:
        lines.append("  " + r" $\cdot$ ".join(contact))
    lines.append(r"\end{center}")
    lines.append("")

    return "\n".join(lines)


def _group_by_category(experiences: Iterable[dict]) -> Dict[str, List[dict]]:
    grouped: Dict[str, List[dict]] = {}
    known = {category for category, _ in SECTION_ORDER}

    for exp in experiences:
        category = exp.get("category") or "Work"
        # An unrecognised category would otherwise drop the entry silently.
        grouped.setdefault(category if category in known else "Work", []).append(exp)

    return grouped


def _section(heading: str, entries: List[dict]) -> str:
    lines = [rf"\section{{{escape(heading)}}}", ""]

    for entry in entries:
        lines.append(
            r"\resumeEntry{%s}{%s}{%s}"
            % (
                escape(entry.get("company", "")),
                escape(entry.get("role", "")),
                escape(entry.get("dates", "")),
            )
        )

        bullets = [b for b in entry.get("bullets", []) if (b.get("text") or "").strip()]
        if bullets:
            lines.append(r"\begin{itemize}")
            for bullet in bullets:
                lines.append(rf"  \item {escape(bullet['text'].strip())}")
            lines.append(r"\end{itemize}")

        lines.append("")

    return "\n".join(lines)


def _free_text_section(heading: str, body: str) -> str:
    """Render a section the user typed as free text, one line per line."""
    lines = [rf"\section{{{escape(heading)}}}", ""]
    rendered = [escape(line.strip()) for line in body.splitlines() if line.strip()]
    lines.append(r" \\ ".join(rendered))
    lines.append("")
    return "\n".join(lines)
