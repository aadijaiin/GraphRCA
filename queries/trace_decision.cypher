// trace_decision: from an alert to the latest decision that moved the alert's SKU in the alert's store
// before the alert fired; then the decision's author, evidence, causes, each cause's owner/assignee
// and each cause's own evidence. One row per cause (the tool aggregates).
// Scoping by store (Decision-[:AT]->Store) and time is what rejects the same SKU's history in other stores.
MATCH (a:Alert {id: $alert_id})-[:INVOLVES]->(s:SKU)
MATCH (a)-[:AT]->(st:Store)
MATCH (d:Decision)-[c:CHANGED]->(s)
MATCH (d)-[:AT]->(st)
WHERE d.decided_at <= a.ts
WITH a, s, st, d, c ORDER BY d.decided_at DESC LIMIT 1
OPTIONAL MATCH (d)-[:MADE_BY]->(p:Person)
OPTIONAL MATCH (ev:Artifact)-[:EVIDENCE_FOR]->(d)
WITH a, s, st, d, c, p, collect(DISTINCT ev.id) AS evidence
OPTIONAL MATCH (d)-[:BECAUSE_OF]->(cause)
OPTIONAL MATCH (owner:Person)-[:OWNS]->(cause)
OPTIONAL MATCH (cev:Artifact)-[:EVIDENCE_FOR]->(cause)
RETURN d.id AS decision_id, d.summary AS summary, d.decided_at AS decided_at,
       c.from AS moved_from, c.to AS moved_to, s.id AS sku_id, st.id AS store_id, a.id AS alert_id,
       p.id AS author_id, p.name AS author_name, p.role AS author_role, evidence,
       cause.id AS cause_id, labels(cause)[0] AS cause_label,
       coalesce(cause.title, cause.name) AS cause_name, cause.status AS cause_status,
       owner.id AS cause_owner_id, owner.name AS cause_owner_name, owner.role AS cause_owner_role,
       collect(DISTINCT cev.id) AS cause_evidence
