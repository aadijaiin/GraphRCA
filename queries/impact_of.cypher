// impact_of (Supply): what a late supplier breaks. Supplier -> SKUs -> stores stocking them,
// plus active campaigns promoting those SKUs in those stores and their owners.
MATCH (sup:Supplier {id: $supplier_id})-[:SUPPLIES]->(s:SKU)<-[:STOCKS]-(st:Store)
OPTIONAL MATCH (cm:Campaign {status: 'active'})-[:PROMOTES]->(s)
OPTIONAL MATCH (cm)-[tg:TARGETS]->(st)
WITH sup, s, st, CASE WHEN tg IS NULL THEN null ELSE cm END AS cm
OPTIONAL MATCH (o:Person)-[:OWNS]->(cm)
OPTIONAL MATCH (planner:Person)-[:OWNS]->(sup)
RETURN sup.id AS supplier_id, sup.name AS supplier_name, planner.id AS planner_id, planner.name AS planner_name,
       st.id AS store_id, s.id AS sku_id, s.name AS sku_name, s.is_hero AS is_hero,
       cm.id AS campaign_id, cm.name AS campaign_name, o.id AS owner_id, o.name AS owner_name
ORDER BY store_id, sku_id
