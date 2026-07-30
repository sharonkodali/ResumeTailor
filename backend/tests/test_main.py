"""Vault CRUD and tailoring endpoints. The `client` fixture lives in conftest.py."""

import main


def make_payload(**overrides):
    payload = {
        "company": "Acme Corp",
        "role": "Backend Engineer",
        "dates": "2022-2024",
        "category": "Engineering",
        "bullets": [{"text": "Built the payments API", "skills": "python, fastapi"}],
    }
    payload.update(overrides)
    return payload


def test_create_and_get_experience(client):
    payload = make_payload()

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


def test_create_experience_defaults_optional_fields(client):
    """dates/category are optional so parsed-resume entries can omit them."""
    resp = client.post(
        "/api/experiences", json={"company": "Acme", "role": "Engineer", "bullets": []}
    )

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["dates"] == ""
    assert data["category"] == "Work"


def test_bulk_create_saves_every_experience_and_its_bullets(client):
    payload = {
        "experiences": [
            make_payload(company="Acme"),
            make_payload(
                company="Globex",
                bullets=[{"text": "one", "skills": ""}, {"text": "two", "skills": "sql"}],
            ),
        ]
    }

    resp = client.post("/api/experiences/bulk", json=payload)

    assert resp.status_code == 201, resp.text
    created = resp.json()
    assert [e["company"] for e in created] == ["Acme", "Globex"]
    assert all(e["id"] for e in created)
    assert [b["text"] for b in created[1]["bullets"]] == ["one", "two"]

    # The rows are really in the vault, not just echoed back.
    stored = client.get("/api/experiences").json()
    assert len(stored) == 2


def test_bulk_create_rejects_an_empty_import(client):
    resp = client.post("/api/experiences/bulk", json={"experiences": []})

    assert resp.status_code == 400
    assert client.get("/api/experiences").json() == []


def test_update_experience_replaces_fields_and_bullets(client):
    created = client.post(
        "/api/experiences",
        json=make_payload(
            bullets=[
                {"text": "first bullet", "skills": "a"},
                {"text": "second bullet", "skills": "b"},
            ]
        ),
    ).json()

    resp = client.put(
        f"/api/experiences/{created['id']}",
        json=make_payload(
            company="Globex",
            role="Staff Engineer",
            dates="2024-2026",
            category="Work",
            bullets=[{"text": "only bullet now", "skills": "z"}],
        ),
    )

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["id"] == created["id"]
    assert data["company"] == "Globex"
    assert data["role"] == "Staff Engineer"
    assert data["category"] == "Work"
    # The two original bullets are replaced wholesale by the single new one.
    assert [b["text"] for b in data["bullets"]] == ["only bullet now"]

    # The update must not have created a second row.
    assert len(client.get("/api/experiences").json()) == 1


def test_update_missing_experience_returns_404(client):
    resp = client.put("/api/experiences/999999", json=make_payload())
    assert resp.status_code == 404


def test_delete_experience_removes_it_and_its_bullets(client):
    created = client.post("/api/experiences", json=make_payload()).json()

    resp = client.delete(f"/api/experiences/{created['id']}")
    assert resp.status_code == 204

    assert client.get("/api/experiences").json() == []
    # Deleting again is a 404, confirming the row is really gone.
    assert client.delete(f"/api/experiences/{created['id']}").status_code == 404


def test_delete_missing_experience_returns_404(client):
    assert client.delete("/api/experiences/999999").status_code == 404


def test_tailor_endpoint_monkeypatched(client, monkeypatch):
    # The endpoint 400s on an empty vault, so seed one entry first.
    client.post("/api/experiences", json=make_payload())

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


def test_tailor_endpoint_rejects_empty_vault(client):
    resp = client.post("/api/tailor", json={"job_description": "We need a FastAPI engineer"})
    assert resp.status_code == 400
