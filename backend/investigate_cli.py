"""Terminal investigation: answers an alert using only graph tool calls and prints the cited sources.

    python investigate_cli.py ALT-001
    python investigate_cli.py ALT-001 --events ../frontend/public/runs/ALT-001.json   # save the event log
"""
import argparse
import json

from investigator import investigate
from tools import get_artifacts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("alert_id", nargs="?", default="ALT-001")
    ap.add_argument("--graph", default="dashmart")
    ap.add_argument("--events", help="write the event log (docs/events.md) to this path")
    args = ap.parse_args()

    answer, run = investigate(args.graph, args.alert_id)
    print(f"Investigation {run.id}  (graph '{args.graph}', synthetic data)\n")
    for s in run.steps:
        status = s["error"] or f"{len(s['touched']['nodes'])} nodes, {len(s['touched']['edges'])} edges"
        print(f"  {s['step']}  {s['tool']}({', '.join(f'{k}={v!r}' for k, v in s['args'].items())})  ->  {status}")

    print(f"\n{answer['summary']}\n")
    cited = []
    for c in answer["claims"]:
        refs = []
        for src in c.get("sources", []):
            if src not in cited:
                cited.append(src)
            refs.append(f"[{cited.index(src) + 1}]")
        print(f"  - {c['text']} {''.join(refs)}  (steps {', '.join(c['finding_ids'])})")
    if answer["actions"]:
        print("\nRecommended actions:")
        for act in answer["actions"]:
            print(f"  - {act['text']}  (steps {', '.join(act['finding_ids'])})")
    if cited:
        print("\nSources:")
        by_id = {r["id"]: r for r in get_artifacts(args.graph, cited)}
        for i, aid in enumerate(cited, 1):
            r = by_id[aid]
            print(f"  [{i}] {aid} {r['kind']} {r['source_ref']} - {r['author_name']}, {r['ts']}\n      \"{r['text']}\"")
    if args.events:
        with open(args.events, "w") as f:
            json.dump(run.events, f, indent=1)
        print(f"\nwrote {len(run.events)} events to {args.events}")


if __name__ == "__main__":
    main()
