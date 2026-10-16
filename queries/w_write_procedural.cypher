// w_write_procedural: where to look first for this pattern. A changed plan creates a new memory that SUPERSEDES
// the old one (history stays traceable); the same plan just bumps times_confirmed.
MATCH (i:Investigation {id: $investigation_id})
OPTIONAL MATCH (old:Memory:Procedural {key: $key})
WHERE NOT ()-[:SUPERSEDES]->(old)
WITH i, old
FOREACH (_ IN CASE WHEN old IS NOT NULL AND old.plan = $plan THEN [1] ELSE [] END |
  SET old.times_confirmed = old.times_confirmed + 1, old.last_confirmed = $ts
  MERGE (old)-[:LEARNED_FROM]->(i))
FOREACH (_ IN CASE WHEN old IS NULL OR old.plan <> $plan THEN [1] ELSE [] END |
  CREATE (m:Memory:Procedural {id: $id, key: $key, plan: $plan, content: $content, created_at: $ts,
                               last_confirmed: $ts, times_confirmed: 1})
  CREATE (m)-[:LEARNED_FROM]->(i))
WITH old
OPTIONAL MATCH (new:Memory:Procedural {id: $id})
FOREACH (_ IN CASE WHEN old IS NOT NULL AND new IS NOT NULL THEN [1] ELSE [] END | CREATE (new)-[:SUPERSEDES]->(old))
RETURN coalesce(new.id, old.id) AS memory_id, new IS NOT NULL AS created
