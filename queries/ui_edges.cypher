// ui_edges: every relationship by node id, for the graph canvas.
MATCH (a)-[e]->(b)
RETURN a.id AS source, type(e) AS type, b.id AS target
