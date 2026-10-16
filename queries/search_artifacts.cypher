// search_artifacts: full-text anchor search over Artifact.text, Ticket.title and SKU.name.
// $q is a RediSearch query string built by the tool (terms OR-ed with '|').
// Scores come from different indexes, so the tool merges and ranks rows in Python.
CALL db.idx.fulltext.queryNodes('Artifact', $q) YIELD node, score
RETURN node.id AS id, 'Artifact' AS label, node.text AS text, node.kind AS kind, node.ts AS ts, score
UNION
CALL db.idx.fulltext.queryNodes('Ticket', $q) YIELD node, score
RETURN node.id AS id, 'Ticket' AS label, node.title AS text, node.status AS kind, node.created_at AS ts, score
UNION
CALL db.idx.fulltext.queryNodes('SKU', $q) YIELD node, score
RETURN node.id AS id, 'SKU' AS label, node.name AS text, node.category AS kind, null AS ts, score
