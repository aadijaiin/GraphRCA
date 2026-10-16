import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parent.parent
ROOT = BACKEND.parent
sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(ROOT / "seed"))

TEST_GRAPH = "test_dashmart"


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
