// procedural_by_key: the current (not superseded) procedural memory for a pattern key.
MATCH (p:Memory:Procedural {key: $key})
WHERE NOT ()-[:SUPERSEDES]->(p)
RETURN p.id AS id, p.plan AS plan, p.times_confirmed AS times_confirmed
