"""
Compile LaTeX to PDF with tectonic.

tectonic is used rather than a full TeX Live because it is self-contained,
fetches only the packages a document actually asks for, and runs with
shell-escape disabled by default — so compiling a resume cannot execute
commands on the host.
"""

import shutil
import subprocess
import tempfile
from pathlib import Path

# Bounded so a document with a runaway macro cannot occupy a worker forever.
COMPILE_TIMEOUT_SECONDS = 90

INSTALL_HINT = (
    "No LaTeX engine found. Install one with `brew install tectonic` "
    "(macOS) and restart the backend."
)


class LatexCompileError(Exception):
    """Raised when the document cannot be turned into a PDF."""


# Checked when tectonic is not on PATH. A backend started from an IDE or a
# launchd plist inherits a minimal PATH that omits Homebrew, and "install it,
# it still says it is missing" is a miserable thing to debug.
_FALLBACK_ENGINE_PATHS = (
    "/opt/homebrew/bin/tectonic",
    "/usr/local/bin/tectonic",
)


def engine_path() -> str | None:
    """Absolute path to tectonic, or None when it is not installed."""
    found = shutil.which("tectonic")
    if found:
        return found

    return next((p for p in _FALLBACK_ENGINE_PATHS if Path(p).is_file()), None)


def is_available() -> bool:
    return engine_path() is not None


def compile_pdf(latex: str) -> bytes:
    """
    Render LaTeX source to PDF bytes.

    Raises LatexCompileError with the engine's own message when the document
    does not build — that text is what tells the user which line is wrong.
    """
    engine = engine_path()
    if engine is None:
        raise LatexCompileError(INSTALL_HINT)

    with tempfile.TemporaryDirectory() as workdir:
        source = Path(workdir) / "resume.tex"
        source.write_text(latex, encoding="utf-8")

        try:
            result = subprocess.run(
                [
                    engine,
                    "--outdir",
                    workdir,
                    "--chatter",
                    "minimal",
                    # Never block on a missing-file prompt inside a subprocess.
                    "--keep-logs",
                    str(source),
                ],
                capture_output=True,
                cwd=workdir,
                timeout=COMPILE_TIMEOUT_SECONDS,
            )
        except subprocess.TimeoutExpired as exc:
            raise LatexCompileError(
                f"Compiling timed out after {COMPILE_TIMEOUT_SECONDS}s. "
                "The document may have a macro that never terminates."
            ) from exc
        except OSError as exc:
            raise LatexCompileError(f"Could not run the LaTeX engine: {exc}") from exc

        pdf = Path(workdir) / "resume.pdf"

        if result.returncode != 0 or not pdf.exists():
            raise LatexCompileError(_readable_error(result.stderr, result.stdout))

        return pdf.read_bytes()


def _readable_error(stderr: bytes, stdout: bytes) -> str:
    """
    Pull the useful lines out of a TeX log.

    A failed run prints hundreds of lines of package chatter; the lines that
    matter start with "error:" or the TeX "!" marker.
    """
    text = (stderr or b"").decode("utf-8", "replace")
    text += (stdout or b"").decode("utf-8", "replace")

    interesting = [
        line.strip()
        for line in text.splitlines()
        if line.strip().startswith(("error:", "!")) or "Undefined control sequence" in line
    ]

    if not interesting:
        # Better a raw tail than a vague "compilation failed".
        interesting = [line for line in text.splitlines() if line.strip()][-8:]

    return "LaTeX failed to compile:\n" + "\n".join(interesting[:12])
