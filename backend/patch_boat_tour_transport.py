from __future__ import annotations

import argparse
import os
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient


ROOT_DIR = Path(__file__).resolve().parent
load_dotenv(ROOT_DIR / ".env")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Patch coach transport metadata onto the Technical Boat Tour event."
    )
    parser.add_argument("--date", default="2026-07-30", help="Event date to match.")
    parser.add_argument("--title", default="Technical Boat Tour", help="Event title to match.")
    parser.add_argument("--coach-time", default="08:45", help="Coach departure time.")
    parser.add_argument(
        "--transport-details",
        default=None,
        help="Transport metadata text. Defaults to '<coach-time> – Coach leaves hotel'.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show the matching event without writing changes.",
    )
    return parser.parse_args()


def get_collection():
    mongo_url = os.environ.get("MONGO_URL") or os.environ.get("MONGODB_URI")
    if not mongo_url:
        raise RuntimeError("No Mongo connection string found. Set MONGO_URL or MONGODB_URI.")

    db_name = os.environ.get("DB_NAME") or os.environ.get("MONGO_DB_NAME") or "Telboy_SETP"
    client = MongoClient(mongo_url)
    return client, client[db_name]["schedule"]


def main() -> int:
    args = parse_args()
    transport_details = args.transport_details or f"{args.coach_time} – Coach leaves hotel"
    query = {"date": args.date, "title": args.title}

    client, schedule_col = get_collection()
    try:
        existing = schedule_col.find_one(query, {"_id": 0})
        if not existing:
            print(f"No schedule event found for {query}.")
            return 1

        print("Matched event:")
        print(f"  id: {existing.get('id')}")
        print(f"  date: {existing.get('date')}")
        print(f"  title: {existing.get('title')}")
        print(f"  current coachTime: {existing.get('coachTime')}")
        print(f"  current transportDetails: {existing.get('transportDetails')}")

        if args.dry_run:
            print("Dry run only. No changes written.")
            return 0

        update = {
            "$set": {
                "coachTime": args.coach_time,
                "transportDetails": transport_details,
            }
        }
        result = schedule_col.update_one({"id": existing["id"]}, update)
        if result.matched_count != 1:
            print("Update failed: expected to match exactly one event.")
            return 1

        updated = schedule_col.find_one({"id": existing["id"]}, {"_id": 0, "coachTime": 1, "transportDetails": 1})
        print("Updated event transport metadata:")
        print(f"  coachTime: {updated.get('coachTime')}")
        print(f"  transportDetails: {updated.get('transportDetails')}")
        return 0
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())