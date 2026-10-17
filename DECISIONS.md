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
| 2026-10-16 | Learned plans record every department dispatched; recall merges plans of all similar memories | Plan = departments whose findings were cited; trust top memory | A campaign-caused dairy alert taught the plan [growth] and the next dairy alert (ALT-001) then blamed the campaign instead of the chiller (found by test order) |
| 2026-10-16 | Store Ops and Growth always run in round 1; memory only adds departments | Memory may replace the default plan | A single stale plan still narrowed the search on a scratch graph; memory must be a hint, never a filter |
| 2026-10-16 | Ingestor is deterministic (id patterns, names from the graph) with strict validation and one atomic MERGE write | LLM extraction | Reliable without a key and testable; malformed input must leave the graph untouched. LLM extraction can be added behind the same validator |
| 2026-10-16 | connect_path uses `algo.SPpaths` with `relDirection: 'both'` | Directed shortestPath | Causal chains mix edge directions (CMP-01 TARGETS SD-04 HAS_EQUIPMENT chiller) |
| 2026-10-16 | rank_people = incident-local degree over cited entities, PageRank as tie-break | Global PageRank only | Global PageRank ranks whoever authors most messages; the incident's owner is who OWNS or WORKED_ON its entities |
| 2026-10-16 | Claude backend: claude-opus-5-5, effort medium, server-side refusal fallbacks (`fallbacks: "default"`), prompt caching on stable system+tools, strict tool schemas | Older model ids, forced tool_choice | Current default model; forced tool_choice is rejected on this model; strict schemas keep tool arguments valid |
| 2026-10-16 | ClaudeBackend checks credentials up front | Let the first request fail | The SDK client builds without credentials and fails mid-stream, leaving a running Investigation |
| 2026-10-16 | FreshLoop tenant is 25 nodes, not ~40 | Larger second tenant | Enough for one planted chain and the isolation tests |
| 2026-10-16 | MCP server wraps the same tool functions (mcp 2.x `MCPServer`); agents call tools in-process | Agents call tools through MCP | The demo never depends on the MCP transport; MCP is how outside clients use the graph. Track 01 claim must say exactly this |
| 2026-10-16 | Local backend over OpenAI-compatible chat completions (openai SDK as client) for self-hosted gpt-oss-20b | Provider-specific clients per server | One class covers Ollama, vLLM, LM Studio and llama.cpp; the team hosts the model on its own machine, so no API cost and judges can run it without a key |
| 2026-10-16 | Models cite Findings by short refs (F1, F2); code maps them to full ids | Show full ids | Small models garble 40-character ids, and the validator would then drop correct claims |
| 2026-10-16 | Orchestrator sees Finding summaries, not raw tool JSON | Full data in dispatch results | Keeps a 16k context within budget by round 2 |
| 2026-10-16 | Cap of 6 department tasks instead of 3 dispatch rounds | Round cap | Models that make one tool call per turn would hit a round cap after three departments |
| 2026-10-16 | Invalid JSON tool arguments returned to the model as an error; one reminder to call submit_answer | Crash or accept prose | Local servers do not enforce strict schemas; small models sometimes stop in prose |
| 2026-10-16 | Clean tool names in LocalBackend (strip `<|...`, `functions.`) | Fail on unknown names | First gpt-oss-20b run on build.nvidia.com returned `dispatch<|channel|>commentary` for 9 of 11 orchestrator calls (harmony token leaking from the server) and never submitted an answer |
| 2026-10-16 | `dispatch(tasks=[...])`: one call, departments run concurrently in code | Rely on the model making several tool calls in one turn | gpt-oss-20b makes one call per turn, so Store Ops, Growth and Facilities ran in three sequential turns; parallelism must not depend on the model |
| 2026-10-16 | Per-item validation in dispatch, failed tasks isolated, unverified_refs flagged in reports | All-or-nothing dispatch | One bad item or one model error must not cost the other departments' work; reports are model text, so refs in them are checked against the task's own Findings |
| 2026-10-16 | Bind the alert id in department tools; validate tool arguments in the runner | Trust the model's arguments | gpt-oss-20b passed Finding ref F1 as an alert id and as node ids, and used invalid enum values; local servers do not enforce schemas |
| 2026-10-16 | Validator checks meaning: amplifier is a Campaign, ticket roots resolve to equipment, root must have structural support | Accept any cited id | A real run blamed ENG-404 from keyword hits and wrote that to memory; another named a Decision as amplifier |
