"""Tests for iteration 3: merged /api/feed + /api/contact (public POST, admin GET/PATCH/DELETE)."""
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
    assert items
    return items[0]["id"]


# ---------- /api/feed ----------
class TestFeed:
    def test_feed_returns_array_and_no_id_leak(self, s):
        r = s.get(f"{API}/feed")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        for it in items:
            assert "_id" not in it
            assert it["kind"] in {"announcement", "event_note"}
            assert it.get("id") and it.get("text") and it.get("author") and it.get("created_at")

    def test_feed_sorted_desc_by_created_at(self, s):
        items = s.get(f"{API}/feed").json()
        ts = [i["created_at"] for i in items]
        assert ts == sorted(ts, reverse=True)

    def test_feed_includes_event_note_with_event_title(self, s, sample_event_id, H):
        # Create an event note and verify it appears in /feed with event_title resolved
        note = s.post(
            f"{API}/schedule/{sample_event_id}/notes",
            json={"text": "TEST_FEED_NOTE"}, headers=H,
        ).json()
        try:
            ev_title = s.get(f"{API}/schedule/{sample_event_id}").json()["title"]
            items = s.get(f"{API}/feed").json()
            match = next((i for i in items if i["id"] == note["id"] and i["kind"] == "event_note"), None)
            assert match is not None, "newly created note not in feed"
            assert match["event_id"] == sample_event_id
            assert match["event_title"] == ev_title
            # Announcement kind also represented
            assert any(i["kind"] == "announcement" for i in items)
        finally:
            s.delete(f"{API}/schedule/{sample_event_id}/notes/{note['id']}", headers=H)


