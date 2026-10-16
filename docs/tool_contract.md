# Contract 2: Tool result shape

The agent never writes free-form Cypher. Every tool is a parameterized query in `queries/` wrapped by a function and returns:

```json
{
  "tool": "trace_decision",
  "args": {"alert_id": "ALERT-SD04-1"},
  "result": { },
  "touched": {
    "nodes": ["SKU-017", "DEC-209"],
    "edges": [{"type": "CHANGED", "from": "DEC-209", "to": "SKU-017"}]
  },
  "sources": ["ART-0042"],
  "error": null
}
```

- `result`: tool-specific JSON, small enough to pass to the LLM.
- `touched.nodes`: node `id` values. `touched.edges`: `{type, from, to}` by node id. These drive the graph animation.
- `sources`: Artifact ids. These drive the provenance panel.
- `error`: `null` on success, else a short string; `result` is then `null` and the graph is unchanged.
- Every id returned must exist in FalkorDB.

Tools by agent:

| Agent | Tools |
| --- | --- |
| Orchestrator | recall_memory, dispatch (one Task per call; several calls in one turn run in parallel), read_findings, submit_answer |
| Store Ops | get_alert, trace_decision, search_artifacts, read_findings |
| Facilities | equipment_status, find_expert, search_artifacts, read_findings |
| Growth | get_alert, find_amplifiers, search_artifacts, read_findings |
| Supply | impact_of, search_artifacts, read_findings |
| Any (Track 01) | connect_path, rank_people |

Every department tool call except read_findings writes one Finding node, from the tool result, by code. The model never writes a Finding's content.

## Final answer object (answer validator)

```json
{
  "summary": "...",
  "claims": [{"text": "...", "finding_ids": ["FND-1", "FND-2"]}],
  "actions": [{"text": "Pause Summer Coolers in SD-04", "finding_ids": ["FND-3"]}]
}
```
A claim or action is dropped and logged if `finding_ids` is empty or cites an id that is not a Finding PART_OF this Investigation. `root_cause` and `amplifier` are `{id, name}` and must be cited by a kept Finding.
