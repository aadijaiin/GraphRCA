# Runbook: running Axon locally

Step-by-step setup from a clean clone, with the output you should expect at each step. If your output differs, check [Troubleshooting](#troubleshooting).

Outputs below were captured from a fresh clone on macOS (Docker 29.8, Python 3.13, Node 24). Timestamps, process ids and investigation ids will differ on your machine; counts and answers should not, because the seed is deterministic.

All data is synthetic.

## 0. Prerequisites

| Tool | Tested with | Check |
| --- | --- | --- |
| Docker (Desktop or Engine) with Compose | 29.8 | `docker --version` and `docker info` |
| Python | 3.13 | `python3 --version` |
| Node.js | 24 (Vite 8 needs 20.19+ or 22.12+) | `node --version` |
| Free ports | 6379, 3000, 8000, 5173 | see Troubleshooting if one is taken |

Docker Desktop must be **running**, not just installed (`docker info` should print server details, not a socket error).

## 1. Clone

```bash
git clone git@github.com:aadijaiin/GraphRCA.git
cd GraphRCA
```

Expected: the repo root contains `backend/ docs/ eval/ frontend/ queries/ seed/` plus `docker-compose.yml`, `Dockerfile`, `README.md`, `CONTEXT.md`.

## 2. Start FalkorDB

```bash
docker compose up -d falkordb
docker compose ps
```

Expected:

```
 Container graphrca-falkordb-1 Started
NAME                  ...  STATUS   PORTS
graphrca-falkordb-1   ...  running  0.0.0.0:3000->3000/tcp, 0.0.0.0:6379->6379/tcp
```

Data persists in `./falkordb-data/` (gitignored), so the graph survives container restarts. The FalkorDB browser is at http://localhost:3000.

## 3. Python environment

```bash
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
```

Expected: pip finishes without errors. The rest of this runbook assumes the venv is active.

Optional: `cp .env.example .env`. The defaults (localhost:6379, no password) work for local Docker, so this is only needed to point at another FalkorDB.

## 4. Smoke test the connection

```bash
cd backend
python smoke_test.py
cd ..
```

Expected:

```
OK: read back Test Person
```

It creates a node in a scratch graph `_smoke`, reads it back and deletes the graph.

## 5. Seed the graph

```bash
python seed/generate.py
```

Expected (exact; the seed is fixed):

```
nodes: {'Person': 30, 'Store': 6, 'Equipment': 24, 'SKU': 60, 'Supplier': 8, 'Campaign': 12, 'Ticket': 40, 'Decision': 25, 'Alert': 10, 'Artifact': 150} total 365
edges: {'HAS_EQUIPMENT': 24, 'OWNS': 71, 'SUPPLIES': 60, 'PROMOTES': 19, 'TARGETS': 17, 'ABOUT': 20, 'CHANGED': 25, 'AT': 35, 'MADE_BY': 25, 'BECAUSE_OF': 15, 'INVOLVES': 10, 'WORKED_ON': 114, 'AUTHORED_BY': 150, 'EVIDENCE_FOR': 109, 'STOCKS': 263} total 957
wrote eval/incidents.json (10 incidents)
loaded graph 'dashmart': 365 nodes, 957 edges
```

This **drops and recreates** the `dashmart` graph each time, which also **wipes everything the agents have learned** (Investigation, Finding and Memory nodes). It rewrites `eval/incidents.json` too; `git status` should show no change to it.

Then seed the second tenant:

```bash
python seed/generate.py --tenant freshloop
# loaded graph 'freshloop': 25 nodes, 41 edges
```

Variants:

| Command | What it does | Expected last line |
| --- | --- | --- |
| `python seed/generate.py --if-missing` | Seeds only if `dashmart` does not exist | `graph 'dashmart' exists, skipping seed` |
| `python seed/generate.py --dry-run` | Builds and validates, does not touch FalkorDB | `wrote eval/incidents.json (10 incidents)` |
| `python seed/generate.py --graph other` | Loads into another graph | `loaded graph 'other': 365 nodes, 957 edges` |
| `python seed/generate.py --tenant freshloop --if-missing` | Seeds the second tenant only if missing | `graph 'freshloop' exists, skipping seed` |

If the generator raises `AssertionError: ALT-00x: ...`, a fixture or generator edit broke a planted chain. See Troubleshooting.

## 6. Run tests

```bash
cd backend
pytest -q tests
```

Expected:

```
...................................................                      [100%]
51 passed in 2.28s
```

Tests seed their own throwaway graphs (`test_dashmart`, `test_memory`, `test_freshloop`) and delete them afterwards; they do not touch `dashmart` or `freshloop`. They use the scripted backend, so they need no API key and make no network calls.

## 7. Investigate Scenario A in the terminal

```bash
python investigate_cli.py ALT-001        # still in backend/
```

Without an Anthropic key this uses the scripted backend. With `ANTHROPIC_API_KEY` set it uses Claude; force either with `--backend scripted` or `--backend claude`. Expected with the scripted backend on a fresh seed (start of output):

```
Investigation INV-ALT-001-...  (graph 'dashmart', backend scripted, synthetic data)

    S1   orchestrator get_alert(alert_id='ALT-001')
    S2   orchestrator recall_memory(alert_id='ALT-001')
  memory: 0 similar incident(s), plan None
  round 1  -> store_ops: Find any recent decision that changed how Probiotic Buttermilk 500ml is handled at SD-04, who made it and why.
  round 1  -> growth: Check whether any active campaign is pushing Probiotic Buttermilk 500ml in SD-04 around 2026-10-16T08:30:00Z.
    S3   store_ops    trace_decision(alert_id='ALT-001')
    S4   growth       find_amplifiers(alert_id='ALT-001')
  round 2  -> facilities: Store Ops traced the move at SD-04 to EQ-SD04-CHA1 (Front chiller A1). Check its tickets and who should fix it.
    S5   facilities   equipment_status(store_id='SD-04', kind='chiller')
    S6   facilities   find_expert(entity_id='EQ-SD04-CHA1')
    S7   orchestrator connect_path(from_id='CMP-01', to_id='EQ-SD04-CHA1')
    S8   orchestrator submit_answer(root_cause_id='EQ-SD04-CHA1', amplifier_id='CMP-01')

Root cause: Front chiller A1 at SD-04 is down, so Probiotic Buttermilk 500ml was moved far from packing. Amplifier: Summer Coolers pushed demand for it.
```

The two round 1 departments run in parallel, so their lines (S3, S4) can appear in either order. The output then lists 5 claims, 2 recommended actions (pause Summer Coolers and tell Ananya Rao; assign FAC-882 to Rajesh Nair), the sources with full text, and the two memories written. Any of `ALT-001` to `ALT-010` works.

**See memory work:** run `python investigate_cli.py ALT-005` next. It is also a dairy alert caused by a chiller, so it recalls ALT-001 and dispatches Facilities in round 1:

```
  memory: 1 similar incident(s), plan ['store_ops', 'growth', 'facilities']
  round 1  -> ...store_ops / growth / facilities...
  round 1  -> facilities: Memory: a similar past incident was caused by a chiller. Check chiller units at ED-06 for open unassigned tickets and who should fix them.
```

Memory persists in the graph until you reseed. To refresh the recorded replay used by the UI, reseed first so it shows a first-time run:

```bash
python ../seed/generate.py && python investigate_cli.py ALT-001 --backend scripted --events ../frontend/public/runs/ALT-001.json
# last line: wrote 37 events to ../frontend/public/runs/ALT-001.json
```

Runs are also saved under `runs/` (gitignored), one JSON event log per investigation.

## 8. Start the API

```bash
uvicorn app:app --reload --port 8000     # still in backend/; leave this terminal open
```

Expected:

```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

Check it from a second terminal:

```bash
curl -s localhost:8000/api/health
# {"ok":true,"graphs":["dashmart","freshloop"]}

curl -s localhost:8000/api/alerts | head -c 160
# [{"id":"ALT-001","metric":"promise_time_min","before":9.5,"after":16.0,"ts":"2026-10-16T08:30:00Z","store_id":"SD-04",...

curl -s -N localhost:8000/api/investigate/ALT-001 | head -4
# event: investigation_started
# data: {"type": "investigation_started", ..., "data": {"alert_id": "ALT-001", "tenant": "dashmart", "graph_enabled": true, "model": "scripted"}}
#
# event: tool_call
```

An unknown tenant returns 404: `curl -s -o /dev/null -w '%{http_code}' 'localhost:8000/api/graph?tenant=nope'` prints `404`.

Ingest a live event (the Ingestor):

```bash
curl -s -X POST localhost:8000/api/events -H 'content-type: application/json' \
  -d '{"text":"Picking up FAC-882 after lunch.","author_id":"PER-003"}' | head -c 120
# {"ok":true,"artifact_id":"ART-L26521EEE","alert_id":null,"created":[...

curl -s -X POST localhost:8000/api/events -H 'content-type: application/json' \
  -d '{"text":"FAC-999 is down","author_id":"PER-003"}'
# {"detail":{"errors":["FAC-999 does not exist"]}}        (HTTP 422, graph unchanged)
```

A message shaped like `ALERT SD-02: promise time up from 9.1 to 15.4 min. Pick time on Probiotic Buttermilk 500ml ...` creates an Alert (`alert_id` in the response) that then appears in the alert list and can be investigated.

Asking for Claude without credentials fails fast:

```bash
curl -s 'localhost:8000/api/investigate/ALT-001?backend=claude'
# {"detail":"backend unavailable: no Anthropic credentials: set ANTHROPIC_API_KEY or run `ant auth login`"}   (HTTP 400)
```

## 9. Start the UI (dev mode)

```bash
cd frontend
npm ci                 # first time only; uses package-lock.json
npm run dev
```

Expected:

```
  VITE v8.3.4  ready in 529 ms

  ➜  Local:   http://localhost:5173/
```

Open http://localhost:5173 for the landing page, or http://localhost:5173/app for the workbench ("Launch demo" goes there too). The dev server proxies `/api` to port 8000, so step 8 must be running.

**Why :5173 and :8000 both show the app:** :5173 is the Vite dev server (live source, hot reload) and forwards `/api` to :8000. :8000 is FastAPI: the API, plus the last *built* UI from `frontend/dist`, so Docker and deployments need only one port. The UI on :8000 only changes after `npm run build`, so develop on :5173.

What you should see on `/app`:

1. Alert cards, newest first (ALT-001 at SD-04 first; **View all 10** shows the rest), and the top bar says **FalkorDB live**.
2. The full graph on the canvas, coloured by label.
3. Click **Investigate** on ALT-001 (pick **Scripted** in the top-bar model picker if no Claude key is set). The header shows **LIVE** and the backend (`scripted` or the Claude model). The timeline shows the memory check, each round's department tasks, and each tool call tagged with the agent that made it. The touched path lights up with dashed lines to the AGENT hub, the answer appears, and "Remembered for next time" lists the memories written.
4. Click **n sources** on a claim to open the source drawer with message text, author and time. Hover a tool step in the timeline to see the nodes and edges it touched.
5. Click **Replay** on ALT-001 to play the recorded run; the header shows **REPLAY**.

The landing page is at `/`; the investigation workbench is at http://localhost:5173/app. Deep link for demos: http://localhost:5173/?alert=ALT-001 (or `&mode=replay`).

## 10. Full stack in Docker (alternative to steps 3 to 9)

Stop anything on port 8000 first (step 8's uvicorn).

```bash
docker compose --profile app up -d --build
docker compose logs app | tail -6
```

Expected:

```
app-1  | graph 'dashmart' exists, skipping seed      # or the seed output, on a fresh volume
app-1  | graph 'freshloop' exists, skipping seed
app-1  | INFO:     Application startup complete.
app-1  | INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

Open http://localhost:8000; the API serves the built UI. The container uses the scripted backend unless you pass `ANTHROPIC_API_KEY` into it (add it under `environment:` in `docker-compose.yml`, never commit the value). Stop with `docker compose --profile app stop app`.

## 11. MCP server (optional)

The same graph tools are available to any MCP client over stdio:

```bash
claude mcp add axon -- /absolute/path/to/GraphRCA/.venv/bin/python /absolute/path/to/GraphRCA/backend/mcp_server.py
```

Tools: `list_alerts`, `get_alert`, `trace_decision`, `find_amplifiers`, `equipment_status`, `find_expert`, `impact_of`, `connect_path`, `rank_people`, `search_artifacts`, `investigate`, `ingest_event`. Each takes a `tenant` (default `dashmart`). FalkorDB must be running.

## 12. Using Claude as the backend

```bash
export ANTHROPIC_API_KEY=...            # or: ant auth login
export BRAIN_MODEL=claude-opus-5-5      # default
export BRAIN_EFFORT=medium              # low | medium | high | xhigh | max
python investigate_cli.py ALT-001 --backend claude
```

The flow, tools, graph writes and events are the same as with the scripted backend; only the choice of tool calls and the wording of the answer come from the model. Each investigation makes several model calls (the orchestrator plus one loop per dispatched department), so expect it to take tens of seconds and to cost real API usage. Claims still have to cite Findings, so the validator may drop some; the CLI prints how many.

## 13. Using a self-hosted model (gpt-oss-20b)

**Store the settings once, in `.env`.** Copy `.env.example` to `.env` in the repo root and fill in `LOCAL_MODEL_KEY`. `.env` is gitignored. The API, the CLI and `model_check.py` load it from any working directory, and `docker compose` reads it for the app container. Values already exported in your shell take precedence over `.env`.

```bash
cp .env.example .env      # then edit .env: LOCAL_MODEL_KEY=nvapi-...
```

In the UI, the model dropdown in the workspace header then offers **Server · openai/gpt-oss-20b** and **Scripted (no model)**. The list comes from `GET /api/backends`, which reports which backends this server has configured (never the key), and the browser remembers your choice.

Host the model on the big machine and point the app at it. Both servers below expose an OpenAI-compatible API.

**Ollama** on the model host:

```bash
ollama pull gpt-oss:20b
OLLAMA_HOST=0.0.0.0:11434 OLLAMA_CONTEXT_LENGTH=16384 ollama serve
```

`OLLAMA_CONTEXT_LENGTH` matters: Ollama's default context is smaller than 16k, and a truncated prompt shows up as an agent that forgets its tools or never calls `submit_answer`.

**vLLM** on the model host (GPU):

```bash
vllm serve openai/gpt-oss-20b --max-model-len 16384 --port 8000
```

Then on the machine running Axon:

```bash
export LOCAL_MODEL_URL=http://<model-host>:11434/v1    # vLLM: http://<model-host>:8000/v1
export LOCAL_MODEL=gpt-oss:20b                         # vLLM: openai/gpt-oss-20b
export LOCAL_REASONING_EFFORT=medium                   # low | medium | high
curl -s $LOCAL_MODEL_URL/models | head -c 200          # should list the model
cd backend && python investigate_cli.py ALT-001 --backend local
```

The first line should read `backend local:gpt-oss:20b`. If the server is down you get `local model server at ... is not reachable` straight away, from the CLI and as an HTTP 400 from the API.

Keep the model port off the public internet: the servers have no authentication by default. Use a private network, a VPN, or an SSH tunnel (`ssh -N -L 11434:localhost:11434 <model-host>`, then `LOCAL_MODEL_URL=http://localhost:11434/v1`). If you put a proxy with a key in front, set `LOCAL_MODEL_KEY`.

**Hosted endpoints (build.nvidia.com and similar).** The same settings work with `LOCAL_MODEL_URL=https://integrate.api.nvidia.com/v1` and `LOCAL_MODEL_KEY=nvapi-...`. Free-tier models can be overloaded: on 2026-10-16 `z-ai/glm-5.3` timed out even on a two-word request. Before an investigation, find a model that is answering and can call tools:

```bash
python model_check.py glm gpt-oss qwen3 --timeout 30
# z-ai/glm-5.3                                       30.0s  FAIL   APITimeoutError: Request timed out.
# <some-model>                                        2.1s  OK     get_alert({'alert_id': 'ALT-001'})
```

Pick a model marked `OK`. Passing is necessary but not sufficient, so then run a full investigation on it.

What to watch on the first runs (the CLI prints all of it): does the orchestrator call `recall_memory` first, dispatch Facilities after Store Ops names a unit, and cite refs like `F3` that the validator accepts? `Validator dropped N item(s)` means it cited something that was not a Finding.

## Daily commands

| Task | Command |
| --- | --- |
| Start FalkorDB | `docker compose up -d falkordb` |
| Reseed after editing `seed/` (also clears learned memory) | `python seed/generate.py && python seed/generate.py --tenant freshloop` |
| Run tests | `cd backend && pytest -q tests` |
| API with reload | `cd backend && uvicorn app:app --reload --port 8000` |
| UI dev server | `cd frontend && npm run dev` |
| Stop everything | `docker compose --profile app down` (data stays in `falkordb-data/`) |
| Wipe all graph data | `docker compose down && rm -rf falkordb-data` then reseed |

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `failed to connect to the docker API at unix:///.../docker.sock` | Docker Desktop is not running | Start Docker Desktop (`open -a Docker` on macOS), wait for `docker info` to succeed, retry |
| `Bind for 0.0.0.0:3000 failed: port is already allocated` (or 6379) | Another FalkorDB/Redis, or a second clone's compose, already holds the port | `docker ps` to find it. Reuse the running FalkorDB, or stop it, or change the host port in `docker-compose.yml` and set `FALKORDB_PORT` |
| `redis.exceptions.ConnectionError: Error 61 connecting to localhost:6379. Connection refused.` | FalkorDB is not running | `docker compose up -d falkordb` |
| API returns HTTP 503 `FalkorDB is not reachable at localhost:6379` (UI: "Cannot reach the backend"); older builds show HTTP 500 and `Error 61 ... Connection refused` in the backend terminal | Docker Desktop is not running (e.g. after a restart), so FalkorDB is down; there is no fallback store by design | Start Docker Desktop, then `docker compose up -d falkordb`; no API restart needed. Graph data persists in `falkordb-data/` |
| UI shows "Cannot reach the backend" | API not running, or FalkorDB down | Check step 8 and `/api/health` |
| UI loads but the alert list is empty, or CLI says `no alert ALT-001` | Graph not seeded (e.g. after wiping `falkordb-data`) | `python seed/generate.py` |
| `ERROR: [Errno 48] ... address already in use` on port 8000 | Docker `app` container or another uvicorn is running | `docker compose --profile app stop app`, or `lsof -i :8000` and stop that process, or use `--port 8001` (then update the proxy in `frontend/vite.config.js`) |
| `ModuleNotFoundError: No module named 'falkordb'` | venv not active | `source .venv/bin/activate` |
| `ModuleNotFoundError: No module named 'db'` | CLI, tests or uvicorn run from the wrong folder | Run them from `backend/` |
| Generator raises `AssertionError: ALT-00x: decision ...` or `amplifiers ...` | An edit to `seed/` created a second valid answer or broke a planted chain | Revert or adjust the edit; the message names the alert and what the graph now returns |
| Investigation says `backend unavailable: no Anthropic credentials` | `--backend claude` / `?backend=claude` with no key or profile | Set `ANTHROPIC_API_KEY` (or `ant auth login`), or use the scripted backend |
| `local model server at ... is not reachable` | Model server down, wrong `LOCAL_MODEL_URL`, or the port is firewalled | `curl $LOCAL_MODEL_URL/models` from this machine; check `OLLAMA_HOST=0.0.0.0` on the host |
| `APITimeoutError` / `Request timed out` from a hosted model | Free-tier endpoint overloaded or queued | `python model_check.py` to find a responsive model, or use your own GPU |
| Local model answers in prose, `No answer was submitted.` | Model without reliable tool calling, or context truncated | Use gpt-oss-20b or another tool-calling model; set the server context to 16k (`OLLAMA_CONTEXT_LENGTH=16384`, vLLM `--max-model-len 16384`) |
| An investigation recalls memories you did not expect | Memory persists in the graph across runs | Reseed to start clean (`python seed/generate.py`) |
| `ModuleNotFoundError: No module named 'mcp'` or `'anthropic'` | Requirements installed before Phase 2 | `pip install -r backend/requirements.txt` |
| `test_eval_file_matches_generator` fails | `seed/` changed but `eval/incidents.json` was not regenerated | `python seed/generate.py`, then commit the updated `eval/incidents.json` |
| `npm run dev` fails with an engine or syntax error | Node too old for Vite 8 | Upgrade Node to 22 LTS or newer |
