"""
Rewrite Master Vault bullet points to target a job description.

Every bullet this module returns is a rewrite of something the user actually
wrote. When the model cannot be reached it raises rather than returning
substitute content: a resume bullet the candidate never earned is worse than
no bullet at all, and there is no way for the UI to tell the two apart once a
plausible-looking rewrite is on screen.
"""

import os
from typing import List

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel

load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key) if api_key else None

NO_KEY_HINT = (
    "AI tailoring is unavailable: no OPENAI_API_KEY is configured. "
    "Add one to backend/.env and restart the backend."
)


class TailorUnavailable(Exception):
    """
    Raised when no tailoring could be performed.

    Carries a message written for the person at the keyboard — it is surfaced
    verbatim in the UI's error banner.
    """


class TailoredBullet(BaseModel):
    company: str
    role: str
    original_bullet: str
    tailored_bullet: str
    skills_highlighted: List[str]
    impact_reasoning: str

class TailorResponse(BaseModel):
    match_score: int  # 0 to 100 estimated ATS match score
    extracted_keywords: List[str]
    tailored_bullets: List[TailoredBullet]

def tailor_resume_bullets(job_description: str, raw_experiences: list) -> TailorResponse:
    """
    Takes raw vault experiences and a target job description, and returns
    structured, ATS-tailored bullet points using gpt-4o-mini.

    Raises TailorUnavailable when no key is configured or the model call
    fails, so the caller reports the problem instead of showing invented
    bullets as if they were the user's own.
    """
    if client is None:
        raise TailorUnavailable(NO_KEY_HINT)

    system_prompt = (
        "You are an expert technical resume writer and ATS optimization engine. "
        "Given a list of candidate experiences/bullet points and a target job description: "
        "1. Analyze the job description to extract core keywords and required technical skills. "
        "2. Select and rewrite the candidate's bullet points to directly align with those skills. "
        "3. Use strong action verbs (e.g., Engineered, Optimized, Deployed) and emphasize measurable impact/metrics. "
        "4. Assign an estimated ATS match score (0-100)."
    )

    user_prompt = (
        f"TARGET JOB DESCRIPTION:\n{job_description}\n\n"
        f"CANDIDATE MASTER VAULT EXPERIENCES:\n{raw_experiences}"
    )

    try:
        completion = client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format=TailorResponse,
        )
    except Exception as exc:
        # Quota, rate limit, network. The reason is worth passing through —
        # "insufficient_quota" tells the user exactly what to go fix.
        raise TailorUnavailable(f"AI tailoring is unavailable: {exc}") from exc

    parsed = completion.choices[0].message.parsed
    if parsed is None:
        # The call succeeded but the response did not satisfy the schema, so
        # there is nothing trustworthy to show.
        raise TailorUnavailable(
            "The tailoring model returned a response that could not be read. "
            "Try again."
        )

    return parsed