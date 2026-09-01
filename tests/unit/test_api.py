from fastapi.testclient import TestClient

from app.api.main import create_app


def test_health():
    app = create_app()
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_predict_not_implemented():
    app = create_app()
    client = TestClient(app)
    response = client.post("/api/predict", json={"fixture_id": 1})
    assert response.status_code == 501


def test_fixtures_not_implemented():
    app = create_app()
    client = TestClient(app)
    response = client.get("/api/fixtures")
    assert response.status_code == 501


def test_stats_not_implemented():
    app = create_app()
    client = TestClient(app)
    response = client.get("/api/stats")
    assert response.status_code == 501


def test_refresh_requires_token():
    app = create_app()
    client = TestClient(app)
    response = client.post("/api/refresh")
    assert response.status_code == 401
