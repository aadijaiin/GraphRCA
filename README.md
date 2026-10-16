# GraphRCA

An orchestrator agent and a team of department agents investigate cross-team failures at a fictional 10-minute-delivery company, running all of their reasoning as Cypher queries in FalkorDB. When something breaks, the cause usually spans five teams: the Brain finds the chain, names the owner, shows the evidence, and remembers the incident so the next similar one is faster.

> **All data is synthetic.** DashMart (and the second tenant, FreshLoop) are fictional companies; every person, message and ticket is invented by `seed/`. Nothing comes from a real company, Slack or Jira.

_Work in progress: Phases 0 to 2 of the plan in `CONTEXT.md` are built. Contracts are in `docs/`, choices in `DECISIONS.md`, AI use in `AI_USE.md`._

## Quick start

For step-by-step setup with expected output and troubleshooting, see [`docs/RUNBOOK.md`](docs/RUNBOOK.md).

```bash
docker compose up -d falkordb                 # FalkorDB on :6379 (browser on :3000)
python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
python seed/generate.py                       # deterministic seed -> graph 'dashmart', writes eval/incidents.json
python seed/generate.py --tenant freshloop    # second tenant -> graph 'freshloop'

cd backend
python investigate_cli.py ALT-001             # orchestrator + department agents, with cited sources
pytest -q tests                               # 51 tests, no network: seed, tools, agents, memory, ingestion, tenants, MCP, backends
uvicorn app:app --port 8000                   # API

cd ../frontend && npm ci && npm run dev       # UI on :5173 (proxies /api to :8000)
```

Full stack in containers: `docker compose --profile app up -d --build`, then open http://localhost:8000. The app seeds both tenants on first start if they are missing.

### Model backend

Agents choose their tool calls through a backend:

- **Claude** (`claude-opus-5-5` via the Anthropic SDK) when `ANTHROPIC_API_KEY` is set. Override with `BRAIN_MODEL` and `BRAIN_EFFORT` (default `medium`). Requests use server-side refusal fallbacks.
- **Local**: a self-hosted model behind an OpenAI-compatible API (Ollama, vLLM, LM Studio, llama.cpp), aimed at **gpt-oss-20b** with a 16k context. Set `LOCAL_MODEL_URL` (for example `http://mainframe:11434/v1`), `LOCAL_MODEL` (default `gpt-oss:20b`) and optionally `LOCAL_REASONING_EFFORT`. See `docs/RUNBOOK.md` section 13.
- **Scripted**: a fixed, deterministic policy per agent (`backend/scripted.py`) with the same tools, graph writes and events. Used by the tests, for offline runs, and as a fallback.

Force one with `BRAIN_BACKEND=claude|local|scripted`, `--backend` on the CLI, or `?backend=` on the API. Without that, the order is local (if `LOCAL_MODEL_URL` is set), then Claude (if credentials exist), then scripted. The UI header and every Investigation node record which backend produced a run.

## How it works

```
Alert ──> Orchestrator ── recall_memory ──> similar past incidents + learned plan
              │
              ├── dispatch (round 1, parallel) ──> Store Ops   trace_decision
              │                                └> Growth      find_amplifiers
              ├── dispatch (round 2, from a Finding) ─> Facilities  equipment_status, find_expert
              ├── connect_path / rank_people
              └── submit_answer (claims cite Finding ids; the validator drops the rest)
                     └──> Memory: episodic (what happened) + procedural (where to look)
```

