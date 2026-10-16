// connect_path (Track 01): shortest path between two nodes in either direction, to test whether two events are linked.
// Uses algo.SPpaths because FalkorDB's shortestPath() is directed-only. A short path is a link, not proof of cause.
MATCH (a {id: $from_id}), (b {id: $to_id})
CALL algo.SPpaths({sourceNode: a, targetNode: b, relDirection: 'both', maxLen: $max_len, pathCount: 1})
YIELD path, pathWeight
RETURN [n IN nodes(path) | n.id] AS node_ids, [n IN nodes(path) | labels(n)[0]] AS labels,
       [r IN relationships(path) | [startNode(r).id, type(r), endNode(r).id]] AS edges, pathWeight AS hops
