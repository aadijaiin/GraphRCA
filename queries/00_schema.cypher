// Schema: indexes run by seed/generate.py before loading. Statements are separated by ';'.
// Unique constraints on id are created by the loader via the FalkorDB client
// (GRAPH.CONSTRAINT CREATE ... UNIQUE NODE <Label> PROPERTIES 1 id), since they are not Cypher.

// Exact-match (range) indexes on id: required by the unique constraints, and make every {id: $x} lookup an index seek
CREATE INDEX FOR (n:Person) ON (n.id);
CREATE INDEX FOR (n:Store) ON (n.id);
CREATE INDEX FOR (n:SKU) ON (n.id);
CREATE INDEX FOR (n:Equipment) ON (n.id);
CREATE INDEX FOR (n:Supplier) ON (n.id);
CREATE INDEX FOR (n:Campaign) ON (n.id);
CREATE INDEX FOR (n:Ticket) ON (n.id);
CREATE INDEX FOR (n:Decision) ON (n.id);
CREATE INDEX FOR (n:Artifact) ON (n.id);
CREATE INDEX FOR (n:Alert) ON (n.id);
CREATE INDEX FOR (n:Investigation) ON (n.id);
CREATE INDEX FOR (n:Finding) ON (n.id);
CREATE INDEX FOR (n:Memory) ON (n.id);

// Full-text indexes: anchor search runs inside FalkorDB, not in Python
CALL db.idx.fulltext.createNodeIndex('Artifact', 'text');
CALL db.idx.fulltext.createNodeIndex('Ticket', 'title');
CALL db.idx.fulltext.createNodeIndex('SKU', 'name');
CALL db.idx.fulltext.createNodeIndex('Person', 'name')
