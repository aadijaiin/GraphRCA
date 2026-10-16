# GraphRCA

An agent that investigates cross-team failures at a fictional 10-minute-delivery company by running its reasoning as Cypher queries in FalkorDB. When something breaks, the cause usually spans five teams: the Brain finds the chain, names the owner, shows the evidence, and (Phase 2) remembers the fix.

> **All data is synthetic.** DashMart is a fictional company; every person, message and ticket is invented by `seed/generate.py`. Nothing comes from a real company, Slack or Jira.

_Work in progress (Phase 1 of the plan in `CONTEXT.md`). Contracts are in `docs/`, choices in `DECISIONS.md`, AI use in `AI_USE.md`._

## Quick start

For step-by-step setup with expected output and troubleshooting, see [`docs/RUNBOOK.md`](docs/RUNBOOK.md).

```bash
docker compose up -d falkordb                 # FalkorDB on :6379 (browser on :3000)
python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
python seed/generate.py                       # deterministic seed -> graph 'dashmart', writes eval/incidents.json

cd backend
python investigate_cli.py ALT-001             # Scenario A in the terminal, with cited sources
pytest -q tests                               # seed, tools, and all 10 seeded incidents vs ground truth
uvicorn app:app --port 8000                   # API

cd ../frontend && npm install && npm run dev  # UI on :5173 (proxies /api to :8000)
```

Full stack in containers: `docker compose --profile app up -d --build`, then open http://localhost:8000. The app seeds the graph on first start if it is missing.

## Deploying

The `Dockerfile` builds one image that serves the API and the UI. Point it at FalkorDB with `FALKORDB_HOST`, `FALKORDB_PORT`, and for FalkorDB Cloud `FALKORDB_USERNAME` / `FALKORDB_PASSWORD`. Any container host works (Render, Railway, Fly.io, a VM).

## Graph data model

See `docs/schema.md`: 10 company labels (Person, Store, SKU, Equipment, Supplier, Campaign, Ticket, Decision, Artifact, Alert), 3 agent-layer labels (Investigation, Finding, Memory), one graph per tenant.

## Queries (`queries/`)

The tools load these files at runtime; the agent never writes Cypher.

| File | Purpose |
| --- | --- |
| `00_schema.cypher` | Range indexes on `id` and full-text indexes (Artifact.text, Ticket.title, SKU.name, Person.name) |
| `alert_context.cypher` | The alert, its store and its SKU |
| `search_artifacts.cypher` | Full-text anchor search across messages, tickets and SKUs |
| `trace_decision.cypher` | Alert -> latest decision moving its SKU in its store -> author, causes, assignee, evidence |
| `find_amplifiers.cypher` | Active campaigns promoting the SKU in the store, started before the alert, with owners |
| `find_expert.cypher` | People ranked by WORKED_ON history with an entity (directly or via tickets about it) |
| `get_artifacts.cypher` | Source text, author and time for citations |
| `ui_nodes.cypher`, `ui_edges.cypher`, `ui_alerts.cypher` | Graph snapshot and alert list for the UI |

## Credits

FalkorDB and its Python client, FastAPI, Uvicorn, React, Vite, react-force-graph-2d.

## AI use

See `AI_USE.md` (summarised here before submission).

## License

MIT, see `LICENSE`.
