// find_amplifiers: active campaigns that PROMOTE the alert's SKU and TARGET the alert's store,
// started before the alert fired, with their owners and launch evidence.
// Filters reject: campaigns on other SKUs in the same store, the same SKU in other stores, ended/paused campaigns.
MATCH (a:Alert {id: $alert_id})-[:AT]->(st:Store)
MATCH (a)-[:INVOLVES]->(s:SKU)
MATCH (cm:Campaign {status: 'active'})-[:PROMOTES]->(s)
MATCH (cm)-[:TARGETS]->(st)
WHERE cm.started_at <= a.ts
OPTIONAL MATCH (o:Person)-[:OWNS]->(cm)
OPTIONAL MATCH (ev:Artifact)-[:EVIDENCE_FOR]->(cm)
RETURN cm.id AS campaign_id, cm.name AS campaign_name, cm.started_at AS started_at, a.ts AS alert_ts,
       a.id AS alert_id, s.id AS sku_id, st.id AS store_id,
       o.id AS owner_id, o.name AS owner_name, o.role AS owner_role, collect(DISTINCT ev.id) AS evidence
