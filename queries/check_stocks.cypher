// check_stocks: does this store stock this SKU? An alert about a SKU the store does not carry is rejected.
MATCH (st:Store {id: $store_id})-[:STOCKS]->(s:SKU {id: $sku_id})
RETURN count(*) AS n
