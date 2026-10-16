"""Ingestor: valid events become nodes; malformed ones are rejected without changing the graph."""
import pytest

from db import get_graph
from ingestor import ingest
from llm import ScriptedBackend
from orchestrator import investigate

ALERT_TEXT = ("ALERT SD-02: promise time up from 9.1 to 15.4 min. Pick time on Probiotic Buttermilk 500ml is the "
              "main contributor.")


def counts(graph):
    g = get_graph(graph)
    return (g.ro_query("MATCH (n) RETURN count(n)").result_set[0][0],
            g.ro_query("MATCH ()-[r]->() RETURN count(r)").result_set[0][0])


def test_message_links_to_ticket(graph):
    r = ingest(graph, "Picking up FAC-882 after lunch, will bring a spare thermostat.", "PER-003")
    assert r["ok"] and r["alert_id"] is None
    rows = get_graph(graph).ro_query("MATCH (a:Artifact {id: $id})-[:EVIDENCE_FOR]->(t) RETURN t.id",
                                     {"id": r["artifact_id"]}).result_set
    assert rows == [["FAC-882"]]


@pytest.mark.parametrize("text,author,reason", [
    ("FAC-999 is broken again", "PER-003", "FAC-999 does not exist"),
    ("hello", "PER-999", "PER-999 does not exist"),
    ("ALERT SD-02: promise time up from 12 to 9 min, Probiotic Buttermilk", "PER-015", "alert values"),
    ("ALERT ZZ-99: promise time up from 9 to 15 min on Probiotic Buttermilk", "PER-015", "ZZ-99 does not exist"),
    ("ALERT SD-02: promise time up from 9 to 15 min", "PER-015", "exactly one SKU"),
    ("", "PER-003", "1 to 2000 characters"),
])
def test_malformed_rejected_without_writes(graph, text, author, reason):
    before = counts(graph)
    r = ingest(graph, text, author)
    assert not r["ok"] and any(reason in e for e in r["errors"])
    assert counts(graph) == before


def test_alert_handoff_to_orchestrator(graph):
    r = ingest(graph, ALERT_TEXT, "PER-015")
    again = ingest(graph, ALERT_TEXT, "PER-015")
    assert r["ok"] and again["alert_id"] == r["alert_id"]  # idempotent
    answer, _ = investigate(graph, r["alert_id"], ScriptedBackend(), save_run=False)
    assert answer["root_cause"]["id"] == "CMP-01"  # no fault at SD-02: the campaign's demand is the cause
