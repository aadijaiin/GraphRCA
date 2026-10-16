// w_write_episodic: what happened in this incident, linked to where it happened and what caused it.
MATCH (i:Investigation {id: $investigation_id})
CREATE (m:Memory:Episodic {id: $id, content: $content, created_at: $ts, alert_id: $alert_id, metric: $metric,
                           sku_category: $sku_category, root_cause_kind: $root_cause_kind, root_cause_id: $root_cause_id})
CREATE (m)-[:LEARNED_FROM]->(i)
WITH m
UNWIND $about AS eid
MATCH (n {id: eid})
CREATE (m)-[:ABOUT_ENTITY]->(n)
RETURN m.id
