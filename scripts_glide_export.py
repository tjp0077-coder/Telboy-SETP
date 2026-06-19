#!/usr/bin/env python3
"""Export EDI SETP 2026 backend data to Glide-ready CSV files."""
import csv, json, os, urllib.request

BASE = "http://localhost:8001/api"
OUT = "/app/glide_export"
os.makedirs(OUT, exist_ok=True)


def get(path):
    with urllib.request.urlopen(BASE + path, timeout=15) as r:
        return json.loads(r.read().decode())


def write_csv(name, rows, fields):
    path = os.path.join(OUT, name)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for row in rows:
            w.writerow(row)
    print(f"  wrote {name} ({len(rows)} rows)")


# 1. Schedule
sched = get("/schedule")
write_csv("schedule.csv", sched,
          ["id", "date", "day_label", "time", "end_time", "title",
           "location", "description", "category"])

# 2. Live messages / feed
feed = get("/feed")
write_csv("messages.csv", feed,
          ["id", "kind", "title", "text", "priority", "author",
           "created_at", "event_id", "event_title"])

# 3. City guide (nested -> several tables)
cg = get("/city-guide")

# hero (single row)
hero = cg.get("hero", {})
write_csv("city_hero.csv", [hero], ["title", "subtitle"])

# essentials
write_csv("city_essentials.csv", cg.get("essentials", []),
          ["icon", "title", "summary"])

# transport
write_csv("city_transport.csv", cg.get("transport", []),
          ["name", "icon", "description", "tip", "url"])

# phrasebook (keys vary — detect)
phrases = cg.get("phrasebook", []) or cg.get("phrases", [])
if phrases:
    keys = sorted({k for p in phrases for k in p.keys()})
    write_csv("city_phrasebook.csv", phrases, keys)

# venues
venues = cg.get("venues", [])
if venues:
    keys = sorted({k for v in venues for k in v.keys()})
    write_csv("city_venues.csv", venues, keys)

# Dump any other top-level lists we didn't explicitly map
known = {"hero", "essentials", "transport", "phrasebook", "phrases", "venues"}
for k, v in cg.items():
    if k in known:
        continue
    if isinstance(v, list) and v and isinstance(v[0], dict):
        keys = sorted({kk for it in v for kk in it.keys()})
        write_csv(f"city_{k}.csv", v, keys)

print("DONE ->", OUT)
