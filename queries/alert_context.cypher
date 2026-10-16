// alert_context: the alert with the store it fired at and the SKU it involves (start of every investigation).
MATCH (a:Alert {id: $alert_id})-[:AT]->(st:Store)
MATCH (a)-[:INVOLVES]->(s:SKU)
RETURN a.id AS alert_id, a.kind AS kind, a.metric AS metric, a.before AS before, a.after AS after, a.ts AS ts,
       st.id AS store_id, st.name AS store_name, st.zone AS zone, s.id AS sku_id, s.name AS sku_name
