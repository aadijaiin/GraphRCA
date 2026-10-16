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
| Investigation | id, status, started_at, turns (JSON string) |
| Finding | id, tool, summary, ts |
| Memory | id, content, confidence, created_at, last_confirmed; second label `Episodic` \| `Semantic` \| `Procedural` |

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
| PART_OF | Finding -> Investigation | |
| CITES | Finding -> any node | |
| LEARNED_FROM | Memory -> Investigation | |
| ABOUT_ENTITY | Memory -> any node | |
| SUPERSEDES | Memory -> Memory | newer replaces older; old is never overwritten |

Rule: any relationship type no query in `queries/` uses gets deleted before submission.

## Indexes
- Full-text: Artifact.text, Ticket.title, SKU.name, Person.name
- Unique constraint on `id` for every label above
- (Stretch) vector index on Artifact embeddings; confirm syntax in FalkorDB docs first
