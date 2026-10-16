// ui_nodes: every node with a display name, for the graph canvas.
MATCH (n)
RETURN n.id AS id, labels(n)[0] AS label, coalesce(n.name, n.key, n.summary, n.text, n.id) AS name
