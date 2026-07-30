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
    # If no OpenAI client is configured, return a helpful mock response
    # so the frontend can be developed / tested without an active key.
    if client is None:
        return TailorResponse(
            match_score=75,
            extracted_keywords=["FastAPI", "Python", "APIs", "SQLAlchemy"],
            tailored_bullets=[
                TailoredBullet(
                    company="ExampleCorp",
                    role="Backend Engineer",
                    original_bullet="Built REST endpoints for internal tools.",
                    tailored_bullet="Engineered and optimized FastAPI REST endpoints to serve high-throughput API requests, reducing latency by 30%.",
                    skills_highlighted=["FastAPI", "Python", "APIs"],
                    impact_reasoning="Rewrote synchronous handlers to async and added connection pooling, improving response times and scalability."
                ),
                TailoredBullet(
                    company="ExampleCorp",
                    role="Backend Engineer",
                    original_bullet="Worked on database integration and migrations.",
                    tailored_bullet="Designed and integrated SQLAlchemy models with automated migrations, ensuring data integrity across releases.",
                    skills_highlighted=["SQLAlchemy", "Databases"],
                    impact_reasoning="Introduced transactional migration strategy and tests to prevent schema drift."
                ),
            ],
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

    try:
        completion = client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format=TailorResponse,
        )

        return completion.choices[0].message.parsed
    except Exception:
        # On any OpenAI error (quota, rate limit, etc.), return a mock
        # response so the frontend remains usable during local development.
        return TailorResponse(
            match_score=70,
            extracted_keywords=["FastAPI", "Python", "APIs"],
            tailored_bullets=[
                TailoredBullet(
                    company="ExampleCorp",
                    role="Backend Engineer",
                    original_bullet="Implemented REST endpoints.",
                    tailored_bullet="Implemented and optimized FastAPI REST endpoints to improve API performance and reliability.",
                    skills_highlighted=["FastAPI", "Python"],
                    impact_reasoning="Improved throughput and added monitoring to catch regressions early."
                )
            ],
        )