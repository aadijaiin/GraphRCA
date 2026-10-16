"""Deterministic DashMart seed generator. ALL DATA IS SYNTHETIC (fictional company, invented people).

Usage:
    python seed/generate.py                 # load into graph 'dashmart'
    python seed/generate.py --graph test_x  # load into another graph
    python seed/generate.py --dry-run       # build and validate only
    python seed/generate.py --if-missing    # seed only if the graph does not exist (container start)

Writes the ground truth for the eval set to eval/incidents.json.
"""
import argparse
import json
import random
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIX = Path(__file__).resolve().parent / "fixtures"
sys.path.insert(0, str(ROOT / "backend"))

SEED = 42

LABELS = ["Person", "Store", "SKU", "Equipment", "Supplier", "Campaign", "Ticket",
          "Decision", "Artifact", "Alert", "Investigation", "Finding", "Memory"]

# (id, name, role, team)
PEOPLE = [
    ("PER-001", "Vikram Sethi", "Store Manager", "store-ops"),
    ("PER-002", "Ananya Rao", "Growth PM", "growth"),
    ("PER-003", "Rajesh Nair", "Facilities Lead (Delhi)", "facilities"),
    ("PER-004", "Suresh Pillai", "Facilities Technician", "facilities"),
    ("PER-005", "Kavya Menon", "Picker Lead", "store-ops"),
    ("PER-006", "Arjun Malhotra", "Store Manager", "store-ops"),
    ("PER-007", "Neha Kapoor", "Store Manager", "store-ops"),
    ("PER-008", "Imran Qureshi", "Store Manager", "store-ops"),
    ("PER-009", "Pooja Iyer", "Store Manager", "store-ops"),
    ("PER-010", "Rohan Das", "Store Manager", "store-ops"),
    ("PER-011", "Farah Siddiqui", "Growth Marketing Manager", "growth"),
    ("PER-012", "Deepak Joshi", "Category Manager (Dairy)", "category"),
    ("PER-013", "Sneha Reddy", "Supply Planner", "supply"),
    ("PER-014", "Kabir Bhatia", "Backend Engineer", "engineering"),
    ("PER-015", "Tanvi Shah", "SRE", "engineering"),
    ("PER-016", "Manoj Yadav", "Facilities Technician", "facilities"),
    ("PER-017", "Ritu Agarwal", "Head of Store Ops", "store-ops"),
    ("PER-018", "Aditya Kulkarni", "Supply Planner", "supply"),
    ("PER-019", "Bhavna Chawla", "Category Manager (Snacks)", "category"),
    ("PER-020", "Chetan Rawat", "Picker Lead", "store-ops"),
    ("PER-021", "Divya Nambiar", "Growth Analyst", "growth"),
    ("PER-022", "Gaurav Sinha", "Facilities Lead (Gurugram/Noida)", "facilities"),
    ("PER-023", "Harsh Vora", "Android Engineer", "engineering"),
    ("PER-024", "Isha Ghosh", "Category Manager (Fresh)", "category"),
    ("PER-025", "Jatin Arora", "Picker Lead", "store-ops"),
    ("PER-026", "Lakshmi Krishnan", "Data Analyst", "engineering"),
    ("PER-027", "Nikhil Bansal", "Picker Lead", "store-ops"),
    ("PER-028", "Ojas Mehta", "Supply Planner", "supply"),
    ("PER-029", "Priya Saxena", "Picker Lead", "store-ops"),
    ("PER-030", "Sameer Gill", "Picker Lead", "store-ops"),
]

# (id, name, zone, manager, picker lead, facilities lead, technician)
STORES = [
    ("SD-04", "SD-04 Saket", "South Delhi", "PER-001", "PER-005", "PER-003", "PER-004"),
    ("SD-02", "SD-02 Hauz Khas", "South Delhi", "PER-008", "PER-030", "PER-003", "PER-004"),
    ("ND-01", "ND-01 Karol Bagh", "North Delhi", "PER-007", "PER-025", "PER-003", "PER-004"),
    ("GG-03", "GG-03 Sector 29", "Gurugram", "PER-006", "PER-020", "PER-022", "PER-016"),
    ("NO-05", "NO-05 Sector 18", "Noida", "PER-009", "PER-027", "PER-022", "PER-016"),
    ("ED-06", "ED-06 Mayur Vihar", "East Delhi", "PER-010", "PER-029", "PER-003", "PER-004"),
]

