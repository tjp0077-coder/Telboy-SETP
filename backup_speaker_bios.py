#!/usr/bin/env python3
"""Create a timestamped local backup of speaker bio data via the API.

Backs up:
- /api/speakers
- /api/schedule (contains per-session speakerBios)

Usage:
  python backup_speaker_bios.py
  python backup_speaker_bios.py --base-url https://your-backend.example.com --output-dir backups
    python backup_speaker_bios.py --base-url https://your-backend.example.com --save-base-url
    python backup_speaker_bios.py --clear-saved-url
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

CONFIG_FILE = Path(".speaker_bios_backup_config.json")


def load_saved_base_url() -> str | None:
    if not CONFIG_FILE.exists():
        return None
    try:
        data = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
    except Exception:
        return None
    value = data.get("base_url") if isinstance(data, dict) else None
    return value if isinstance(value, str) and value.strip() else None


def save_base_url(base_url: str) -> None:
    payload = {"base_url": base_url}
    CONFIG_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def clear_saved_base_url() -> bool:
    if not CONFIG_FILE.exists():
        return False
    CONFIG_FILE.unlink()
    return True


def normalize_base_url(raw: str) -> str:
    base = (raw or "").strip().rstrip("/")
    if not base:
        return "http://127.0.0.1:8000"
    if base.endswith("/api"):
        return base[:-4]
    return base


def fetch_json(url: str, timeout: int) -> list[dict]:
    try:
        with urlopen(url, timeout=timeout) as response:
            body = response.read().decode("utf-8")
            data = json.loads(body)
            if not isinstance(data, list):
                raise RuntimeError(f"Expected a JSON list from {url}, got {type(data).__name__}")
            return data
    except HTTPError as exc:
        raise RuntimeError(f"HTTP error {exc.code} for {url}") from exc
    except URLError as exc:
        raise RuntimeError(f"Could not reach {url}: {exc.reason}") from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid JSON returned by {url}") from exc


def main() -> int:
    saved_base_url = load_saved_base_url()
    parser = argparse.ArgumentParser(description="Backup speaker bios to a local JSON file")
    parser.add_argument(
        "--base-url",
        default=os.environ.get("EXPO_PUBLIC_BACKEND_URL")
        or saved_base_url
        or os.environ.get("BACKEND_URL")
        or "http://127.0.0.1:8000",
        help="Backend base URL (with or without /api). Default order: EXPO_PUBLIC_BACKEND_URL, saved URL, BACKEND_URL, then http://127.0.0.1:8000",
    )
    parser.add_argument(
        "--save-base-url",
        action="store_true",
        help="Save the --base-url value to .speaker_bios_backup_config.json for future runs.",
    )
    parser.add_argument(
        "--clear-saved-url",
        action="store_true",
        help="Delete the saved URL config file and exit.",
    )
    parser.add_argument(
        "--output-dir",
        default="backups",
        help="Folder where backup files are written (created automatically if missing).",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=20,
        help="HTTP timeout in seconds (default: 20)",
    )
    args = parser.parse_args()

    if args.clear_saved_url:
        removed = clear_saved_base_url()
        print("Saved URL cleared." if removed else "No saved URL config found.")
        return 0

    base_url = normalize_base_url(args.base_url)
    if args.save_base_url:
        save_base_url(base_url)
        print(f"Saved default backend URL: {base_url}")

    api_base = f"{base_url}/api"

    speakers_url = f"{api_base}/speakers"
    schedule_url = f"{api_base}/schedule"

    speakers = fetch_json(speakers_url, args.timeout)
    schedule = fetch_json(schedule_url, args.timeout)

    sessions_with_bios = []
    for session in schedule:
        speaker_bios = session.get("speakerBios") or []
        sessions_with_bios.append(
            {
                "session_id": session.get("id"),
                "session_title": session.get("title"),
                "day_label": session.get("day_label"),
                "speaker_bios_count": len(speaker_bios),
                "speakerBios": speaker_bios,
            }
        )

    now = datetime.now(timezone.utc)
    stamp = now.strftime("%Y%m%d_%H%M%S")

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    output_file = output_dir / f"speaker_bios_backup_{stamp}.json"

    payload = {
        "generated_at_utc": now.isoformat(),
        "base_url": base_url,
        "endpoints": {
            "speakers": speakers_url,
            "schedule": schedule_url,
        },
        "counts": {
            "speakers": len(speakers),
            "sessions": len(schedule),
            "sessions_with_speaker_bios": sum(1 for s in sessions_with_bios if s["speaker_bios_count"] > 0),
        },
        "speakers": speakers,
        "schedule": schedule,
        "sessionSpeakerBios": sessions_with_bios,
    }

    output_file.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    print(f"Backup saved: {output_file}")
    print(
        "Summary: "
        f"{payload['counts']['speakers']} speakers, "
        f"{payload['counts']['sessions']} sessions, "
        f"{payload['counts']['sessions_with_speaker_bios']} sessions with speaker bios"
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
