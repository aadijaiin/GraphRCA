// w_ingest_event: one validated event as a single atomic, idempotent write. MERGE on the content-hash id means
// posting the same message twice changes nothing. Optionally creates an Alert the orchestrator can pick up.
MATCH (p:Person {id: $author_id})
MERGE (ar:Artifact {id: $id})
  ON CREATE SET ar.kind = $kind, ar.text = $text, ar.ts = $ts, ar.source_ref = $source_ref
MERGE (ar)-[:AUTHORED_BY]->(p)
WITH ar
OPTIONAL MATCH (t) WHERE t.id IN $evidence_for
WITH ar, collect(t) AS targets
FOREACH (t IN targets | MERGE (ar)-[:EVIDENCE_FOR]->(t))
WITH ar
OPTIONAL MATCH (st:Store {id: $alert_store_id})
OPTIONAL MATCH (s:SKU {id: $alert_sku_id})
FOREACH (_ IN CASE WHEN $alert_id IS NULL OR st IS NULL OR s IS NULL THEN [] ELSE [1] END |
  MERGE (a:Alert {id: $alert_id})
    ON CREATE SET a.kind = 'sla_drop', a.metric = 'promise_time_min', a.before = $alert_before,
                  a.after = $alert_after, a.ts = $ts
  MERGE (a)-[:AT]->(st)
  MERGE (a)-[:INVOLVES]->(s)
  MERGE (ar)-[:EVIDENCE_FOR]->(a))
RETURN ar.id AS artifact_id
