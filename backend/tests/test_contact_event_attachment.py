"""Iteration 4: /api/contact event_id optional attachment + admin GET resolution."""
import os
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

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


def _find(items, cid):
    return next((i for i in items if i["id"] == cid), None)


class TestContactEventAttachment:
    def test_post_with_valid_event_id_persists_and_resolves_title(self, s, H, schedule):
        ev = schedule[0]
        payload = {
            "name": "TEST_AttachValid",
            "email": "v@example.com",
            "subject": "TEST_AttachValid_subject",
            "message": "with valid event",
            "event_id": ev["id"],
        }
        r = s.post(f"{API}/contact", json=payload)
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        try:
            items = s.get(f"{API}/contact", headers=H).json()
            found = _find(items, cid)
            assert found is not None
            assert found["event_id"] == ev["id"]
            assert found["event_title"] == ev["title"]
        finally:
            s.delete(f"{API}/contact/{cid}", headers=H)

    def test_post_with_null_event_id(self, s, H):
        r = s.post(f"{API}/contact", json={
            "name": "TEST_AttachNull",
            "email": "",
            "subject": "TEST_AttachNull_subject",
            "message": "no event",
            "event_id": None,
        })
        assert r.status_code == 200
        cid = r.json()["id"]
        try:
            items = s.get(f"{API}/contact", headers=H).json()
            found = _find(items, cid)
            assert found is not None
            assert found["event_id"] is None
            assert found["event_title"] is None
        finally:
            s.delete(f"{API}/contact/{cid}", headers=H)

    def test_post_with_empty_string_event_id(self, s, H):
        r = s.post(f"{API}/contact", json={
            "name": "TEST_AttachEmpty",
            "subject": "TEST_AttachEmpty_subject",
            "message": "empty event id",
            "event_id": "   ",
        })
        assert r.status_code == 200
        cid = r.json()["id"]
        try:
            items = s.get(f"{API}/contact", headers=H).json()
            found = _find(items, cid)
            assert found is not None
            assert found["event_id"] is None
            assert found["event_title"] is None
        finally:
            s.delete(f"{API}/contact/{cid}", headers=H)

    def test_post_with_invalid_event_id_silently_drops(self, s, H):
        r = s.post(f"{API}/contact", json={
            "name": "TEST_AttachInvalid",
            "subject": "TEST_AttachInvalid_subject",
            "message": "bogus event id",
            "event_id": "definitely-not-a-real-event-uuid-xyz",
        })
        # Graceful degradation - should still be 200, not 4xx
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        try:
            items = s.get(f"{API}/contact", headers=H).json()
            found = _find(items, cid)
            assert found is not None
            assert found["event_id"] is None
            assert found["event_title"] is None
        finally:
            s.delete(f"{API}/contact/{cid}", headers=H)

    def test_post_without_event_id_field(self, s, H):
        # Backward compat: omitting event_id entirely should still work
        r = s.post(f"{API}/contact", json={
            "name": "TEST_NoField",
            "subject": "TEST_NoField_subject",
            "message": "no event_id key at all",
        })
        assert r.status_code == 200
        cid = r.json()["id"]
        try:
            items = s.get(f"{API}/contact", headers=H).json()
            found = _find(items, cid)
            assert found is not None
            assert found["event_id"] is None
            assert found["event_title"] is None
        finally:
            s.delete(f"{API}/contact/{cid}", headers=H)
