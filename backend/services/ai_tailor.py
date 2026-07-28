import os
from typing import List

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel

load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key) if api_key else None

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
    """
    if client is None:
        return TailorResponse(
            match_score=0,
            extracted_keywords=[],
            tailored_bullets=[],
        )

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

    completion = client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format=TailorResponse,
    )

    return completion.choices[0].message.parsed