"""SETP Edinburgh 2026 backend API tests."""
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
    data = r.json()
    return data["access_token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Public endpoints ----------
class TestPublic:
    def test_schedule_returns_35_plus_items(self, s):
        r = s.get(f"{API}/schedule")
        assert r.status_code == 200
        items = r.json()
        # Spec says 35+, seed has 35 items — accept >=35; warn if <35
        assert isinstance(items, list)
        assert len(items) >= 35, f"Expected 35+ items, got {len(items)}"
        # No _id leakage
        for it in items:
            assert "_id" not in it
            assert {"id", "date", "day_label", "time", "title", "location", "category"} <= set(it.keys())

    def test_schedule_sorted(self, s):
        r = s.get(f"{API}/schedule")
        items = r.json()
        sorted_keys = sorted([(i["date"], i["time"]) for i in items])
        actual = [(i["date"], i["time"]) for i in items]
        assert actual == sorted_keys

    def test_psgs_events_on_27th_and_28th_use_updated_maps_url(self, s):
        r = s.get(f"{API}/schedule")
        assert r.status_code == 200
        items = r.json()
        psgs_events = [
            item for item in items
            if item["date"] in {"2026-07-27", "2026-07-28"}
            and "ps&gs" in (item.get("location") or "").lower()
        ]
        assert psgs_events, "Expected Ps&Gs events on 27th and 28th"
        assert all(
            item.get("maps_url") == "https://maps.app.goo.gl/5fqn1CRK6T7GwFts7"
            for item in psgs_events
        )

    def test_messages_seeded_welcome(self, s):
        r = s.get(f"{API}/messages")
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        assert any("Welcome" in (m.get("title") or "") or "Welcome" in m["text"] for m in items)
        for m in items:
            assert "_id" not in m

    def test_city_guide(self, s):
        r = s.get(f"{API}/city-guide")
        assert r.status_code == 200
        d = r.json()
        assert "essentials" in d and len(d["essentials"]) >= 3
        assert "transport" in d and len(d["transport"]) >= 3
        assert "phrases" in d and len(d["phrases"]) >= 3
        assert "venues" in d and len(d["venues"]) >= 3


# ---------- Auth ----------
class TestAuth:
    def test_login_ok(self, s):
        r = s.post(f"{API}/auth/login", json={"username": "dave.mackay", "password": "Chairman2026!"})
        assert r.status_code == 200
        d = r.json()
        assert "access_token" in d
        assert d["username"] == "dave.mackay"
        assert d.get("name")

    def test_login_wrong_password(self, s):
        r = s.post(f"{API}/auth/login", json={"username": "dave.mackay", "password": "WRONG"})
        assert r.status_code == 401

    def test_login_unknown_user(self, s):
        r = s.post(f"{API}/auth/login", json={"username": "nobody", "password": "x"})
        assert r.status_code == 401

    def test_me_with_token(self, s, auth_headers):
        r = s.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["username"] == "dave.mackay"
        assert d.get("role") == "admin"

    def test_me_without_token(self, s):
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_all_three_admins_login(self, s):
        for u, p in [("dave.mackay", "Chairman2026!"),
                     ("kelly.latimer", "President2026!"),
                     ("setp.admin", "SETPAdmin2026!")]:
            r = s.post(f"{API}/auth/login", json={"username": u, "password": p})
            assert r.status_code == 200, f"login failed for {u}"


# ---------- Messages CRUD ----------
class TestMessages:
    def test_post_message_requires_auth(self, s):
        r = s.post(f"{API}/messages", json={"text": "no auth", "title": "x", "priority": "info"})
        assert r.status_code == 401

    def test_create_and_list_message_top(self, s, auth_headers):
        payload = {"text": "TEST_msg body", "title": "TEST_msg", "priority": "urgent"}
        r = s.post(f"{API}/messages", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["text"] == payload["text"]
        assert created["priority"] == "urgent"
        assert created["author"]
        mid = created["id"]

        # Should be at top of list (most recent first)
        r2 = s.get(f"{API}/messages")
        assert r2.status_code == 200
        items = r2.json()
        assert items[0]["id"] == mid

        # cleanup
        r3 = s.delete(f"{API}/messages/{mid}", headers=auth_headers)
        assert r3.status_code == 200

        # verify hidden from active list
        r4 = s.get(f"{API}/messages")
        ids = [m["id"] for m in r4.json()]
        assert mid not in ids

        # verify visible in deleted feed, then restore
        r5 = s.get(f"{API}/feed/deleted", headers=auth_headers)
        assert r5.status_code == 200
        deleted = next((m for m in r5.json() if m["kind"] == "announcement" and m["id"] == mid), None)
        assert deleted is not None
        assert deleted["deleted"] is True

        r6 = s.post(f"{API}/messages/{mid}/restore", headers=auth_headers)
        assert r6.status_code == 200
        assert r6.json() == {"ok": True}

        r7 = s.get(f"{API}/messages")
        ids2 = [m["id"] for m in r7.json()]
        assert mid in ids2

        # cleanup for real
        assert s.delete(f"{API}/messages/{mid}", headers=auth_headers).status_code == 200
        assert s.delete(f"{API}/messages/{mid}/permanent", headers=auth_headers).status_code == 200

    def test_delete_message_requires_auth(self, s):
        r = s.delete(f"{API}/messages/nonexistent-id")
        assert r.status_code == 401

    def test_delete_unknown_message(self, s, auth_headers):
        r = s.delete(f"{API}/messages/does-not-exist", headers=auth_headers)
        assert r.status_code == 404


# ---------- Schedule CRUD ----------
class TestScheduleCRUD:
    def test_create_session_requires_auth(self, s):
        r = s.post(f"{API}/schedule", json={
            "date": "2026-07-27", "day_label": "Mon 27 July",
            "time": "20:00", "title": "TEST_x", "location": "Y"})
        assert r.status_code == 401

    def test_create_update_delete_session(self, s, auth_headers):
        payload = {"date": "2026-07-27", "day_label": "Mon 27 July", "time": "22:00",
                   "title": "TEST_session", "location": "TestLoc", "category": "social"}
        r = s.post(f"{API}/schedule", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        sid = r.json()["id"]

        # Verify persistence via GET
        r2 = s.get(f"{API}/schedule")
        assert any(x["id"] == sid and x["title"] == "TEST_session" for x in r2.json())

        # Update
        r3 = s.put(f"{API}/schedule/{sid}", json={"title": "TEST_updated"}, headers=auth_headers)
        assert r3.status_code == 200
        assert r3.json()["title"] == "TEST_updated"

        # Delete + verify
        r4 = s.delete(f"{API}/schedule/{sid}", headers=auth_headers)
        assert r4.status_code == 200
        r5 = s.get(f"{API}/schedule")
        assert not any(x["id"] == sid for x in r5.json())


# ---------- Prototype Lab ----------
class TestPrototypeLab:
    def test_public_prototype_endpoint_returns_list(self, s):
        r = s.get(f"{API}/prototype-ideas")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_publish_delete_prototype_idea(self, s, auth_headers):
        payload = {
            "title": "TEST Prototype Card",
            "summary": "Draft concept for committee review.",
            "proposed_screen": "City",
            "mock_link": "https://example.com/mock",
        }

        # create draft
        r = s.post(f"{API}/admin/prototype-ideas", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["status"] == "draft"
        idea_id = created["id"]

        # not publicly visible while draft
        r2 = s.get(f"{API}/prototype-ideas")
        assert r2.status_code == 200
        assert not any(x["id"] == idea_id for x in r2.json())

        # publish
        r3 = s.patch(f"{API}/admin/prototype-ideas/{idea_id}/publish", headers=auth_headers)
        assert r3.status_code == 200, r3.text
        published = r3.json()
        assert published["status"] == "published"

        # now publicly visible
        r4 = s.get(f"{API}/prototype-ideas")
        assert r4.status_code == 200
        assert any(x["id"] == idea_id for x in r4.json())

        # cleanup
        r5 = s.delete(f"{API}/admin/prototype-ideas/{idea_id}", headers=auth_headers)
        assert r5.status_code == 200
