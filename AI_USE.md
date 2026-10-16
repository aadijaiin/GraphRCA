# AI use log

Running log for the README disclosure (rule 11). Add a row whenever an AI tool is used.

| Date | Tool / model | Purpose | Files touched | Human review |
| --- | --- | --- | --- | --- |
| 2026-10-16 | Claude Code (Sonnet 5.5) | Phase 0 scaffolding: docker-compose, db helper, smoke test, contract docs, license | docker-compose.yml, backend/, docs/, LICENSE, DECISIONS.md | To be reviewed by team |
| 2026-10-16 | Claude Code (Opus 5.5) | Phase 1: seed generator, fixtures text (Scenario A, distractors, templates), Cypher queries, tool functions, Phase 1 investigator, tests, FastAPI app, React UI, Dockerfile | seed/, queries/, backend/, frontend/, eval/incidents.json, docs/, Dockerfile | **Pending:** a human must read every query in queries/ line by line and edit the fixture text |
| 2026-10-16 | Claude Code (Opus 5.5) | Phase 2: orchestrator and department agents, generic runner, Claude and scripted backends, shared-state writes, validator, episodic and procedural memory, ingestor, freshloop tenant, MCP server, phase 2 queries, tests, UI timeline, runbook and docs | backend/, queries/, seed/freshloop.py, frontend/src/, docs/, README.md | **Pending:** human read of every new query (w_*.cypher, recall_memory, rank_people, connect_path) and of the agent prompts in backend/agents.py |

Runtime model used by the agents: Claude Opus 5.5 (`claude-opus-5-5`) via the Anthropic SDK when a key is configured; otherwise a deterministic scripted backend (no model). Every run records which one was used. As of 2026-10-16 no run with the Claude backend has been made from this repo (no key on the dev machine); all recorded runs and tests use the scripted backend.
Fixtures (Slack/SOP/ticket text in seed/fixtures/): LLM-drafted by Claude Code; human edit pending.