# suffix, kind, name, location
EQUIPMENT = [
    ("CHA1", "chiller", "Front chiller A1", "front, 2 steps from packing"),
    ("FRZB2", "freezer", "Back freezer B2", "back, 14 steps from packing"),
    ("RACK3", "rack", "Rack 3", "middle aisle, 6 steps from packing"),
    ("SCAN1", "scanner", "Handheld scanner 1", "packing station"),
]
MOVE_TARGET = {"chiller": "Back freezer B2", "freezer": "Walk-in cold room (back)", "rack": "Overflow shelf (back)"}

# name, is_hero ; ids assigned in order SKU-001..SKU-060
CATALOG = {
    "dairy": [("Probiotic Buttermilk 500ml", True), ("Toned Milk 1L", True), ("Greek Yogurt 400g", False),
              ("Paneer 200g", True), ("Salted Butter 100g", False), ("Cow Ghee 500ml", False),
              ("Fresh Curd 400g", True), ("Cheese Slices 200g", False), ("Rose Flavoured Milk 200ml", False),
              ("Fresh Cream 250ml", False)],
    "beverages": [("Mango Lassi 200ml", True), ("Tender Coconut Water 1L", True), ("Cola 750ml", False),
                  ("Cold Coffee 250ml", False), ("Lemon Iced Tea 500ml", False), ("Orange Juice 1L", False),
                  ("Sparkling Water 500ml", False), ("Energy Drink 250ml", False), ("Masala Chaas 200ml", False),
                  ("Green Tea 25 bags", False)],
    "snacks": [("Salted Potato Chips 52g", True), ("Masala Chips 52g", False), ("Nachos 150g", False),
               ("Salsa Dip 200g", False), ("Roasted Peanuts 200g", False), ("Trail Mix 150g", False),
               ("Chocolate Cookies 120g", False), ("Bhujia 400g", False), ("Butter Popcorn 90g", False),
               ("Protein Bar 60g", False)],
    "produce": [("Bananas 1 dozen", True), ("Tomatoes 1kg", True), ("Onions 1kg", False), ("Potatoes 1kg", False),
                ("Coriander bunch", False), ("Lemons 250g", False), ("Apples 4pc", False), ("Spinach 250g", False),
                ("Green Chilli 100g", False), ("Cucumber 500g", False)],
    "frozen": [("Vanilla Ice Cream 700ml", True), ("Frozen Peas 500g", False), ("Frozen Paratha 5pc", False),
               ("Chicken Nuggets 400g", False), ("Mango Kulfi 4pc", False), ("French Fries 400g", False),
               ("Veg Momos 10pc", False), ("Chocolate Cone", False), ("Frozen Corn 500g", False),
               ("Fish Fingers 300g", False)],
    "household": [("Dishwash Liquid 500ml", False), ("Detergent 1kg", False), ("Toilet Cleaner 500ml", False),
                  ("Garbage Bags 30pc", False), ("Tissue Roll 4pc", False), ("Hand Wash 200ml", False),
                  ("Floor Cleaner 1L", False), ("Sponge Wipes 3pc", False), ("Aluminium Foil 9m", False),
                  ("Batteries AA 4pc", False)],
}

# id, name, owner, category -> which half of the category (None = all)
SUPPLIERS = [
    ("SUP-01", "Amrit Dairy Co-op", "PER-013", "dairy", None),
    ("SUP-02", "Sip and Co Beverages", "PER-013", "beverages", None),
    ("SUP-03", "Crunchworks Foods", "PER-018", "snacks", None),
    ("SUP-04", "GreenRow Farms", "PER-028", "produce", 0),
    ("SUP-05", "Valley Fresh Produce", "PER-028", "produce", 1),
    ("SUP-06", "Polar Pantry Frozen", "PER-018", "frozen", None),
    ("SUP-07", "CleanNest Supplies", "PER-018", "household", 0),
    ("SUP-08", "HomeBasics Traders", "PER-028", "household", 1),
]

SCENARIO_A_TS = "2026-10-16T08:30:00Z"

