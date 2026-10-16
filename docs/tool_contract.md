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

Tools: search_artifacts, explore_neighbors, trace_decision, find_amplifiers, find_expert, impact_of, connect_path, rank_people, commit_event, write_memory, recall_memory.

## Final answer object (answer validator)

```json
{
  "summary": "...",
  "claims": [{"text": "...", "finding_ids": ["FND-1", "FND-2"]}],
  "actions": [{"text": "Pause Summer Coolers in SD-04", "finding_ids": ["FND-3"]}]
}
```
A claim or action with an empty `finding_ids` is dropped and logged.
