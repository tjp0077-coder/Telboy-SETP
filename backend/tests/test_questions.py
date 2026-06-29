"""Ask the Speaker feature API tests."""
import os
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def token(s):
    r = s.post(f"{API}/auth/login", json={"username": "dave.mackay", "password": "Chairman2026!"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def H(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def schedule(s):
    items = s.get(f"{API}/schedule").json()
    assert len(items) > 0
    return items


def _find(items, qid):
    return next((i for i in items if i["id"] == qid), None)


class TestQuestions:
    def test_post_with_valid_event_id_persists_and_resolves_title(self, s, H, schedule):
        ev = schedule[0]
        payload = {
            "name": "TEST_AskValid",
            "email": "v@example.com",
            "question": "with valid event",
            "event_id": ev["id"],
        }
        r = s.post(f"{API}/questions", json=payload)
        assert r.status_code == 200, r.text
        qid = r.json()["id"]
        try:
            items = s.get(f"{API}/questions", headers=H).json()
            found = _find(items, qid)
            assert found is not None
            assert found["event_id"] == ev["id"]
            assert found["event_title"] == ev["title"]
            assert found["reviewed"] is False
        finally:
            s.delete(f"{API}/questions/{qid}", headers=H)
            s.delete(f"{API}/questions/{qid}/permanent", headers=H)

    def test_post_with_invalid_event_id_silently_drops(self, s, H):
        r = s.post(f"{API}/questions", json={
            "name": "TEST_AskInvalid",
            "question": "bogus event id",
            "event_id": "definitely-not-a-real-event-uuid-xyz",
        })
        assert r.status_code == 200, r.text
        qid = r.json()["id"]
        try:
            items = s.get(f"{API}/questions", headers=H).json()
            found = _find(items, qid)
            assert found is not None
            assert found["event_id"] is None
            assert found["event_title"] is None
        finally:
            s.delete(f"{API}/questions/{qid}", headers=H)
            s.delete(f"{API}/questions/{qid}/permanent", headers=H)

    def test_review_archive_restore_and_delete_flow(self, s, H):
        r = s.post(f"{API}/questions", json={
            "name": "TEST_AskFlow",
            "email": "flow@example.com",
            "question": "review lifecycle",
        })
        assert r.status_code == 200, r.text
        qid = r.json()["id"]

        try:
            assert s.patch(f"{API}/questions/{qid}/review", headers=H).status_code == 200

            active = s.get(f"{API}/questions", headers=H).json()
            assert _find(active, qid)["reviewed"] is True

            assert s.delete(f"{API}/questions/{qid}", headers=H).status_code == 200
            active_after_archive = s.get(f"{API}/questions", headers=H).json()
            assert _find(active_after_archive, qid) is None

            deleted = s.get(f"{API}/questions/deleted", headers=H).json()
            assert _find(deleted, qid) is not None

            assert s.post(f"{API}/questions/{qid}/restore", headers=H).status_code == 200
            active_after_restore = s.get(f"{API}/questions", headers=H).json()
            assert _find(active_after_restore, qid) is not None

            assert s.delete(f"{API}/questions/{qid}", headers=H).status_code == 200
            assert s.delete(f"{API}/questions/{qid}/permanent", headers=H).status_code == 200
        finally:
            s.delete(f"{API}/questions/{qid}/permanent", headers=H)