# Templated eval incidents: alert id, store, variant, equipment suffix, sku, alert ts, campaign
TEMPLATED = [
    ("ALT-002", "GG-03", "fault_only", "RACK3", "Masala Chips 52g", "2026-10-11T07:00:00Z", None),
    ("ALT-003", "ND-01", "demand_spike", None, "Cold Coffee 250ml", "2026-10-12T09:00:00Z", "CMP-07"),
    ("ALT-004", "NO-05", "fault_amplified", "FRZB2", "Vanilla Ice Cream 700ml", "2026-10-13T10:00:00Z", "CMP-08"),
    ("ALT-005", "ED-06", "fault_only", "CHA1", "Fresh Curd 400g", "2026-10-14T06:00:00Z", None),
    ("ALT-006", "SD-02", "demand_spike", None, "Orange Juice 1L", "2026-10-12T11:00:00Z", "CMP-09"),
    ("ALT-007", "NO-05", "fault_only", "RACK3", "Detergent 1kg", "2026-10-15T05:00:00Z", None),
    ("ALT-008", "GG-03", "fault_amplified", "FRZB2", "Frozen Peas 500g", "2026-10-14T08:00:00Z", "CMP-10"),
    ("ALT-009", "ED-06", "demand_spike", None, "Bananas 1 dozen", "2026-10-15T04:00:00Z", "CMP-11"),
    ("ALT-010", "ND-01", "fault_only", "FRZB2", "Mango Kulfi 4pc", "2026-10-13T07:00:00Z", None),
]
TEMPLATED_CAMPAIGNS = {
    "CMP-07": ("Cold Brew Week", "PER-011"),
    "CMP-08": ("Ice Cream Sundays", "PER-002"),
    "CMP-09": ("Juice Up", "PER-021"),
    "CMP-10": ("Freezer Feast", "PER-011"),
    "CMP-11": ("Fruit First", "PER-021"),
}


def ts(s):
    return datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)


def iso(d):
    return d.strftime("%Y-%m-%dT%H:%M:%SZ")


def shift(s, hours):
    return iso(ts(s) + timedelta(hours=hours))


class Builder:
    def __init__(self):
        self.nodes = {}  # id -> (label, props)
        self.edges = []  # (type, from_id, to_id, props)

    def node(self, label, **props):
        assert props["id"] not in self.nodes, f"duplicate id {props['id']}"
        self.nodes[props["id"]] = (label, props)
        return props["id"]

    def edge(self, rel, src, dst, **props):
        assert src in self.nodes and dst in self.nodes, f"dangling edge {rel} {src}->{dst}"
        self.edges.append((rel, src, dst, props))

    def label(self, nid):
        return self.nodes[nid][0]

    def props(self, nid):
        return self.nodes[nid][1]

    def artifact(self, aid, kind, text, ts_, author, source_ref, evidence_for=()):
        self.node("Artifact", id=aid, kind=kind, text=text, ts=ts_, source_ref=source_ref)
        self.edge("AUTHORED_BY", aid, author)
        for target in evidence_for:
            self.edge("EVIDENCE_FOR", aid, target)


