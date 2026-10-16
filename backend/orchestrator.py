"""Investigation entry point: the orchestrator agent and its department agents, coordinating through the graph.

    answer, inv = investigate("dashmart", "ALT-001")                       # default backend
    answer, inv = investigate("dashmart", "ALT-001", ScriptedBackend())   # no model needed
"""
import json
from pathlib import Path

from agents import ORCHESTRATOR, Ctx, run_agent
from llm import default_backend
from state import Investigation
from tools import TOOLS

RUNS = Path(__file__).resolve().parent.parent / "runs"


def investigate(graph, alert_id, backend=None, emit=None, save_run=True):
    backend = backend or default_backend()
    inv = Investigation(graph, alert_id, backend.name, emit)
    r = TOOLS["get_alert"](graph, alert_id=alert_id)
    inv.emit("investigation_started", alert_id=alert_id, tenant=graph, graph_enabled=True, model=backend.name)
    if r["error"]:
        answer = {"summary": f"Could not start: {r['error']}", "root_cause": None, "amplifier": None,
                  "claims": [], "actions": []}
        inv.emit("answer_ready", answer=answer, dropped=[])
        return answer, inv
    inv.open()
    alert = r["result"]
    ctx = Ctx(graph, inv, backend, alert, shared={"round": 0, "order": [], "instructions": {}, "answer": None})
    ctx.shared["before_dispatch"] = lambda: ctx.shared.__setitem__("round", ctx.shared["round"] + 1)

    # The alert itself is the first Finding, so the answer can cite it.
    from agents import _emit_call
    _emit_call(ctx, "get_alert", {"alert_id": alert_id}, r)
    ctx.shared["alert_finding"], _ = inv.finding("orchestrator", None, r)

    task = (f"Investigate alert {alert_id}: {alert['metric']} at store {alert['store_id']} ({alert['store_name']}, "
            f"{alert['zone']}) rose from {alert['before']} to {alert['after']} at {alert['ts']}. The alert attributes "
            f"it to SKU {alert['sku_id']} ({alert['sku_name']}, category {alert['sku_category']}). The alert itself "
            f"is Finding {ctx.shared['alert_finding']}. Cite Findings by these short refs.")
    try:
        run_agent(ctx, ORCHESTRATOR, task)
    except Exception as e:  # model or API failure: record it, mark the investigation failed, write no memory
        inv.emit("error", message=f"{type(e).__name__}: {e}")
        ctx.shared["answer"] = None
    except KeyboardInterrupt:  # Ctrl+C while waiting on a slow model: do not leave the run marked as running
        inv.finish("failed", {"summary": "Interrupted.", "root_cause": None, "amplifier": None,
                              "claims": [], "actions": []})
        raise
    answer = ctx.shared["answer"] or {"summary": "No answer was submitted.", "root_cause": None, "amplifier": None,
                                      "claims": [], "actions": []}
    dropped = ctx.shared.get("dropped", [])
    inv.emit("answer_ready", answer=answer, dropped=dropped)
    inv.finish("done" if ctx.shared["answer"] else "failed", answer)

    # Remember every department that was dispatched (not only the ones that found something), in round order
    # and then a fixed department order, since parallel dispatches finish in any order.
    plan = list(dict.fromkeys(d for _, _, d in sorted(ctx.shared["order"])))
    if ctx.shared["answer"]:
        inv.remember(alert, answer, plan)

    if save_run:
        RUNS.mkdir(exist_ok=True)
        (RUNS / f"{inv.id}.json").write_text(json.dumps(inv.events, indent=1, default=str))
    return answer, inv
