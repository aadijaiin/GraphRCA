"""FreshLoop: a tiny second fictional company (SYNTHETIC) in its own graph, used to prove tenant isolation.

Same schema as DashMart, different people, stores and ids, plus one planted incident: a broken rack forces
a move, an unassigned ticket, and a campaign amplifying demand.
"""
from generate import Builder, shift

ALERT_TS = "2026-10-15T09:00:00Z"


def build():
    b = Builder()
    people = [("FLP-01", "Mira Desai", "Store Manager", "store-ops"), ("FLP-02", "Tarun Sood", "Growth PM", "growth"),
              ("FLP-03", "Leela Pinto", "Facilities Lead", "facilities"),
              ("FLP-04", "Varun Kohli", "Facilities Technician", "facilities"),
              ("FLP-05", "Anita Bose", "Picker Lead", "store-ops"), ("FLP-06", "Kunal Shetty", "SRE", "engineering")]
    for pid, name, role, team in people:
        b.node("Person", id=pid, name=name, role=role, team=team)
    for sid, name in [("FL-01", "FL-01 Indiranagar"), ("FL-02", "FL-02 Koramangala")]:
        b.node("Store", id=sid, name=name, zone="Bengaluru")
        for suffix, kind, ename, loc in [("RACK1", "rack", "Rack 1", "front, 3 steps from packing"),
                                         ("CHL1", "chiller", "Chiller 1", "front, 2 steps from packing")]:
            eid = f"FLEQ-{sid}-{suffix}"
            b.node("Equipment", id=eid, kind=kind, name=ename, location=loc)
            b.edge("HAS_EQUIPMENT", sid, eid)
            b.edge("OWNS", "FLP-03", eid)
    skus = [("FLS-01", "Cold Pressed Orange Juice 1L", "beverages", True), ("FLS-02", "Granola 500g", "snacks", False),
            ("FLS-03", "Almond Milk 1L", "dairy", True), ("FLS-04", "Sourdough Loaf", "bakery", True)]
    b.node("Supplier", id="FLSUP-01", name="Nandi Hills Farms")
    b.edge("OWNS", "FLP-02", "FLSUP-01")
    for sku_id, name, cat, hero in skus:
        b.node("SKU", id=sku_id, name=name, category=cat, is_hero=hero)
        b.edge("SUPPLIES", "FLSUP-01", sku_id)
        for sid in ("FL-01", "FL-02"):
            b.edge("STOCKS", sid, sku_id)

    b.node("Ticket", id="FLT-101", key="FLT-101", title="Rack 1 shelf bracket snapped (FL-01)", status="open",
           created_at=shift(ALERT_TS, -6))
    b.edge("ABOUT", "FLT-101", "FLEQ-FL-01-RACK1")
    b.edge("WORKED_ON", "FLP-04", "FLEQ-FL-01-RACK1")
    b.node("Decision", id="FLD-11", decided_at=shift(ALERT_TS, -5),
           summary="Move Granola 500g from Rack 1 to the overflow shelf at the back until Rack 1 is fixed")
    b.edge("CHANGED", "FLD-11", "FLS-02", **{"from": "Rack 1", "to": "Overflow shelf (back)"})
    b.edge("AT", "FLD-11", "FL-01")
    b.edge("MADE_BY", "FLD-11", "FLP-01")
    b.edge("BECAUSE_OF", "FLD-11", "FLT-101")
    b.edge("BECAUSE_OF", "FLD-11", "FLEQ-FL-01-RACK1")
    b.node("Campaign", id="FLC-01", name="Breakfast Club", status="active", started_at=shift(ALERT_TS, -2))
    b.edge("OWNS", "FLP-02", "FLC-01")
    b.edge("PROMOTES", "FLC-01", "FLS-02")
    b.edge("TARGETS", "FLC-01", "FL-01")
    b.node("Alert", id="FLA-001", kind="sla_drop", metric="promise_time_min", before=11.0, after=17.5, ts=ALERT_TS)
    b.edge("AT", "FLA-001", "FL-01")
    b.edge("INVOLVES", "FLA-001", "FLS-02")
    arts = [
        ("FLART-01", "Rack 1 bracket at FL-01 snapped, raised FLT-101.", "FLP-01", ["FLT-101"], -6),
        ("FLART-02", "Moving Granola to the back overflow shelf until Rack 1 is fixed.", "FLP-01", ["FLD-11"], -5),
        ("FLART-03", "Breakfast Club is live at FL-01, granola 30% off.", "FLP-02", ["FLC-01"], -2),
        ("FLART-04", "ALERT FL-01: promise time up from 11 to 17.5 min, granola picks are slow.", "FLP-06",
         ["FLA-001"], 0),
    ]
    for aid, text, author, ev, h in arts:
        b.artifact(aid, "slack", text, shift(ALERT_TS, h), author, f"#fl-ops/{aid}", ev)
    truth = {"alert_id": "FLA-001", "root_cause": "FLEQ-FL-01-RACK1", "amplifier": "FLC-01"}
    return b, truth
