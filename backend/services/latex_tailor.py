"""
Rewrite the bullet points inside a LaTeX resume to target a job description.

The model never writes the document. It only rewrites the text of bullets we
located, and those strings are spliced back into the original source at their
exact character offsets. Everything else — preamble, custom macros, header,
education, spacing — comes through byte-identical.

That constraint is the whole design. Asking a model to emit a complete .tex
reliably produces a document that no longer compiles, and it makes the diff
impossible to review because unrelated formatting churns on every run.
"""

import os
import re
from typing import List, Optional, Tuple

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel

load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key) if api_key else None

# Bullets shorter than this are section labels or stray fragments, not content
# worth spending a rewrite on.
MIN_BULLET_CHARS = 25


class BulletRewrite(BaseModel):
    index: int  # position in the list of bullets we sent
    tailored: str
    reasoning: str


class LatexTailorAI(BaseModel):
    match_score: int  # 0-100 estimated ATS match
    extracted_keywords: List[str]
    rewrites: List[BulletRewrite]


class Change(BaseModel):
    original: str
    tailored: str
    reasoning: str


class TailorLatexResult(BaseModel):
    original_latex: str
    tailored_latex: str
    changes: List[Change] = []
    match_score: int = 0
    extracted_keywords: List[str] = []
    # False when no model was available, in which case the document is returned
    # unchanged rather than altered by some lesser heuristic.
    ai_tailored: bool = True


SYSTEM_PROMPT = (
    "You are an expert technical resume writer and ATS optimization engine. "
    "You are given the bullet points of a candidate's LaTeX resume and a target "
    "job description.\n"
    "For each bullet worth improving, return a rewrite that:\n"
    "1. Leads with a strong action verb (Engineered, Optimized, Shipped, Led).\n"
    "2. Works in the concrete skills and keywords the job description asks for, "
    "but ONLY where the candidate's original bullet already supports them. Never "
    "invent technologies, employers, metrics, or outcomes the original does not claim.\n"
    "3. Keeps any metric the original had, and keeps roughly the original length "
    "so the resume still fits its page.\n"
    "4. Is plain prose. Do not add LaTeX commands, and do not wrap the text in "
    "braces. If the original contained a command such as \\textbf{...}, you may "
    "keep it exactly as it appeared.\n"
    "Omit a bullet from your rewrites entirely if it is already well targeted or "
    "is irrelevant to this job — an unchanged bullet is better than a padded one.\n"
    "Also return the ATS keywords you extracted from the job description and an "
    "estimated 0-100 match score for the resume as a whole."
)


def tailor_latex(latex: str, job_description: str) -> TailorLatexResult:
    """Return the resume rewritten for this job, plus the change list."""
    bullets = find_bullets(latex)
    substantial = [b for b in bullets if len(b[2].strip()) >= MIN_BULLET_CHARS]

    if not substantial or client is None:
        return TailorLatexResult(
            original_latex=latex,
            tailored_latex=latex,
            ai_tailored=client is not None and bool(substantial),
        )

    try:
        response = _call_model([text for _, _, text in substantial], job_description)
    except Exception:
        response = None

    if response is None:
        return TailorLatexResult(
            original_latex=latex, tailored_latex=latex, ai_tailored=False
        )

    tailored, changes = _apply_rewrites(latex, substantial, response.rewrites)

    return TailorLatexResult(
        original_latex=latex,
        tailored_latex=tailored,
        changes=changes,
        match_score=response.match_score,
        extracted_keywords=response.extracted_keywords,
        ai_tailored=True,
    )


def _call_model(bullet_texts: List[str], job_description: str) -> Optional[LatexTailorAI]:
    numbered = "\n".join(f"[{i}] {text}" for i, text in enumerate(bullet_texts))
    completion = client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"TARGET JOB DESCRIPTION:\n{job_description}\n\n"
                    f"RESUME BULLET POINTS (rewrite by index):\n{numbered}"
                ),
            },
        ],
        response_format=LatexTailorAI,
    )
    return completion.choices[0].message.parsed


def _apply_rewrites(
    latex: str,
    bullets: List[Tuple[int, int, str]],
    rewrites: List[BulletRewrite],
) -> Tuple[str, List[Change]]:
    """
    Splice rewrites into the source at the original offsets.

    Applied back to front so that each replacement cannot shift the offsets of
    the ones still to be applied.
    """
    accepted = []
    for rewrite in rewrites:
        if not 0 <= rewrite.index < len(bullets):
            continue  # the model referenced a bullet that does not exist

        start, end, original = bullets[rewrite.index]
        tailored = latex_safe(rewrite.tailored.strip())

        if not tailored or tailored == original.strip():
            continue
        if not _braces_balanced(tailored):
            continue  # would break compilation; keep the original

        accepted.append((start, end, original, tailored, rewrite.reasoning))

    out = latex
    for start, end, _, tailored, _ in sorted(accepted, reverse=True):
        out = out[:start] + tailored + out[end:]

    changes = [
        Change(original=original.strip(), tailored=tailored, reasoning=reasoning)
        for _, _, original, tailored, reasoning in accepted
    ]
    return out, changes


