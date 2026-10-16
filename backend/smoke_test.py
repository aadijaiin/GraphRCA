"""Phase 0 smoke test: create, read and delete one node in a scratch graph."""
from db import get_graph

g = get_graph("_smoke")
g.query("CREATE (:Person {id: 'p0', name: 'Test Person'})")
res = g.query("MATCH (p:Person {id: $id}) RETURN p.name", {"id": "p0"})
assert res.result_set[0][0] == "Test Person", res.result_set
print("OK: read back", res.result_set[0][0])
g.delete()
