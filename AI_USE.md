# AI use log

Running log for the README disclosure (rule 11). Add a row whenever an AI tool is used.

| Date | Tool / model | Purpose | Files touched | Human review |
| --- | --- | --- | --- | --- |
| 2026-10-16 | Claude Code (Sonnet 5.5) | Phase 0 scaffolding: docker-compose, db helper, smoke test, contract docs, license | docker-compose.yml, backend/, docs/, LICENSE, DECISIONS.md | To be reviewed by team |
| 2026-10-16 | Claude Code (Opus 5.5) | Phase 1: seed generator, fixtures text (Scenario A, distractors, templates), Cypher queries, tool functions, Phase 1 investigator, tests, FastAPI app, React UI, Dockerfile | seed/, queries/, backend/, frontend/, eval/incidents.json, docs/, Dockerfile | **Pending:** a human must read every query in queries/ line by line and edit the fixture text |

Runtime model used by the agent: _to be filled in (Phase 2)_.
Fixtures (Slack/SOP/ticket text in seed/fixtures/): LLM-drafted by Claude Code; human edit pending.