# ---------------------------------------------------------------------------
# Locating bullets in LaTeX source
# ---------------------------------------------------------------------------

# Resume templates wrap bullets either in a macro taking one argument
# (\resumeItem{...}, \cvitem{...}) or in a bare \item that runs to the end of
# its own entry.
_BRACED_ITEM = re.compile(r"\\[a-zA-Z@]*[Ii]tem\s*\{")
_BARE_ITEM = re.compile(r"\\item\b(?!\s*\{)")
# A bare \item ends where the next structural command begins.
_BARE_ITEM_END = re.compile(r"\\(?:item|resumeItem|end|begin|section|subsection)\b")

_DOCUMENT_START = re.compile(r"\\begin\s*\{document\}")
_DOCUMENT_END = re.compile(r"\\end\s*\{document\}")
_LIST_DELIMITER = re.compile(r"\\(begin|end)\s*\{(?:itemize|enumerate|description)\}")


def find_bullets(latex: str) -> List[Tuple[int, int, str]]:
    """
    Return (start, end, text) for every bullet, sorted by position.

    Offsets bound the bullet's *text* only, never its surrounding macro, so a
    replacement cannot damage the command that wraps it.
    """
    offset, body = _document_body(latex)

    spans: List[Tuple[int, int, str]] = []

    for match in _BRACED_ITEM.finditer(body):
        open_brace = match.end() - 1
        close_brace = _matching_brace(body, open_brace)
        if close_brace is None:
            continue
        start, end = open_brace + 1, close_brace
        spans.append((start, end, body[start:end]))

    # A bare \item only means a bullet inside a list. Elsewhere it is part of a
    # macro definition such as \newcommand{\resumeItem}[1]{\item\small{#1}},
    # and rewriting that would redefine the template rather than edit content.
    lists = _list_ranges(body)

    for match in _BARE_ITEM.finditer(body):
        start = match.end()
        if not any(low <= start < high for low, high in lists):
            continue

        following = _BARE_ITEM_END.search(body, start)
        end = following.start() if following else len(body)
        text = body[start:end]
        # Trailing whitespace belongs to the layout, not the sentence.
        end -= len(text) - len(text.rstrip())
        start += len(text) - len(text.lstrip())
        if end > start:
            spans.append((start, end, body[start:end]))

    spans.sort()
    return [
        (start + offset, end + offset, text)
        for start, end, text in _drop_nested(spans)
    ]


def _document_body(latex: str) -> Tuple[int, str]:
    """
    Return (offset, body) for the text between \\begin{document} and \\end{document}.

    Bullets only exist in the body; scanning the preamble would find \\item
    inside macro definitions.
    """
    start_match = _DOCUMENT_START.search(latex)
    start = start_match.end() if start_match else 0

    end_match = _DOCUMENT_END.search(latex, start)
    end = end_match.start() if end_match else len(latex)

    return start, latex[start:end]


def _list_ranges(text: str) -> List[Tuple[int, int]]:
    """Character ranges covered by the outermost list environments."""
    ranges: List[Tuple[int, int]] = []
    open_positions: List[int] = []

    for match in _LIST_DELIMITER.finditer(text):
        if match.group(1) == "begin":
            open_positions.append(match.end())
        elif open_positions:
            start = open_positions.pop()
            if not open_positions:  # the outermost list just closed
                ranges.append((start, match.start()))

    # An unclosed list still holds bullets worth tailoring.
    for start in open_positions:
        ranges.append((start, len(text)))

    return ranges


def _drop_nested(spans: List[Tuple[int, int, str]]) -> List[Tuple[int, int, str]]:
    """
    Keep only outermost spans.

    \\resumeItem{\\item ...} would otherwise yield two overlapping bullets, and
    replacing both would corrupt the source.
    """
    kept: List[Tuple[int, int, str]] = []
    for span in spans:
        if kept and span[0] < kept[-1][1]:
            continue
        kept.append(span)
    return kept


def _matching_brace(text: str, open_index: int) -> Optional[int]:
    """Index of the `}` closing the `{` at open_index, or None if unbalanced."""
    depth = 0
    i = open_index
    while i < len(text):
        char = text[i]
        if char == "\\":
            i += 2  # an escaped character, including \{ and \}
            continue
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return None


def _braces_balanced(text: str) -> bool:
    depth = 0
    i = 0
    while i < len(text):
        if text[i] == "\\":
            i += 2
            continue
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth < 0:
                return False
        i += 1
    return depth == 0


def latex_safe(text: str) -> str:
    """
    Escape the specials that appear in ordinary resume prose and would
    otherwise fail the build: "40%", "R&D", "$2M", "snake_case", "C#".

    Backslashes and braces are deliberately left alone so a \\textbf{...} the
    model carried over from the original still renders as bold. Already-escaped
    characters are not escaped twice.
    """
    return re.sub(r"(?<!\\)([%&#_$])", r"\\\1", text)
