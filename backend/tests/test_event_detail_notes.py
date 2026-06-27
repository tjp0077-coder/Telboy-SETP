"""Tests for new per-event detail + notes endpoints (iteration 2)."""
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
def sample_event_id(s):
    items = s.get(f"{API}/schedule").json()
    assert items, "no schedule"
    return items[0]["id"]


# ---------- GET /api/schedule/{id} ----------
class TestGetSingleEvent:
    def test_single_event_no_id_leak(self, s, sample_event_id):
        r = s.get(f"{API}/schedule/{sample_event_id}")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "_id" not in d
        assert d["id"] == sample_event_id
        assert "title" in d and "location" in d and "category" in d

    def test_unknown_event_404(self, s):
        r = s.get(f"{API}/schedule/does-not-exist")
        assert r.status_code == 404


# ---------- Notes (public GET, protected POST/DELETE) ----------
class TestEventNotes:
    def test_get_notes_public_returns_array(self, s, sample_event_id):
        r = s.get(f"{API}/schedule/{sample_event_id}/notes")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_post_note_without_token_401(self, s, sample_event_id):
        r = s.post(f"{API}/schedule/{sample_event_id}/notes", json={"text": "no auth"})
        assert r.status_code == 401

    def test_full_note_lifecycle_create_list_delete(self, s, sample_event_id, H):
        text = "TEST_NOTE — please ignore"
        # create
        r = s.post(f"{API}/schedule/{sample_event_id}/notes", json={"text": text}, headers=H)
        assert r.status_code == 200, r.text
        note = r.json()
        assert "_id" not in note
        assert note["text"] == text
        assert note["event_id"] == sample_event_id
        assert note["author"]  # admin name
        assert note.get("created_at")
        note_id = note["id"]

        # list — should be at top (sorted desc)
        r2 = s.get(f"{API}/schedule/{sample_event_id}/notes")
        assert r2.status_code == 200
        lst = r2.json()
        assert any(n["id"] == note_id for n in lst)
        assert lst[0]["id"] == note_id, "Newly created note should be first (desc sort)"

        # delete unknown returns 404
        r404 = s.delete(f"{API}/schedule/{sample_event_id}/notes/nope-nope", headers=H)
        assert r404.status_code == 404

        # delete real one
        r3 = s.delete(f"{API}/schedule/{sample_event_id}/notes/{note_id}", headers=H)
        assert r3.status_code == 200
        assert r3.json() == {"deleted": True}

        # hidden from active list
        lst2 = s.get(f"{API}/schedule/{sample_event_id}/notes").json()
        assert not any(n["id"] == note_id for n in lst2)

        # appears in deleted feed
        deleted_feed = s.get(f"{API}/feed/deleted", headers=H)
        assert deleted_feed.status_code == 200
        deleted_note = next((n for n in deleted_feed.json() if n["kind"] == "event_note" and n["id"] == note_id), None)
        assert deleted_note is not None
        assert deleted_note["deleted"] is True

        # restore
        r4 = s.post(f"{API}/schedule/{sample_event_id}/notes/{note_id}/restore", headers=H)
        assert r4.status_code == 200
        assert r4.json() == {"ok": True}

        lst3 = s.get(f"{API}/schedule/{sample_event_id}/notes").json()
        assert any(n["id"] == note_id for n in lst3)

        # cleanup for real
        assert s.delete(f"{API}/schedule/{sample_event_id}/notes/{note_id}", headers=H).status_code == 200
        assert s.delete(f"{API}/schedule/{sample_event_id}/notes/{note_id}/permanent", headers=H).status_code == 200


# ---------- PUT/DELETE schedule (admin) + cascade ----------
class TestScheduleAdmin:
    def test_update_event_returns_updated_record(self, s, H):
        # Create a TEST_ session, update it, then clean up
        created = s.post(f"{API}/schedule", headers=H, json={
            "date": "2026-07-31", "day_label": "Fri 31 July",
            "time": "09:00", "title": "TEST_UPDATE_ME",
            "location": "Loc A", "description": "old", "category": "session",
        }).json()
        sid = created["id"]
        try:
            r = s.put(f"{API}/schedule/{sid}", headers=H, json={
                "title": "TEST_UPDATED", "location": "Loc B",
                "description": "new desc", "time": "10:30", "end_time": "11:15",
            })
            assert r.status_code == 200, r.text
            d = r.json()
            assert d["title"] == "TEST_UPDATED"
            assert d["location"] == "Loc B"
            assert d["description"] == "new desc"
            assert d["time"] == "10:30"
            assert d["end_time"] == "11:15"
            # category preserved
            assert d["category"] == "session"
            # GET confirms persistence
            g = s.get(f"{API}/schedule/{sid}").json()
            assert g["title"] == "TEST_UPDATED"
        finally:
            s.delete(f"{API}/schedule/{sid}", headers=H)

    def test_delete_event_cascades_notes(self, s, H):
        # Create event, attach note, delete event, verify note gone via list endpoint 200 + empty
        ev = s.post(f"{API}/schedule", headers=H, json={
            "date": "2026-07-31", "day_label": "Fri 31 July",
            "time": "12:00", "title": "TEST_CASCADE",
            "location": "Loc X", "description": "", "category": "session",
        }).json()
        sid = ev["id"]
        n = s.post(f"{API}/schedule/{sid}/notes", headers=H, json={"text": "TEST_cascade_note"}).json()
        assert n["event_id"] == sid

        # Sanity: note shows up
        pre = s.get(f"{API}/schedule/{sid}/notes").json()
        assert any(x["id"] == n["id"] for x in pre)

        # Delete the event
        d = s.delete(f"{API}/schedule/{sid}", headers=H)
        assert d.status_code == 200
        assert d.json() == {"deleted": True}

        # Event gone
        assert s.get(f"{API}/schedule/{sid}").status_code == 404

        # Notes also cascaded — endpoint returns 200 + [] (since event missing, but route still works)
        post = s.get(f"{API}/schedule/{sid}/notes").json()
        assert post == []

    def test_put_without_token_401(self, s, sample_event_id):
        r = s.put(f"{API}/schedule/{sample_event_id}", json={"title": "X"})
        assert r.status_code == 401
