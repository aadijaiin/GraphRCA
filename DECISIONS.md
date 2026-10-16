# Decision log

Short record of what we chose, what we rejected, and why (supports rules 12 and 13, feeds the blog post).

| Date (IST) | Decision | Alternatives rejected | Why |
| --- | --- | --- | --- |
| 2026-10-16 | FalkorDB as the only data store | Postgres + graph sidecar | Rule 3: no second store means removing the graph removes the product |
| 2026-10-16 | Agent calls parameterized tools, never free-form Cypher | LLM-generated Cypher | Reliability, and every query can be read and explained |
| 2026-10-16 | Python (FastAPI) backend, `falkordb` client, SSE | Node backend | Team familiarity; simple streaming |
| 2026-10-16 | Contracts (schema, tool result, events) written in `docs/` before building | Define while coding | Lets layers be built in parallel |
| 2026-10-16 | MIT license | Apache-2.0 | Simple, permissive; confirm with team (rule 15) |
| 2026-10-16 | Decision -[:AT]-> Store added (reusing the AT type) | Store id as a property on CHANGED | Same SKU has different histories in different stores (DEC-215 at GG-03 vs DEC-209 at SD-04); a relationship keeps the scoping in the graph and in the query |
| 2026-10-16 | trace_decision picks the latest decision before the alert's ts | All decisions on the SKU | Background and distractor decisions on the same SKU must not be returned |
| 2026-10-16 | find_amplifiers filters status='active' AND started_at <= alert ts AND same SKU AND same store | Any campaign on the SKU | Rejects CMP-02 (other SKU, same store), CMP-03 (ended), CMP-04 (other store), CMP-12 (paused) |
| 2026-10-16 | find_expert uses `WHERE y = x OR (y:Ticket AND (y)-[:ABOUT]->(x))` | `collect(a) + collect(b)` list concat | FalkorDB returned "Unable to locate a value with alias" for the concat form |
| 2026-10-16 | search_artifacts runs an AND query, then fills with an OR query | OR only | With OR only, short one-word matches outranked the thread that matched every term |
| 2026-10-16 | Unique constraints via the client (GRAPH.CONSTRAINT), indexes via `queries/00_schema.cypher` | All in Cypher | Constraints are not Cypher in FalkorDB; they require an exact-match index first |
| 2026-10-16 | connect_path (Phase 2) must use a directed shortestPath or an algorithm | Undirected shortestPath | FalkorDB rejects undirected shortestPath and only allows it in WITH/RETURN |
| 2026-10-16 | 9 templated eval incidents (fault_amplified, fault_only, demand_spike) generated alongside hand-written Scenario A | 10 hand-written incidents | Gives the eval set variety now; generator self-validates that each planted chain is the only answer the graph supports |
| 2026-10-16 | Phase 1 investigator is a fixed tool plan; LLM loop replaces only the planner in Phase 2 | Start with the LLM loop | Proves the graph answers every incident before any model is involved; event and answer shapes stay the same |
| 2026-10-16 | Agent hub drawn on the canvas overlay, not added as a graph node | Virtual node in graphData | No layout jitter, and it cannot be mistaken for data |
| 2026-10-16 | One Docker image serves API and built UI; FalkorDB separate | Separate frontend host | One deploy target; same-origin SSE |
| 2026-10-16 | Orchestrator plus department agents (Store Ops, Facilities, Growth, Supply) coordinating through Task and Finding nodes | One investigator agent | Matches how incidents really cross teams and gives Track 02 a real coordination story; each department is a separate model loop with its own tools so it is not a renamed tool group |
| 2026-10-16 | Shared memory in the tenant graph, not a separate graph or shard | A dedicated memory graph | FalkorDB has no cross-graph edges; Findings and Memories must CITE real entities |
| 2026-10-16 | One generic runner, `run_agent(system, tools, task)`; agents are configs | Separate code per agent | Specialists become a prompt plus a tool list once one loop works |
| 2026-10-16 | Findings written by code from tool results, one per tool call | Model writes findings | A Finding is a verified fact; the model can only cite them, not author them |
| 2026-10-16 | Model backends: Claude (Anthropic SDK, claude-opus-5-5) or a deterministic scripted backend | Claude only | No API key on the dev machine; tests, offline demo and fallback need the same flow without a model. Runs are labelled with the backend |
| 2026-10-16 | Fallback if the department split is unstable at the Saturday gate: one agent plus memory | Ship unstable multi-agent | Memory is the Track 02 proof that matters most |