def build():
    rng = random.Random(SEED)
    b = Builder()
    tpl = json.loads((FIX / "templates.json").read_text())

    # ---- people, stores, equipment ----
    for pid, name, role, team in PEOPLE:
        b.node("Person", id=pid, name=name, role=role, team=team)
    store = {s[0]: s for s in STORES}
    for sid, name, zone, mgr, *_ in STORES:
        b.node("Store", id=sid, name=name, zone=zone)
    for sid, _, _, mgr, _, fac_lead, _ in STORES:
        for suffix, kind, name, loc in EQUIPMENT:
            eid = f"EQ-{sid.replace('-', '')}-{suffix}"
            b.node("Equipment", id=eid, kind=kind, name=name, location=loc)
            b.edge("HAS_EQUIPMENT", sid, eid)
            b.edge("OWNS", fac_lead if kind in ("chiller", "freezer") else mgr, eid)

    def eq(sid, suffix):
        return f"EQ-{sid.replace('-', '')}-{suffix}"

    # ---- SKUs and suppliers ----
    sku_by_name, skus_by_cat = {}, defaultdict(list)
    n = 1
    for cat, items in CATALOG.items():
        for name, hero in items:
            sid = f"SKU-{n:03d}"
            n += 1
            b.node("SKU", id=sid, name=name, category=cat, is_hero=hero)
            sku_by_name[name] = sid
            skus_by_cat[cat].append(sid)
    for sup_id, name, owner, cat, half in SUPPLIERS:
        b.node("Supplier", id=sup_id, name=name)
        b.edge("OWNS", owner, sup_id)
        items = skus_by_cat[cat] if half is None else skus_by_cat[cat][half * 5:(half + 1) * 5]
        for s in items:
            b.edge("SUPPLIES", sup_id, s)
    BM = sku_by_name["Probiotic Buttermilk 500ml"]

    # STOCKS: heroes everywhere, plus a random sample; incident SKUs forced in below
    all_skus = [s for c in skus_by_cat.values() for s in c]
    stocks = defaultdict(set)
    for sid, *_ in STORES:
        heroes = {s for s in all_skus if b.props(s)["is_hero"]}
        others = rng.sample([s for s in all_skus if s not in heroes], 33)
        stocks[sid] = heroes | set(others)
    for _, sid, _, _, sku_name, _, _ in TEMPLATED:
        stocks[sid].add(sku_by_name[sku_name])

    # ---- campaigns ----
    def campaign(cid, name, status, started_at, owner, promotes, targets):
        b.node("Campaign", id=cid, name=name, status=status, started_at=started_at)
        b.edge("OWNS", owner, cid)
        for s in promotes:
            b.edge("PROMOTES", cid, s)
        for st in targets:
            b.edge("TARGETS", cid, st)
            stocks[st].update(promotes)

    S = sku_by_name
    campaign("CMP-01", "Summer Coolers", "active", shift(SCENARIO_A_TS, -3), "PER-002",
             [BM, S["Mango Lassi 200ml"], S["Tender Coconut Water 1L"]], ["SD-04", "SD-02"])
    campaign("CMP-02", "Snack Attack", "active", "2026-10-16T01:00:00Z", "PER-011",
             [S["Salted Potato Chips 52g"], S["Salsa Dip 200g"]], ["SD-04", "ND-01"])
    campaign("CMP-03", "Monsoon Dairy Days", "ended", "2026-09-10T04:00:00Z", "PER-002",
             [BM, S["Fresh Curd 400g"]], ["SD-04"])
    campaign("CMP-04", "Gurugram Cool Down", "active", "2026-10-09T12:00:00Z", "PER-011",
             [BM, S["Lemon Iced Tea 500ml"]], ["GG-03"])
    campaign("CMP-05", "Breakfast Bundle", "active", "2026-10-14T02:00:00Z", "PER-021",
             [S["Toned Milk 1L"], S["Fresh Curd 400g"]], ["ND-01", "NO-05"])
    campaign("CMP-06", "Paneer Fest", "active", "2026-10-15T03:00:00Z", "PER-002",
             [S["Paneer 200g"]], ["ED-06", "GG-03"])
    campaign("CMP-12", "Clean Home Sale", "paused", "2026-10-05T04:00:00Z", "PER-021",
             [S["Detergent 1kg"], S["Floor Cleaner 1L"]], ["NO-05", "ED-06"])

    # ---- Scenario A (hero) ----
    sa = store["SD-04"]
    b.node("Ticket", id="FAC-882", key="FAC-882", title="Front chiller A1 not cooling (SD-04)", status="open",
           created_at="2026-10-16T03:00:00Z")
    b.edge("ABOUT", "FAC-882", eq("SD-04", "CHA1"))
    b.node("Decision", id="DEC-209", decided_at="2026-10-16T03:15:00Z",
           summary="Move Probiotic Buttermilk 500ml from front chiller A1 to back freezer B2 until A1 is repaired")
    b.edge("CHANGED", "DEC-209", BM, **{"from": "Front chiller A1", "to": "Back freezer B2"})
    b.edge("AT", "DEC-209", "SD-04")
    b.edge("MADE_BY", "DEC-209", sa[3])
    b.edge("BECAUSE_OF", "DEC-209", "FAC-882")
    b.edge("BECAUSE_OF", "DEC-209", eq("SD-04", "CHA1"))
    b.node("Alert", id="ALT-001", kind="sla_drop", metric="promise_time_min", before=9.5, after=16.0, ts=SCENARIO_A_TS)
    b.edge("AT", "ALT-001", "SD-04")
    b.edge("INVOLVES", "ALT-001", BM)
    # prior chiller history: who knows chiller A1
    b.node("Ticket", id="FAC-845", key="FAC-845", title="Chiller A1 compressor noise (SD-04)", status="done",
           created_at="2026-10-12T06:00:00Z")
    b.edge("ABOUT", "FAC-845", eq("SD-04", "CHA1"))
    b.edge("OWNS", "PER-004", "FAC-845")
    b.edge("WORKED_ON", "PER-004", "FAC-845")
    b.edge("WORKED_ON", "PER-004", eq("SD-04", "CHA1"))
    b.edge("WORKED_ON", "PER-003", eq("SD-04", "CHA1"))

    # ---- distractor objects ----
    b.node("Ticket", id="FAC-870", key="FAC-870", title="Front chiller A1 not cooling (GG-03)", status="done",
           created_at="2026-10-09T04:00:00Z")
    b.edge("ABOUT", "FAC-870", eq("GG-03", "CHA1"))
    b.edge("OWNS", "PER-016", "FAC-870")
    b.edge("WORKED_ON", "PER-016", "FAC-870")
    b.edge("WORKED_ON", "PER-016", eq("GG-03", "CHA1"))
    b.node("Decision", id="DEC-215", decided_at="2026-10-09T13:00:00Z",
           summary="Move Probiotic Buttermilk 500ml back to front chiller A1 and add an end-cap display at GG-03")
    b.edge("CHANGED", "DEC-215", BM, **{"from": "Back freezer B2", "to": "Front chiller A1"})
    b.edge("AT", "DEC-215", "GG-03")
    b.edge("MADE_BY", "DEC-215", "PER-006")
    b.edge("BECAUSE_OF", "DEC-215", "FAC-870")
    b.node("Decision", id="DEC-201", decided_at="2026-10-10T08:00:00Z",
           summary="Move all chips to rack 3 at ND-01 to free aisle space")
    b.edge("CHANGED", "DEC-201", S["Salted Potato Chips 52g"], **{"from": "Rack 1", "to": "Rack 3"})
    b.edge("AT", "DEC-201", "ND-01")
    b.edge("MADE_BY", "DEC-201", "PER-007")

    for fx in ("scenario_a.json", "distractors.json"):
        for a in json.loads((FIX / fx).read_text())["artifacts"]:
            b.artifact(a["id"], a["kind"], a["text"], a["ts"], a["author"], a["source_ref"], a["evidence_for"])

    incidents = [{
        "alert_id": "ALT-001", "scenario": "A", "store": "SD-04", "sku": BM, "variant": "fault_amplified",
        "root_cause": eq("SD-04", "CHA1"), "ticket": "FAC-882", "ticket_unassigned": True, "decision": "DEC-209",
        "amplifier": "CMP-01",
        "owners": {"fix": "PER-003", "campaign": "PER-002", "decision": "PER-001"},
        "required_evidence": ["ART-A02", "ART-A04", "ART-A05"],
        "distractors": ["DEC-215", "FAC-870", "CMP-02", "CMP-03", "CMP-04", "FAC-845"],
    }]

    # ---- templated eval incidents ----
    T = tpl["incident"]
    fac_n, dec_n, art_n = 901, 301, 1
    used_pairs = {("SD-04", BM)}
    incident_equipment = {eq("SD-04", "CHA1")}

    def art_id():
        nonlocal art_n
        aid = f"ART-I{art_n:02d}"
        art_n += 1
        return aid

    for alert_id, sid, variant, eq_suffix, sku_name, alert_ts, cmp_id in TEMPLATED:
        st = store[sid]
        sku = sku_by_name[sku_name]
        used_pairs.add((sid, sku))
        evidence, gt = [], {"alert_id": alert_id, "store": sid, "sku": sku, "variant": variant,
                            "ticket": None, "ticket_unassigned": False, "decision": None, "amplifier": None,
                            "owners": {}}
        if eq_suffix:
            eid = eq(sid, eq_suffix)
            incident_equipment.add(eid)
            e = b.props(eid)
            symptom = rng.choice(tpl["symptoms"][e["kind"]])
            tkt, dec = f"FAC-{fac_n}", f"DEC-{dec_n}"
            fac_n += 1
            dec_n += 1
            to_loc = MOVE_TARGET[e["kind"]]
            fmt = dict(equipment=e["name"], store=sid, symptom=symptom, ticket=tkt, sku=sku_name,
                       from_loc=e["name"], to_loc=to_loc)
            b.node("Ticket", id=tkt, key=tkt, title=f"{e['name']} {symptom} ({sid})", status="open",
                   created_at=shift(alert_ts, -6))
            b.edge("ABOUT", tkt, eid)
            b.edge("WORKED_ON", st[6], eid)  # technician has history with the unit
            b.node("Decision", id=dec, decided_at=shift(alert_ts, -5.5), summary=T["decision"].format(**fmt))
            b.edge("CHANGED", dec, sku, **{"from": e["name"], "to": to_loc})
            b.edge("AT", dec, sid)
            b.edge("MADE_BY", dec, st[3])
            b.edge("BECAUSE_OF", dec, tkt)
            b.edge("BECAUSE_OF", dec, eid)
            a1, a2, a3, a4 = art_id(), art_id(), art_id(), art_id()
            b.artifact(a1, "slack", T["fault_report"].format(**fmt), shift(alert_ts, -6), st[3],
                       f"#store-ops-{sid.lower()}/{a1}", [tkt])
            b.artifact(a2, "ticket_text", T["ticket_text"].format(**fmt), shift(alert_ts, -6), st[3],
                       f"jira/{tkt}", [tkt])
            b.artifact(a3, "slack", T["decision"].format(**fmt), shift(alert_ts, -5.5), st[3],
                       f"#store-ops-{sid.lower()}/{a3}", [dec])
            b.artifact(a4, "slack", T["decision_followup"].format(**fmt), shift(alert_ts, -5.4), st[4],
                       f"#store-ops-{sid.lower()}/{a4}", [dec])
            evidence += [a2, a3]
            gt.update(root_cause=eid, ticket=tkt, ticket_unassigned=True, decision=dec)
            gt["owners"].update(fix=st[5], decision=st[3])
        if cmp_id:
            cname, cowner = TEMPLATED_CAMPAIGNS[cmp_id]
            campaign(cmp_id, cname, "active", shift(alert_ts, -2.5), cowner, [sku], [sid])
            fmt = dict(campaign=cname, stores=sid, skus=sku_name, sku=sku_name, store=sid)
            a5, a6 = art_id(), art_id()
            b.artifact(a5, "slack", T["campaign_launch"].format(**fmt), shift(alert_ts, -2.5), cowner,
                       f"#growth-launches/{a5}", [cmp_id])
            b.artifact(a6, "slack", T["demand_note"].format(**fmt), shift(alert_ts, -0.5), st[4],
                       f"#store-ops-{sid.lower()}/{a6}", [cmp_id])
            evidence.append(a5)
            gt["amplifier"] = cmp_id
            gt["owners"]["campaign"] = cowner
            if variant == "demand_spike":
                gt["root_cause"] = cmp_id
        before = round(rng.uniform(8.0, 11.0), 1)
        after = round(before + rng.uniform(5.0, 9.0), 1)
        b.node("Alert", id=alert_id, kind="sla_drop", metric="promise_time_min", before=before, after=after,
               ts=alert_ts)
        b.edge("AT", alert_id, sid)
        b.edge("INVOLVES", alert_id, sku)
        a7 = art_id()
        b.artifact(a7, "slack", T["alert"].format(store=sid, before=before, after=after, sku=sku_name),
                   alert_ts, "PER-015", f"#ops-alerts/{a7}", [alert_id])
        gt["required_evidence"] = evidence
        incidents.append(gt)

    # ---- background: tickets ----
    managers = {s[0]: s[3] for s in STORES}
    by_team = defaultdict(list)
    for pid, _, _, team in PEOPLE:
        by_team[team].append(pid)
    bg_equipment = [eid for eid, (lab, _) in b.nodes.items() if lab == "Equipment" and eid not in incident_equipment]
    tickets_now = sum(1 for lab, _ in b.nodes.values() if lab == "Ticket")
    counters = {"facilities": 700, "engineering": 400, "ops": 300}
    prefix = {"facilities": "FAC", "engineering": "ENG", "ops": "OPS"}
    art_bg = 1
    for i in range(40 - tickets_now):
        area = ["facilities", "engineering", "ops"][i % 3]
        counters[area] += 1
        tkt = f"{prefix[area]}-{counters[area]}"
        sid = rng.choice(STORES)[0]
        eid = rng.choice([e for e in bg_equipment if e.startswith(f"EQ-{sid.replace('-', '')}")])
        title = rng.choice(tpl["ticket_titles"][area]).format(
            equipment=b.props(eid)["name"], store=sid, category=rng.choice(list(CATALOG)), zone=store[sid][2])
        status = rng.choice(["assigned", "done", "done", "open"])
        b.node("Ticket", id=tkt, key=tkt, title=title, status=status,
               created_at=iso(datetime(2026, 9, 15, tzinfo=timezone.utc) + timedelta(hours=rng.randint(0, 700))))
        if area == "facilities":
            b.edge("ABOUT", tkt, eid)
        team = {"facilities": "facilities", "engineering": "engineering", "ops": "store-ops"}[area]
        if status != "open":
            who = rng.choice(by_team[team])
            b.edge("OWNS", who, tkt)
            b.edge("WORKED_ON", who, tkt)
            if area == "facilities":
                b.edge("WORKED_ON", who, eid)
        aid = f"ART-B{art_bg:03d}"
        art_bg += 1
        b.artifact(aid, "ticket_text", f"{tkt}: {title}. Status: {status}.", b.props(tkt)["created_at"],
                   rng.choice(by_team[team]), f"jira/{tkt}", [tkt])

    # ---- background: decisions (never on an incident's store+SKU pair) ----
    decisions_now = sum(1 for lab, _ in b.nodes.values() if lab == "Decision")
    locations = ["Rack 1", "Rack 2", "Rack 3", "End-cap display", "Front chiller A1", "Impulse shelf"]
    for i in range(25 - decisions_now):
        sid = rng.choice(STORES)[0]
        sku = rng.choice([s for s in sorted(stocks[sid]) if (sid, s) not in used_pairs])
        frm, to = rng.sample(locations, 2)
        did = f"DEC-{100 + i}"
        when = iso(datetime(2026, 9, 1, tzinfo=timezone.utc) + timedelta(hours=rng.randint(0, 900)))
        summary = f"Move {b.props(sku)['name']} from {frm} to {to} at {sid} for better pick flow"
        b.node("Decision", id=did, decided_at=when, summary=summary)
        b.edge("CHANGED", did, sku, **{"from": frm, "to": to})
        b.edge("AT", did, sid)
        b.edge("MADE_BY", did, managers[sid])
        aid = f"ART-B{art_bg:03d}"
        art_bg += 1
        b.artifact(aid, "slack", summary + ".", when, managers[sid], f"#store-ops-{sid.lower()}/{aid}", [did])

    # campaign announcements for campaigns without one
    announced = {t for r, f, t, _ in b.edges if r == "EVIDENCE_FOR" and b.label(t) == "Campaign"}
    for cid, (lab, p) in list(b.nodes.items()):
        if lab == "Campaign" and cid not in announced:
            owner = next(f for r, f, t, _ in b.edges if r == "OWNS" and t == cid)
            aid = f"ART-B{art_bg:03d}"
            art_bg += 1
            b.artifact(aid, "slack", f"{p['name']} campaign is {p['status']}.", p["started_at"], owner,
                       f"#growth-launches/{aid}", [cid])

    # ---- background: WORKED_ON expertise noise (avoids incident equipment) ----
    team_targets = {
        "category": [s for s in all_skus], "store-ops": [s for s in all_skus],
        "facilities": bg_equipment, "supply": all_skus,
    }
    for pid, _, _, team in PEOPLE:
        pool = team_targets.get(team)
        if pool:
            for t in rng.sample(pool, 3):
                b.edge("WORKED_ON", pid, t)

    # ---- background chatter to reach 150 artifacts ----
    sup_of = {t: f for r, f, t, _ in b.edges if r == "SUPPLIES"}
    while sum(1 for lab, _ in b.nodes.values() if lab == "Artifact") < 150:
        sid = rng.choice(STORES)[0]
        sku = rng.choice(sorted(stocks[sid]))
        text = rng.choice(tpl["background"]).format(
            store=sid, sku=b.props(sku)["name"], category=b.props(sku)["category"],
            supplier=b.props(sup_of[sku])["name"])
        when = iso(datetime(2026, 9, 1, tzinfo=timezone.utc) + timedelta(minutes=rng.randint(0, 64000)))
        aid = f"ART-B{art_bg:03d}"
        art_bg += 1
        b.artifact(aid, "slack", text, when, rng.choice(by_team["store-ops"]), f"#store-ops-{sid.lower()}/{aid}")

    for sid, skus in stocks.items():
        for s in sorted(skus):
            b.edge("STOCKS", sid, s)

    # ---- Scenario C ground truth: what breaks if SUP-01 is late ----
    impact = scenario_c_truth(b, "SUP-01")
    return b, incidents, impact


