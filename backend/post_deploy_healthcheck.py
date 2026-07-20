#!/usr/bin/env python3
"""Post-deploy smoke check for critical public API endpoints.

Usage:
  python backend/post_deploy_healthcheck.py
  EXPO_PUBLIC_BACKEND_URL=https://telboy-setp.onrender.com python backend/post_deploy_healthcheck.py
"""

from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass
from typing import Any, Callable

import requests


DEFAULT_BASE_URL = "https://telboy-setp.onrender.com"
TIMEOUT_SECONDS = 20


@dataclass
class Check:
    name: str
    path: str
    validate: Callable[[Any], bool]


def _is_list(value: Any) -> bool:
    return isinstance(value, list)


def _is_city_guide_shape(value: Any) -> bool:
    if not isinstance(value, dict):
        return False
    required = ("essentials", "transport", "phrases", "venues")
    return all(key in value and isinstance(value[key], list) for key in required)


def run_check(base_url: str, check: Check) -> tuple[bool, str]:
    url = f"{base_url}/api{check.path}"
    try:
        response = requests.get(url, timeout=TIMEOUT_SECONDS)
    except requests.RequestException as exc:
        return False, f"network error: {exc}"

    if response.status_code != 200:
        snippet = response.text[:240].strip().replace("\n", " ")
        return False, f"HTTP {response.status_code} :: {snippet}"

    try:
        payload = response.json()
    except json.JSONDecodeError:
        snippet = response.text[:240].strip().replace("\n", " ")
        return False, f"invalid JSON :: {snippet}"

    if not check.validate(payload):
        return False, "JSON shape did not match expected schema"

    return True, "ok"


def main() -> int:
    base_url = os.environ.get("EXPO_PUBLIC_BACKEND_URL", DEFAULT_BASE_URL).rstrip("/")
    checks = [
        Check(name="Schedule", path="/schedule", validate=_is_list),
        Check(name="Feed", path="/feed", validate=_is_list),
        Check(name="City Guide", path="/city-guide", validate=_is_city_guide_shape),
    ]

    print(f"Running post-deploy healthcheck against: {base_url}")

    failures = 0
    for check in checks:
        ok, detail = run_check(base_url, check)
        prefix = "PASS" if ok else "FAIL"
        print(f"[{prefix}] {check.name}: {detail}")
        if not ok:
            failures += 1

    if failures:
        print(f"\nHealthcheck failed: {failures} endpoint(s) unhealthy.")
        return 1

    print("\nHealthcheck passed: all critical endpoints are healthy.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
