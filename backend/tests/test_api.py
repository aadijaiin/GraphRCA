"""API: the backends list the UI's model dropdown is built from."""
import pytest
from fastapi.testclient import TestClient

import app as app_module


@pytest.fixture
def client():
    return TestClient(app_module.app)


def test_backends_lists_scripted_and_server_model(client, monkeypatch):
    monkeypatch.setenv("LOCAL_MODEL_URL", "https://integrate.api.nvidia.com/v1")
    monkeypatch.setenv("LOCAL_MODEL", "openai/gpt-oss-20b")
    monkeypatch.setenv("LOCAL_MODEL_KEY", "nvapi-secret")
    monkeypatch.setattr(app_module, "has_credentials", lambda: False)
    body = client.get("/api/backends").json()
    assert [b["id"] for b in body] == ["scripted", "local"]
    assert body[1] == {"id": "local", "label": "Server · openai/gpt-oss-20b", "available": True, "hint": None}
    assert "nvapi-secret" not in str(body)  # never leaks the key


def test_server_model_marked_unavailable_without_url(client, monkeypatch):
    monkeypatch.delenv("LOCAL_MODEL_URL", raising=False)
    monkeypatch.setattr(app_module, "has_credentials", lambda: False)
    local = next(b for b in client.get("/api/backends").json() if b["id"] == "local")
    assert local["available"] is False and ".env" in local["hint"]


def test_graph_down_is_a_clear_503(client, monkeypatch):
    from redis.exceptions import ConnectionError as GraphConnectionError

    def down(*a, **k):
        raise GraphConnectionError("Error 61 connecting to localhost:6379. Connection refused.")
    monkeypatch.setattr(app_module, "run", down)
    r = client.get("/api/alerts?tenant=dashmart")
    assert r.status_code == 503 and "docker compose up -d falkordb" in r.json()["detail"]
