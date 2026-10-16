# Contract 3: Event stream (SSE)

`GET /investigate/{alert_id}?tenant=dashmart&graph=on` streams server-sent events. The UI renders these and nothing else. Every event: `{"type": ..., "ts": ISO-8601, "investigation_id": "...", "data": {...}}`.

| type | data |
| --- | --- |
| investigation_started | alert_id, tenant, graph_enabled, model (`scripted` or a Claude model id) |
| memory_recalled | memories: [{id, kind, content}], plan (departments in order, or null) |
| task_created | task_id, department, instruction, round |
| tool_call | step, agent, tool, args |
| nodes_touched | step, node_ids |
| edges_touched | step, edges: [{type, from, to}] |
| finding_written | finding_id, agent, task_id, tool, summary, cites: [node ids], sources: [artifact ids] |
| task_completed | task_id, department, report, finding_ids |
| answer_ready | answer (see tool_contract.md), dropped: claims the validator removed |
| memory_written | memory_id, kind (episodic/procedural), content, investigation_id |
| node_created | node_id, label, props (from the Ingestor / simulate-event) |

Each id exists in FalkorDB. Runs are saved as JSON arrays of these events under `runs/`; replay is labeled "replay" in the UI.
Caps: 8 tool calls per agent loop, 3 orchestrator rounds per investigation.
