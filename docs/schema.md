# Contract 1: Graph schema

One FalkorDB graph per tenant (`dashmart`, `freshloop`), identical schema. Graph name comes from the request, never a global. All data is **synthetic**.

## Node labels

| Label | Properties |
| --- | --- |
| Person | id, name, role, team |
| Store | id, name, zone |
| SKU | id, name, category, is_hero |
| Equipment | id, kind, name, location |
| Supplier | id, name |
| Campaign | id, name, status (`active`/`paused`/`ended`), started_at |
| Ticket | id, key, title, status (`open`/`assigned`/`done`), created_at |
| Decision | id, summary, decided_at |
| Artifact | id, kind (`slack`/`sop`/`ticket_text`), text, ts, source_ref |
| Alert | id, kind, metric, before, after, ts |
| Investigation | id, alert_id, status (`running`/`done`/`failed`), model, started_at, finished_at, answer (JSON string) |
| Task | id, department (`store_ops`/`facilities`/`growth`/`supply`), instruction, round, status (`open`/`done`), report |
| Finding | id, agent, tool, task_id, summary, data (JSON string of the tool result), ts |
| Memory | id, content, created_at; second label `Episodic` or `Procedural` (`Semantic` is cut for now). Episodic: alert_id, metric, sku_category, root_cause_kind. Procedural: key (`metric\|sku_category\|root_cause_kind`), plan (JSON list of departments in order), times_confirmed, last_confirmed |

`id` is unique per label (unique constraint) and, by convention, unique across the whole graph (tools look nodes up by id alone). Timestamps are ISO-8601 UTC strings.

## Relationships

| Type | From -> To | Properties |
| --- | --- | --- |
| STOCKS | Store -> SKU | |
| HAS_EQUIPMENT | Store -> Equipment | |
| SUPPLIES | Supplier -> SKU | |
| PROMOTES | Campaign -> SKU | |
| TARGETS | Campaign -> Store | |
| OWNS | Person -> Campaign / Ticket / Equipment / Supplier | on a Ticket, OWNS means assignee; an open ticket with no OWNS is unassigned |
| WORKED_ON | Person -> Equipment / Ticket / SKU | |
| ABOUT | Ticket -> Equipment | |
| CHANGED | Decision -> SKU | from, to |
| MADE_BY | Decision -> Person | |
| BECAUSE_OF | Decision -> Ticket / Equipment | |
| EVIDENCE_FOR | Artifact -> Decision / Ticket / Campaign / Alert | |
| AUTHORED_BY | Artifact -> Person | |
| AT | Alert -> Store, Decision -> Store | scopes alerts and decisions to a store |
| INVOLVES | Alert -> SKU | |
| TRIGGERED_BY | Investigation -> Alert | |
| PART_OF | Finding -> Investigation, Task -> Investigation | the shared state every agent reads and writes |
| CITES | Finding -> any node | |
| LEARNED_FROM | Memory -> Investigation | |
| ABOUT_ENTITY | Memory -> any node | Episodic memory -> store, SKU, root cause, amplifier |
| SUPERSEDES | Memory -> Memory | newer replaces older; old is never overwritten |

Rule: any relationship type no query in `queries/` uses gets deleted before submission.

## Indexes
- Full-text: Artifact.text, Ticket.title, SKU.name, Person.name
- Unique constraint on `id` for every label above
- (Stretch) vector index on Artifact embeddings; confirm syntax in FalkorDB docs first

## Shared memory lives in the tenant graph

Investigation, Task, Finding and Memory nodes are written into the same tenant graph as the company data, not a separate graph: FalkorDB has no edges across graphs, and Findings and Memories are useful only because they link to real entities. Isolation between tenants comes from one graph per tenant.
