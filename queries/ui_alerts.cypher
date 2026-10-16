// ui_alerts: alert list for the UI, newest first.
MATCH (a:Alert)-[:AT]->(st:Store)
MATCH (a)-[:INVOLVES]->(s:SKU)
RETURN a.id AS id, a.metric AS metric, a.before AS before, a.after AS after, a.ts AS ts,
       st.id AS store_id, s.name AS sku_name
ORDER BY a.ts DESC