def scenario_c_truth(b, sup_id):
    out = b.edges
    supplied = {t for r, f, t, _ in out if r == "SUPPLIES" and f == sup_id}
    stocked = {(f, t) for r, f, t, _ in out if r == "STOCKS" and t in supplied}
    active = {cid for cid, (lab, p) in b.nodes.items() if lab == "Campaign" and p["status"] == "active"}
    promos = {(f, t) for r, f, t, _ in out if r == "PROMOTES" and f in active and t in supplied}
    owners = {t: f for r, f, t, _ in out if r == "OWNS"}
    return {"supplier": sup_id, "stores": sorted({s for s, _ in stocked}), "skus": sorted(supplied),
            "active_campaigns": sorted({c for c, _ in promos}),
            "campaign_owners": sorted({owners[c] for c, _ in promos})}


def validate(b, incidents):
    """Check the planted chains are the only answer the graph supports."""
    E = defaultdict(list)
    for r, f, t, p in b.edges:
        E[r].append((f, t, p))
    at = {f: t for f, t, _ in E["AT"]}
    for inc in incidents:
        a = b.props(inc["alert_id"])
        sid, sku = inc["store"], inc["sku"]
        decs = sorted((b.props(d)["decided_at"], d) for d, s, _ in E["CHANGED"]
                      if s == sku and at.get(d) == sid and b.props(d)["decided_at"] <= a["ts"])
        got_dec = decs[-1][1] if decs else None
        assert got_dec == inc["decision"], f"{inc['alert_id']}: decision {got_dec} != {inc['decision']}"
        promoting = {c for c, s, _ in E["PROMOTES"] if s == sku}
        targeting = {c for c, s, _ in E["TARGETS"] if s == sid}
        amps = {c for c in promoting & targeting
                if b.props(c)["status"] == "active" and b.props(c)["started_at"] <= a["ts"]}
        want = {inc["amplifier"]} if inc["amplifier"] else set()
        assert amps == want, f"{inc['alert_id']}: amplifiers {amps} != {want}"
    rels = defaultdict(int)
    for r, *_ in b.edges:
        rels[r] += 1
    return rels


