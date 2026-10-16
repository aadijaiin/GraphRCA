"""Terminal investigation: the orchestrator and department agents answer an alert through graph tools.

    python investigate_cli.py ALT-001                     # default backend (Claude if a key is set, else scripted)
    python investigate_cli.py ALT-001 --backend scripted   # or claude, or local (LOCAL_MODEL_URL)
    python investigate_cli.py ALT-001 --events ../frontend/public/runs/ALT-001.json   # save the event log
"""
import argparse
import json

from llm import BACKENDS, default_backend
from orchestrator import investigate
from tools import get_artifacts


def show(ev, quiet=False):
    """Print progress as it happens, so a slow model is visibly waiting, not hung."""
    d = ev["data"]
    if ev["type"] == "memory_recalled":
        plan = d["plan"]["departments"] if d["plan"] else None
        print(f"  memory: {len(d['memories'])} similar incident(s), plan {plan}", flush=True)
    elif ev["type"] == "task_created":
        print(f"  round {d['round']}  -> {d['department']}: {d['instruction']}", flush=True)
    elif ev["type"] == "tool_call":
        args = ", ".join(f"{k}={v!r}" for k, v in d["args"].items())
        print(f"    {d['step']:<4} {d['agent']:<12} {d['tool']}({args})", flush=True)
    elif ev["type"] == "model_started" and not quiet:
        print(f"    ...  {d['agent']:<12} waiting for {d['backend']}", flush=True)
    elif ev["type"] == "model_turn" and not quiet:
        calls = ", ".join(d["tool_calls"]) or "no tool call"
        print(f"    ...  {d['agent']:<12} replied in {d['seconds']}s ({calls})", flush=True)
    elif ev["type"] == "error":
        print(f"  ERROR {d['message']}", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("alert_id", nargs="?", default="ALT-001")
    ap.add_argument("--graph", default="dashmart")
    ap.add_argument("--backend", choices=list(BACKENDS))
    ap.add_argument("--events", help="write the event log (docs/events.md) to this path")
    ap.add_argument("--quiet", action="store_true", help="hide model wait/latency lines")
    args = ap.parse_args()
    backend = BACKENDS.get(args.backend, default_backend)()

    print(f"Investigating {args.alert_id}  (graph '{args.graph}', backend {backend.name}, synthetic data)\n", flush=True)
    answer, inv = investigate(args.graph, args.alert_id, backend, emit=lambda ev: show(ev, args.quiet))
    print(f"\nInvestigation {inv.id}")
    print(f"\n{answer['summary']}\n")
    cited = []
    for c in answer["claims"]:
        refs = []
        for src in c.get("sources", []):
            if src not in cited:
                cited.append(src)
            refs.append(f"[{cited.index(src) + 1}]")
        print(f"  - {c['text']} {''.join(refs)}")
    if answer["actions"]:
        print("\nRecommended actions:")
        for act in answer["actions"]:
            print(f"  - {act['text']}")
    dropped = next((e["data"]["dropped"] for e in inv.events if e["type"] == "answer_ready"), [])
    if dropped:
        print(f"\nValidator dropped {len(dropped)} item(s): {[d.get('reason') for d in dropped]}")
    if cited:
        print("\nSources:")
        by_id = {r["id"]: r for r in get_artifacts(args.graph, cited)}
        for i, aid in enumerate(cited, 1):
            r = by_id[aid]
            print(f"  [{i}] {aid} {r['kind']} {r['source_ref']} - {r['author_name']}, {r['ts']}\n      \"{r['text']}\"")
    for ev in inv.events:
        if ev["type"] == "memory_written":
            print(f"\nMemory ({ev['data']['kind']}): {ev['data']['content']}")
    if args.events:
        with open(args.events, "w") as f:
            json.dump(inv.events, f, indent=1, default=str)
        print(f"\nwrote {len(inv.events)} events to {args.events}")


if __name__ == "__main__":
    main()
