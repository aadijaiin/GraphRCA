import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parent.parent
ROOT = BACKEND.parent
sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(ROOT / "seed"))

TEST_GRAPH = "test_dashmart"
MODEL_SETTINGS = ("LOCAL_MODEL_URL", "LOCAL_MODEL_KEY", "LOCAL_MODEL", "LOCAL_TIMEOUT", "LOCAL_TEMPERATURE",
                  "LOCAL_MAX_TOKENS", "LOCAL_REASONING_EFFORT", "BRAIN_BACKEND", "BRAIN_MODEL", "BRAIN_EFFORT",
                  "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN")


@pytest.fixture(autouse=True)
def no_developer_model_settings(monkeypatch):
    """Tests never see the developer's .env or shell model settings (and so can never reach a real model)."""
    import db  # noqa: F401  (db loads .env on import; clear it after that)
    for name in MODEL_SETTINGS:
        monkeypatch.delenv(name, raising=False)


@pytest.fixture(scope="session")
def graph():
    """Fresh seed in a throwaway graph, so tests never touch the demo graph."""
    import generate
    b, incidents, impact = generate.build()
    generate.validate(b, incidents)
    generate.load(TEST_GRAPH, b)
    yield TEST_GRAPH
    from db import get_graph
    get_graph(TEST_GRAPH).delete()


@pytest.fixture(scope="session")
def truth():
    import generate
    _, incidents, impact = generate.build()
    return {i["alert_id"]: i for i in incidents}