def load(graph_name, b):
    from db import get_client
    db = get_client()
    if graph_name in db.list_graphs():
        db.select_graph(graph_name).delete()
    g = db.select_graph(graph_name)
    schema = (ROOT / "queries" / "00_schema.cypher").read_text()
    schema = "\n".join(l for l in schema.splitlines() if not l.strip().startswith("//"))
    for stmt in map(str.strip, schema.split(";")):
        if stmt:
            g.query(stmt)
    for label in LABELS:  # unique constraints are a FalkorDB command, not Cypher
        g.create_node_unique_constraint(label, "id")

    by_label = defaultdict(list)
    for label, props in b.nodes.values():
        by_label[label].append(props)
    for label, rows in by_label.items():
        for i in range(0, len(rows), 500):
            g.query(f"UNWIND $rows AS r CREATE (n:{label}) SET n = r", {"rows": rows[i:i + 500]})
    by_rel = defaultdict(list)
    for rel, f, t, p in b.edges:
        by_rel[(rel, b.label(f), b.label(t))].append({"f": f, "t": t, "p": p})
    for (rel, lf, lt), rows in by_rel.items():
        for i in range(0, len(rows), 500):
            g.query(f"UNWIND $rows AS r MATCH (a:{lf} {{id: r.f}}), (b:{lt} {{id: r.t}}) "
                    f"CREATE (a)-[e:{rel}]->(b) SET e += r.p", {"rows": rows[i:i + 500]})
    n = g.query("MATCH (n) RETURN count(n)").result_set[0][0]
    m = g.query("MATCH ()-[e]->() RETURN count(e)").result_set[0][0]
    return n, m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--graph", default="dashmart")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--if-missing", action="store_true", help="skip loading if the graph already exists")
    args = ap.parse_args()
    if args.if_missing:
        from db import get_client
        if args.graph in get_client().list_graphs():
            print(f"graph '{args.graph}' exists, skipping seed")
            return
    b, incidents, impact = build()
    rels = validate(b, incidents)
    counts = defaultdict(int)
    for label, _ in b.nodes.values():
        counts[label] += 1
    print("nodes:", dict(counts), "total", len(b.nodes))
    print("edges:", dict(rels), "total", len(b.edges))
    out = {"_note": "SYNTHETIC ground truth, generated by seed/generate.py. Do not edit by hand.",
           "incidents": incidents, "impact_scenarios": [impact]}
    (ROOT / "eval" / "incidents.json").write_text(json.dumps(out, indent=2) + "\n")
    print(f"wrote eval/incidents.json ({len(incidents)} incidents)")
    if not args.dry_run:
        n, m = load(args.graph, b)
        print(f"loaded graph '{args.graph}': {n} nodes, {m} edges")


if __name__ == "__main__":
    main()