- **One generic agent runner** (`backend/agents.py`). Each agent is its own model loop with its own prompt and tool subset: orchestrator, `store_ops`, `facilities`, `growth`, `supply`.
- **Agents coordinate only through the graph.** The orchestrator writes Task nodes; every department tool call writes a Finding that CITES the real nodes it touched, written by code from the tool result. Departments read each other's work with `read_findings`. Facilities is dispatched in round 2 because a Store Ops Finding names the broken unit.
- **Answers are validated.** A claim survives only if it cites Findings of this investigation, and its sources are read from the graph, not from the model.
- **Memory** is written back into the tenant graph. Recall merges the plans of all similar incidents. Store Ops and Growth always run, so memory can add departments or move them earlier but never narrow the search. Measured: ALT-005 (dairy, chiller) takes 1 dispatch round after ALT-001 instead of 2.
- **Ingestor** (`backend/ingestor.py`) turns a pasted message into nodes after validating every reference, in one atomic, idempotent write. A message that reads as an alert creates an Alert the orchestrator can investigate.
- **Tenants**: one FalkorDB graph per company (`dashmart`, `freshloop`). Shared memory lives inside each tenant's graph, because FalkorDB has no cross-graph edges.
- **MCP** (`backend/mcp_server.py`): the same graph tools, plus `investigate` and `ingest_event`, for any MCP client: `claude mcp add dashmart-brain -- python backend/mcp_server.py`.

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | FalkorDB reachable, tenant graphs present |
| `GET /api/graph?tenant=` | Nodes and links for the canvas |
| `GET /api/alerts?tenant=` | Alert list |
| `GET /api/artifacts?ids=&tenant=` | Source text for citations |
| `GET /api/investigate/{alert_id}?tenant=&backend=` | Server-sent events for one investigation (`docs/events.md`) |
| `POST /api/events?tenant=` | Ingestor: `{text, author_id, kind?, channel?}`; 422 with reasons if rejected |

## Deploying

The `Dockerfile` builds one image that serves the API and the UI. Point it at FalkorDB with `FALKORDB_HOST`, `FALKORDB_PORT`, and for FalkorDB Cloud `FALKORDB_USERNAME` / `FALKORDB_PASSWORD`. Set `ANTHROPIC_API_KEY` for the Claude backend. Any container host works (Render, Railway, Fly.io, a VM).

## Graph data model

See `docs/schema.md`. It has 10 company labels (Person, Store, SKU, Equipment, Supplier, Campaign, Ticket, Decision, Artifact, Alert) and 4 agent-layer labels (Investigation, Task, Finding, Memory with Episodic or Procedural), with one graph per tenant.

## Queries (`queries/`)

The tools load these files at runtime; no agent writes Cypher.

| File | Purpose |
| --- | --- |
| `00_schema.cypher` | Range indexes on `id`, full-text indexes (Artifact.text, Ticket.title, SKU.name, Person.name) |
| `alert_context.cypher` | The alert, its store, its SKU and category |
| `search_artifacts.cypher` | Full-text anchor search across messages, tickets and SKUs |
| `trace_decision.cypher` | Alert -> latest decision moving its SKU in its store -> author, causes, assignee, evidence |
| `find_amplifiers.cypher` | Active campaigns promoting the SKU in the store, started before the alert, with owners |
| `find_expert.cypher` | People ranked by WORKED_ON history with an entity (directly or via tickets about it) |
| `equipment_status.cypher` | Equipment at a store with owners and tickets, flagging open unassigned ones |
| `impact_of.cypher` | Supplier -> SKUs -> stores, with active campaigns and owners (what a delay breaks) |
| `connect_path.cypher` | Shortest path in either direction via `algo.SPpaths` (shortestPath is directed only) |
| `rank_people.cypher` | People linked to the incident's cited entities, PageRank as tie-break |
| `read_findings.cypher` | The shared state: every Finding of an investigation |
| `recall_memory.cypher` | Similar past incidents (same metric and SKU category) and their procedural plans |
| `procedural_by_key.cypher`, `finding_sources.cypher`, `node_brief.cypher` | Memory merge, claim sources, naming entities in answers |
| `w_*.cypher` | Writes: Investigation, Task, Finding, episodic and procedural Memory, ingested events |
| `ingest_vocab.cypher`, `check_ids.cypher`, `check_stocks.cypher` | Ingestor extraction and validation |
| `get_artifacts.cypher` | Source text, author and time for citations |
| `ui_nodes.cypher`, `ui_edges.cypher`, `ui_alerts.cypher` | Graph snapshot and alert list for the UI |

## Credits

FalkorDB and its Python client, FastAPI, Uvicorn, Pydantic, the Anthropic Python SDK, the OpenAI Python SDK (as a client for OpenAI-compatible local servers), the MCP Python SDK, React, Vite, react-force-graph-2d.

## AI use

See `AI_USE.md` (summarised here before submission).

## License

MIT, see `LICENSE`.
