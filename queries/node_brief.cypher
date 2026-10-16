// node_brief: label and display name of one node, for naming a root cause or amplifier in the answer.
MATCH (n {id: $id})
RETURN n.id AS id, labels(n)[0] AS label, coalesce(n.name, n.key, n.summary, n.id) AS name, n.kind AS kind
