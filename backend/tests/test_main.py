import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Ensure backend folder is on sys.path so imports behave like running from backend/
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import database
import main


SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"


def setup_test_db():
    # For reliability in this test environment, ensure the application's
    # configured SQLite database has the required tables. This keeps the
    # TestClient usage simple and avoids cross-import engine issues.
    database.Base.metadata.create_all(bind=database.engine)

    def override_get_db():
        # Use the application's SessionLocal so requests operate against the
        # same SQLite file-backed DB used by the app.
        for db in database.get_db():
            yield db

    return override_get_db


@pytest.fixture(scope="module")
def client():
    override_get_db = setup_test_db()
    # override the dependency in the FastAPI app
    main.app.dependency_overrides[database.get_db] = override_get_db

    with TestClient(main.app) as c:
        yield c


def test_create_and_get_experience(client):
    payload = {
        "company": "Acme Corp",
        "role": "Backend Engineer",
        "dates": "2022-2024",
        "category": "Engineering",
        "bullets": [
            {"text": "Built the payments API", "skills": "python, fastapi"}
        ],
    }

    resp = client.post("/api/experiences", json=payload)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["company"] == payload["company"]
    assert "id" in data

    # fetch experiences
    resp2 = client.get("/api/experiences")
    assert resp2.status_code == 200
    items = resp2.json()
    assert isinstance(items, list) and len(items) == 1


def test_tailor_endpoint_monkeypatched(client, monkeypatch):
    # monkeypatch the tailor_resume_bullets function imported in main
    def fake_tailor(job_description, raw_exps):
        return {
            "match_score": 90,
            "extracted_keywords": ["python", "fastapi"],
            "tailored_bullets": [],
        }

    monkeypatch.setattr(main, "tailor_resume_bullets", fake_tailor)

    resp = client.post("/api/tailor", json={"job_description": "We need a FastAPI engineer"})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["match_score"] == 90
    assert "extracted_keywords" in data