# ---------- /api/contact ----------
class TestContactPublicCreate:
    def test_create_contact_ok(self, s):
        payload = {
            "name": "TEST_Sender",
            "email": "test@example.com",
            "subject": "TEST_subject",
            "message": "Hello team, this is a TEST_ contact ping.",
        }
        r = s.post(f"{API}/contact", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        assert d.get("id")

    def test_create_contact_follow_up_appends_to_existing_thread(self, s, H):
        seed = s.post(f"{API}/contact", json={
            "name": "TEST_ThreadSeed",
            "email": "thread@example.com",
            "subject": "TEST_Thread_subject",
            "message": "first thread message",
        }).json()
        cid = seed["id"]

        try:
            follow = s.post(f"{API}/contact", json={
                "name": "TEST_ThreadSeed",
                "email": "thread@example.com",
                "subject": "TEST_Thread_subject",
                "message": "follow up from delegate",
                "thread_id": cid,
            })
            assert follow.status_code == 200, follow.text
            assert follow.json()["id"] == cid

            items = s.get(f"{API}/contact", headers=H).json()
            found = next((i for i in items if i["id"] == cid), None)
            assert found is not None
            assert len(found["messages"]) >= 2
            assert found["messages"][-1]["sender_role"] == "delegate"
            assert found["messages"][-1]["message"] == "follow up from delegate"
        finally:
            s.delete(f"{API}/contact/{cid}", headers=H)
            s.delete(f"{API}/contact/{cid}/permanent", headers=H)

    def test_create_contact_missing_message_400(self, s):
        r = s.post(f"{API}/contact", json={"name": "A", "subject": "B", "message": "   "})
        assert r.status_code == 400

    def test_create_contact_missing_name_400(self, s):
        r = s.post(f"{API}/contact", json={"name": "", "subject": "B", "message": "C"})
        assert r.status_code == 400

    def test_create_contact_missing_subject_400(self, s):
        r = s.post(f"{API}/contact", json={"name": "A", "subject": "", "message": "C"})
        assert r.status_code == 400


class TestContactAdminInbox:
    def test_list_contact_requires_auth(self, s):
        r = s.get(f"{API}/contact")
        assert r.status_code == 401

    def test_reply_contact_requires_auth_and_succeeds(self, s, H):
        seed = s.post(f"{API}/contact", json={
            "name": "TEST_ReplySender",
            "email": "reply@example.com",
            "subject": "TEST_Reply",
            "message": "reply test body",
        }).json()
        cid = seed["id"]

        try:
            r401 = s.post(f"{API}/contact/{cid}/reply", json={"message": "Thanks for your message."})
            assert r401.status_code == 401

            r404 = s.post(f"{API}/contact/does-not-exist/reply", json={"message": "x"}, headers=H)
            assert r404.status_code == 404

            r400 = s.post(f"{API}/contact/{cid}/reply", json={"message": "   "}, headers=H)
            assert r400.status_code == 400

            rok = s.post(f"{API}/contact/{cid}/reply", json={"message": "Thanks for your message."}, headers=H)
            assert rok.status_code == 200, rok.text
            reply = rok.json()
            assert reply["ok"] is True
            assert reply["message"]["sender_role"] == "admin"
            items = s.get(f"{API}/contact", headers=H).json()
            found = next((i for i in items if i["id"] == cid), None)
            assert found is not None
            assert found["messages"][-1]["sender_role"] == "admin"
            assert found["messages"][-1]["message"] == "Thanks for your message."
        finally:
            s.delete(f"{API}/contact/{cid}", headers=H)
            s.delete(f"{API}/contact/{cid}/permanent", headers=H)

    def test_full_inbox_lifecycle(self, s, H):
        # Seed a fresh contact message
        seed = s.post(f"{API}/contact", json={
            "name": "TEST_LifecycleSender",
            "email": "lc@example.com",
            "subject": "TEST_Lifecycle",
            "message": "lifecycle test body",
        }).json()
        cid = seed["id"]

        # GET as admin, newest first, find our id
        lst = s.get(f"{API}/contact", headers=H)
        assert lst.status_code == 200
        items = lst.json()
        assert isinstance(items, list) and len(items) > 0
        # sorted desc by created_at
        ts = [i["created_at"] for i in items]
        assert ts == sorted(ts, reverse=True)
        found = next((i for i in items if i["id"] == cid), None)
        assert found is not None
        assert found["read"] is False
        assert found["subject"] == "TEST_Lifecycle"
        assert found["messages"][0]["sender_role"] == "delegate"
        assert "_id" not in found

        # PATCH read on unknown -> 404
        r404 = s.patch(f"{API}/contact/does-not-exist/read", headers=H)
        assert r404.status_code == 404

        # PATCH read without token -> 401
        r401 = s.patch(f"{API}/contact/{cid}/read")
        assert r401.status_code == 401

        # PATCH read OK
        r2 = s.patch(f"{API}/contact/{cid}/read", headers=H)
        assert r2.status_code == 200

        # Verify via subsequent GET
        items2 = s.get(f"{API}/contact", headers=H).json()
        found2 = next((i for i in items2 if i["id"] == cid), None)
        assert found2 is not None
        assert found2["read"] is True

        # DELETE without token -> 401
        rdel401 = s.delete(f"{API}/contact/{cid}")
        assert rdel401.status_code == 401

        # DELETE unknown -> 404
        rdel404 = s.delete(f"{API}/contact/does-not-exist", headers=H)
        assert rdel404.status_code == 404

        # DELETE OK
        rdel = s.delete(f"{API}/contact/{cid}", headers=H)
        assert rdel.status_code == 200
        assert rdel.json() == {"deleted": True}

        # Verify hidden from primary inbox
        items3 = s.get(f"{API}/contact", headers=H).json()
        assert not any(i["id"] == cid for i in items3)

        # Deleted list requires auth
        rdeleted401 = s.get(f"{API}/contact/deleted")
        assert rdeleted401.status_code == 401

        # Verify visible in deleted inbox
        deleted_items = s.get(f"{API}/contact/deleted", headers=H)
        assert deleted_items.status_code == 200
        deleted_found = next((i for i in deleted_items.json() if i["id"] == cid), None)
        assert deleted_found is not None
        assert deleted_found["deleted"] is True
        assert deleted_found["deleted_at"]
        assert deleted_found["deleted_by"]

        # Restore without auth -> 401
        rrestore401 = s.post(f"{API}/contact/{cid}/restore")
        assert rrestore401.status_code == 401

        # Restore OK
        rrestore = s.post(f"{API}/contact/{cid}/restore", headers=H)
        assert rrestore.status_code == 200
        assert rrestore.json() == {"ok": True}

        items4 = s.get(f"{API}/contact", headers=H).json()
        restored = next((i for i in items4 if i["id"] == cid), None)
        assert restored is not None
        assert restored["deleted"] is False

        deleted_items_after_restore = s.get(f"{API}/contact/deleted", headers=H).json()
        assert not any(i["id"] == cid for i in deleted_items_after_restore)

        # Archive again and permanently delete
        rdel2 = s.delete(f"{API}/contact/{cid}", headers=H)
        assert rdel2.status_code == 200

        rperm401 = s.delete(f"{API}/contact/{cid}/permanent")
        assert rperm401.status_code == 401

        rperm404 = s.delete(f"{API}/contact/does-not-exist/permanent", headers=H)
        assert rperm404.status_code == 404

        rperm = s.delete(f"{API}/contact/{cid}/permanent", headers=H)
        assert rperm.status_code == 200
        assert rperm.json() == {"deleted": True}

        deleted_items_final = s.get(f"{API}/contact/deleted", headers=H).json()
        assert not any(i["id"] == cid for i in deleted_items_final)
