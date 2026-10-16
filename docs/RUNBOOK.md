# Runbook: running DashMart Brain locally

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

This **drops and recreates** the `dashmart` graph each time. It also rewrites `eval/incidents.json`; `git status` should show no change to it.

Variants:

| Command | What it does | Expected last line |
| --- | --- | --- |
| `python seed/generate.py --if-missing` | Seeds only if `dashmart` does not exist | `graph 'dashmart' exists, skipping seed` |
| `python seed/generate.py --dry-run` | Builds and validates, does not touch FalkorDB | `wrote eval/incidents.json (10 incidents)` |
| `python seed/generate.py --graph other` | Loads into another graph | `loaded graph 'other': 365 nodes, 957 edges` |

If the generator raises `AssertionError: ALT-00x: ...`, a fixture or generator edit broke a planted chain. See Troubleshooting.

## 6. Run tests

```bash
cd backend
pytest -q tests
```

Expected:

```
.......................                                                  [100%]
23 passed in 0.27s
```

Tests seed their own throwaway graph `test_dashmart` and delete it afterwards; they do not touch `dashmart`.

## 7. Investigate Scenario A in the terminal

```bash
python investigate_cli.py ALT-001        # still in backend/
```

Expected (start of output):

```
Investigation INV-ALT-001-...  (graph 'dashmart', synthetic data)

  S1  get_alert(alert_id='ALT-001')  ->  3 nodes, 2 edges
  S2  search_artifacts(text='Probiotic Buttermilk 500ml SD-04')  ->  8 nodes, 0 edges
  S3  trace_decision(alert_id='ALT-001')  ->  14 nodes, 14 edges
  S4  find_amplifiers(alert_id='ALT-001')  ->  6 nodes, 6 edges
  S5  find_expert(entity_id='EQ-SD04-CHA1')  ->  4 nodes, 5 edges

Root cause: Front chiller A1 at SD-04 is down, so Probiotic Buttermilk 500ml was moved far from packing. Amplifier: Summer Coolers pushed demand for it.
```

It then lists 4 claims, 2 recommended actions (pause Summer Coolers and tell Ananya Rao; assign FAC-882 to Rajesh Nair) and 7 sources with their full text. Any of `ALT-001` to `ALT-010` works.

To refresh the recorded replay used by the UI:

```bash
python investigate_cli.py ALT-001 --events ../frontend/public/runs/ALT-001.json
# last line: wrote 16 events to ../frontend/public/runs/ALT-001.json
```

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
# {"ok":true,"graphs":["dashmart"]}

curl -s localhost:8000/api/alerts | head -c 160
# [{"id":"ALT-001","metric":"promise_time_min","before":9.5,"after":16.0,"ts":"2026-10-16T08:30:00Z","store_id":"SD-04",...

curl -s -N localhost:8000/api/investigate/ALT-001 | head -4
# event: investigation_started
# data: {"type": "investigation_started", ..., "data": {"alert_id": "ALT-001", "tenant": "dashmart", "graph_enabled": true}}
#
# event: tool_call
```

An unknown tenant returns 404: `curl -s -o /dev/null -w '%{http_code}' 'localhost:8000/api/graph?tenant=nope'` prints `404`.

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

Open http://localhost:5173. The dev server proxies `/api` to port 8000, so step 8 must be running.

What you should see:

1. Ten alerts on the left, newest first (ALT-001 at SD-04 on top).
2. The full graph on the canvas, coloured by label.
3. Click the ALT-001 alert. The header shows **LIVE**, five steps appear one by one, the touched path lights up with dashed lines to the AGENT hub, and the answer appears on the right.
4. Click **n sources** on a claim to open the source drawer with message text, author and time.
5. Click **replay** next to ALT-001 to play the recorded run; the header shows **REPLAY**.

Deep link for demos: http://localhost:5173/?alert=ALT-001 (or `&mode=replay`).

## 10. Full stack in Docker (alternative to steps 3 to 9)

Stop anything on port 8000 first (step 8's uvicorn).

```bash
docker compose --profile app up -d --build
docker compose logs app | tail -3
```

Expected:

```
app-1  | graph 'dashmart' exists, skipping seed      # or the seed output, on a fresh volume
app-1  | INFO:     Application startup complete.
app-1  | INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

Open http://localhost:8000; the API serves the built UI. Stop with `docker compose --profile app stop app`.

## Daily commands

| Task | Command |
| --- | --- |
| Start FalkorDB | `docker compose up -d falkordb` |
| Reseed after editing `seed/` | `python seed/generate.py` |
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
| `/api/health` returns `Internal Server Error` (HTTP 500) | API is up but FalkorDB is down; there is no fallback store by design | Start FalkorDB; no API restart needed |
| UI shows "Cannot reach the backend" | API not running, or FalkorDB down | Check step 8 and `/api/health` |
| UI loads but the alert list is empty, or CLI says `no alert ALT-001` | Graph not seeded (e.g. after wiping `falkordb-data`) | `python seed/generate.py` |
| `ERROR: [Errno 48] ... address already in use` on port 8000 | Docker `app` container or another uvicorn is running | `docker compose --profile app stop app`, or `lsof -i :8000` and stop that process, or use `--port 8001` (then update the proxy in `frontend/vite.config.js`) |
| `ModuleNotFoundError: No module named 'falkordb'` | venv not active | `source .venv/bin/activate` |
| `ModuleNotFoundError: No module named 'db'` | CLI, tests or uvicorn run from the wrong folder | Run them from `backend/` |
| Generator raises `AssertionError: ALT-00x: decision ...` or `amplifiers ...` | An edit to `seed/` created a second valid answer or broke a planted chain | Revert or adjust the edit; the message names the alert and what the graph now returns |
| `test_eval_file_matches_generator` fails | `seed/` changed but `eval/incidents.json` was not regenerated | `python seed/generate.py`, then commit the updated `eval/incidents.json` |
| `npm run dev` fails with an engine or syntax error | Node too old for Vite 8 | Upgrade Node to 22 LTS or newer |
