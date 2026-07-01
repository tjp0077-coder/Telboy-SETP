from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import httpx
import os
import logging
import html
from pathlib import Path
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import List, Optional
import uuid
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import jwt, JWTError

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------- Mongo ----------
# Accept either MONGO_URL (Emergent/local) or MONGODB_URI (common on Render/Atlas).
mongo_url = os.environ.get("MONGO_URL") or os.environ.get("MONGODB_URI")
if not mongo_url:
    raise RuntimeError(
        "No Mongo connection string found. Set MONGO_URL or MONGODB_URI."
    )
client = AsyncIOMotorClient(mongo_url)
# DB name: DB_NAME / MONGO_DB_NAME, defaulting to the production Atlas database.
db_name = os.environ.get("DB_NAME") or os.environ.get("MONGO_DB_NAME") or "Telboy_SETP"
db = client[db_name]

admins_col = db["admins"]
schedule_col = db["schedule"]
messages_col = db["live_messages"]
event_notes_col = db["event_notes"]
contact_col = db["contact_messages"]
questions_col = db["speaker_questions"]
prototype_ideas_col = db["prototype_ideas"]
speakers_col = db["speakers"]

# ---------- Auth helpers ----------
JWT_SECRET = os.environ.get("JWT_SECRET_KEY", "change-me-in-production")
JWT_ALG = os.environ.get("JWT_ALGORITHM", "HS256")
ACCESS_MIN = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
RESEND_FROM_EMAIL = os.environ.get("RESEND_FROM_EMAIL", "setp@edi.zeneagles.com")
RESEND_CONTACT_RECIPIENT = os.environ.get("RESEND_CONTACT_RECIPIENT", "").strip()
RESEND_CONTACT_TEMPLATE_ID = os.environ.get("RESEND_CONTACT_TEMPLATE_ID", "").strip()
RESEND_CONTACT_REPLY_TEMPLATE_ID = os.environ.get("RESEND_CONTACT_REPLY_TEMPLATE_ID", "setp-template-1").strip()
RESEND_REPLY_DEBUG_SUBJECT_SUFFIX = os.environ.get("RESEND_REPLY_DEBUG_SUBJECT_SUFFIX", " [tpl:setp-template-1]")
RESEND_API_URL = "https://api.resend.com/emails"
COURTYARD_MARRIOTT_MAPS_URL = "https://maps.app.goo.gl/S8MciQDKqXvE6yHQ6"
RCPE_MAPS_URL = "https://maps.app.goo.gl/JhPNGdaKGvw22JUQ8"
FORTH_BOAT_TOURS_MAPS_URL = "https://www.google.com/maps/place/Forth+Boat+Tours/@55.992642,-3.4070465,751m/data=!3m2!1e3!4b1!4m6!3m5!1s0x4887a7ddba653f21:0x5582e10adf18277f!8m2!3d55.992642!4d-3.4070465!16s%2Fg%2F1tk62prr?authuser=0&hl=en&entry=ttu&g_ep=EgoyMDI2MDYyNC4wIKXMDSoASAFQAw%3D%3D"
PSGS_MAPS_URL = "https://maps.app.goo.gl/5fqn1CRK6T7GwFts7"
LOCATION_MAPS_URLS = {
    "courtyard by marriott edinburgh": COURTYARD_MARRIOTT_MAPS_URL,
    "departs courtyard by marriott edinburgh": COURTYARD_MARRIOTT_MAPS_URL,
    "edinburgh marriott hotel": COURTYARD_MARRIOTT_MAPS_URL,
    "departs marriott": COURTYARD_MARRIOTT_MAPS_URL,
    "https://maps.app.goo.gl/s8mciqdkqxve6yhq6": COURTYARD_MARRIOTT_MAPS_URL,
    "departs https://maps.app.goo.gl/s8mciqdkqxve6yhq6": COURTYARD_MARRIOTT_MAPS_URL,
    "the royal college of physicians of edinburgh": RCPE_MAPS_URL,
    "royal college of physicians of edinburgh": RCPE_MAPS_URL,
    "forth boat tours": FORTH_BOAT_TOURS_MAPS_URL,
    "ps&gs": PSGS_MAPS_URL,
    "st paul's & st george's (ps&gs)": PSGS_MAPS_URL,
    "st paul's & st george's church (ps&gs)": PSGS_MAPS_URL,
}

if not RESEND_CONTACT_RECIPIENT:
    raise RuntimeError("RESEND_CONTACT_RECIPIENT must be set.")
if "@" not in RESEND_CONTACT_RECIPIENT or RESEND_CONTACT_RECIPIENT.endswith("@"):
    raise RuntimeError("RESEND_CONTACT_RECIPIENT must be a valid email address.")
logging.info(
    "Contact email recipient domain configured: %s",
    RESEND_CONTACT_RECIPIENT.rsplit("@", 1)[1],
)

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def hash_pw(p: str) -> str:
    return pwd_ctx.hash(p)


def verify_pw(p: str, h: str) -> bool:
    try:
        return pwd_ctx.verify(p, h)
    except Exception:
        return False


def username_to_display_name(username: str) -> str:
    raw = (username or "").strip()
    if not raw:
        return ""
    cleaned = raw.replace(".", " ").replace("_", " ").replace("-", " ")
    parts = [p for p in cleaned.split() if p]
    if not parts:
        return raw
    return " ".join(p.capitalize() for p in parts)


def admin_display_name(admin: dict) -> str:
    username = (admin.get("username") or "").strip()
    name = (admin.get("name") or "").strip()
    if not name:
        return username_to_display_name(username) or "SETP admin"
    # Normalize legacy records where name was persisted as username.
    if username and name.lower() == username.lower():
        return username_to_display_name(username) or name
    return name


def create_token(data: dict) -> str:
    to_encode = data.copy()
    to_encode["exp"] = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_MIN)
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALG)


def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])


def normalize_session_maps_url(session: dict) -> dict:
    if not isinstance(session, dict):
        return session
    location_key = (session.get("location") or "").strip().lower()
    maps_url = LOCATION_MAPS_URLS.get(location_key)
    if maps_url and not session.get("maps_url"):
        session = dict(session)
        session["maps_url"] = maps_url
    return session


async def get_current_admin(token: Optional[str] = Depends(oauth2_scheme)):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    username = payload.get("username")
    if not username or payload.get("role") != "admin":
        raise HTTPException(status_code=401, detail="Invalid token")
    admin = await admins_col.find_one({"username": username}, {"_id": 0, "password_hash": 0})
    if not admin:
        raise HTTPException(status_code=401, detail="Admin not found")
    return admin


# ---------- App ----------
app = FastAPI(title="EDI SETP 2026 API")
api = APIRouter(prefix="/api")


# ---------- Models ----------
class LoginIn(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    name: str


class AdminOut(BaseModel):
    username: str
    name: str
    role: str = "admin"


class AdminCreate(BaseModel):
    username: str
    name: str
    password: str


class SessionItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str            # e.g. "2026-07-27"
    day_label: str       # e.g. "Mon 27 July"
    time: str            # e.g. "08:30"
    end_time: Optional[str] = None
    coachTime: Optional[str] = None
    transportDetails: Optional[str] = None
    maps_url: Optional[str] = None
    speakerId: Optional[str] = None
    speakerBios: List["SessionSpeakerBio"] = Field(default_factory=list)
    title: str
    location: str
    description: Optional[str] = ""
    category: str = "session"   # session | break | social | tour | meal


class SessionCreate(BaseModel):
    date: str
    day_label: str
    time: str
    end_time: Optional[str] = None
    coachTime: Optional[str] = None
    transportDetails: Optional[str] = None
    maps_url: Optional[str] = None
    speakerId: Optional[str] = None
    speakerBios: List["SessionSpeakerBio"] = Field(default_factory=list)
    title: str
    location: str
    description: Optional[str] = ""
    category: str = "session"


class SessionUpdate(BaseModel):
    date: Optional[str] = None
    day_label: Optional[str] = None
    time: Optional[str] = None
    end_time: Optional[str] = None
    coachTime: Optional[str] = None
    transportDetails: Optional[str] = None
    maps_url: Optional[str] = None
    speakerId: Optional[str] = None
    speakerBios: Optional[List["SessionSpeakerBio"]] = None
    title: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None


class MessageItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    title: Optional[str] = ""
    priority: str = "info"   # info | important | urgent
    author: str
    created_at: str          # ISO
    deleted: bool = False
    deleted_at: Optional[str] = None
    deleted_by: Optional[str] = None


class MessageCreate(BaseModel):
    text: str
    title: Optional[str] = ""
    priority: str = "info"


class EventNote(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_id: str
    text: str
    author: str
    created_at: str
    deleted: bool = False
    deleted_at: Optional[str] = None
    deleted_by: Optional[str] = None


class EventNoteCreate(BaseModel):
    text: str


class FeedItem(BaseModel):
    kind: str   # "announcement" | "event_note"
    id: str
    text: str
    title: Optional[str] = ""
    priority: Optional[str] = None
    author: str
    created_at: str
    event_id: Optional[str] = None
    event_title: Optional[str] = None
    deleted: bool = False
    deleted_at: Optional[str] = None
    deleted_by: Optional[str] = None


class PrototypeIdea(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    summary: str
    proposed_screen: Optional[str] = ""
    mock_link: Optional[str] = ""
    status: str = "draft"   # draft | published
    created_by: str
    created_at: str
    published_at: Optional[str] = None
    published_by: Optional[str] = None


class PrototypeIdeaCreate(BaseModel):
    title: str
    summary: str
    proposed_screen: Optional[str] = ""
    mock_link: Optional[str] = ""


class ContactCreate(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    organisation: Optional[str] = None
    phone: Optional[str] = None
    subject: str
    message: str
    event_id: Optional[str] = None
    thread_id: Optional[str] = None

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value):
        if value is None:
            return None
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class ContactItem(BaseModel):
    id: str
    name: str
    email: str
    organisation: Optional[str] = None
    phone: Optional[str] = None
    subject: str
    message: str
    created_at: str
    updated_at: str
    read: bool = False
    event_id: Optional[str] = None
    event_title: Optional[str] = None
    messages: List[dict] = Field(default_factory=list)
    deleted: bool = False
    deleted_at: Optional[str] = None
    deleted_by: Optional[str] = None


class ContactThreadMessage(BaseModel):
    id: str
    sender_role: str
    sender_name: str
    sender_email: Optional[str] = None
    subject: Optional[str] = None
    message: str
    created_at: str


class ContactReplyCreate(BaseModel):
    message: str
    subject: Optional[str] = None


class QuestionCreate(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    question: str
    event_id: Optional[str] = None

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value):
        if value is None:
            return None
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class QuestionItem(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    question: str
    created_at: str
    updated_at: str
    reviewed: bool = False
    reviewed_at: Optional[str] = None
    reviewed_by: Optional[str] = None
    event_id: Optional[str] = None
    event_title: Optional[str] = None
    deleted: bool = False
    deleted_at: Optional[str] = None
    deleted_by: Optional[str] = None


def count_words(value: str) -> int:
    return len([word for word in (value or "").strip().split() if word])


class SessionSpeakerBio(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    paperTitle: str
    name: str
    title: str
    company: str
    bioText: str
    imageUrl: str

    @field_validator("paperTitle", "name", "title", "company", "imageUrl")
    @classmethod
    def required_text(cls, value: str):
        if not value or not value.strip():
            raise ValueError("Field is required")
        return value.strip()

    @field_validator("bioText")
    @classmethod
    def validate_bio_text(cls, value: str):
        words = count_words(value)
        if words > 500:
            raise ValueError("bioText must be between 0 and 500 words")
        return value


class SpeakerItem(BaseModel):
    id: str
    name: str
    title: str
    company: str
    bioText: str
    imageUrl: str

    @field_validator("bioText")
    @classmethod
    def validate_bio_text(cls, value: str):
        words = count_words(value)
        if words > 500:
            raise ValueError("bioText must be between 0 and 500 words")
        return value


class SpeakerUpdate(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    company: Optional[str] = None
    bioText: Optional[str] = None
    imageUrl: Optional[str] = None

    @field_validator("bioText")
    @classmethod
    def validate_bio_text(cls, value: Optional[str]):
        if value is None:
            return value
        words = count_words(value)
        if words > 500:
            raise ValueError("bioText must be between 0 and 500 words")
        return value


def build_contact_thread_message(
    sender_role: str,
    sender_name: str,
    sender_email: str,
    subject: str,
    message: str,
    created_at: str,
):
    return ContactThreadMessage(
        id=str(uuid.uuid4()),
        sender_role=sender_role,
        sender_name=sender_name,
        sender_email=sender_email or None,
        subject=subject,
        message=message,
        created_at=created_at,
    ).model_dump()


def normalize_contact_thread(doc: dict) -> dict:
    normalized = dict(doc)
    messages = normalized.get("messages")
    if isinstance(messages, list) and messages:
        messages = [dict(m) for m in messages]
    if not isinstance(messages, list) or not messages:
        messages = [
            build_contact_thread_message(
                "delegate",
                normalized.get("name", "Delegate"),
                normalized.get("email", ""),
                normalized.get("subject", ""),
                normalized.get("message", ""),
                normalized.get("created_at") or datetime.now(timezone.utc).isoformat(),
            )
        ]
    messages = sorted(messages, key=lambda m: m.get("created_at", ""))
    normalized["messages"] = messages
    normalized["updated_at"] = normalized.get("updated_at") or messages[-1].get("created_at") or normalized.get("created_at")
    normalized["deleted"] = bool(normalized.get("deleted"))
    normalized["deleted_at"] = normalized.get("deleted_at")
    normalized["deleted_by"] = normalized.get("deleted_by")
    return normalized


def normalize_question_record(doc: dict) -> dict:
    normalized = dict(doc)
    normalized["reviewed"] = bool(normalized.get("reviewed"))
    normalized["reviewed_at"] = normalized.get("reviewed_at")
    normalized["reviewed_by"] = normalized.get("reviewed_by")
    normalized["deleted"] = bool(normalized.get("deleted"))
    normalized["deleted_at"] = normalized.get("deleted_at")
    normalized["deleted_by"] = normalized.get("deleted_by")
    return normalized


# ---------- Seed data ----------
SEED_SCHEDULE = [
    # Sun 26 July - Registration day
    {"date": "2026-07-26", "day_label": "Sun 26 July", "time": "16:00", "end_time": "20:00",
    "title": "Registration & Welcome Reception", "location": "Courtyard by Marriott Edinburgh",
     "description": "Collect delegate badges, welcome packs, and meet fellow attendees over drinks and canapés.",
    "maps_url": COURTYARD_MARRIOTT_MAPS_URL,
     "category": "social"},

    # Mon 27 July
    {"date": "2026-07-27", "day_label": "Mon 27 July", "time": "08:00", "title": "Check In",
     "location": "St Paul's & St George's (Ps&Gs)", "description": "Light snacks, coffee, and tea.",
     "category": "meal"},
    {"date": "2026-07-27", "day_label": "Mon 27 July", "time": "08:30", "title": "Opening Address",
     "location": "Ps&Gs", "description": "Welcome address by Symposium Chairman, Dave Mackay.",
     "category": "session"},
    {"date": "2026-07-27", "day_label": "Mon 27 July", "time": "08:50", "title": "Technical Session 1",
        "location": "Ps&Gs", "description": "Presentation of Papers 1 and 2.", "category": "session", "speakerId": "capt-james-smith"},
    {"date": "2026-07-27", "day_label": "Mon 27 July", "time": "09:55", "title": "Coffee Break",
     "location": "Ps&Gs", "description": "Morning networking and refreshments.", "category": "break"},
    {"date": "2026-07-27", "day_label": "Mon 27 July", "time": "10:00", "title": "Partner's Tour",
        "location": "Departs Courtyard by Marriott Edinburgh",
     "description": "Tour to Rosslyn Castle, The Kelpies, and Linlithgow Palace. Returns by 16:00.",
        "maps_url": COURTYARD_MARRIOTT_MAPS_URL,
     "category": "tour"},
    {"date": "2026-07-27", "day_label": "Mon 27 July", "time": "10:15", "title": "Technical Session 1 (Cont.)",
        "location": "Ps&Gs", "description": "Presentation of Papers 3, 4, and 5.", "category": "session", "speakerId": "capt-james-smith"},
    {"date": "2026-07-27", "day_label": "Mon 27 July", "time": "11:55", "title": "Lunch",
     "location": "Ps&Gs", "description": "Midday lunch break.", "category": "meal"},
    {"date": "2026-07-27", "day_label": "Mon 27 July", "time": "13:30", "title": "State of the Society Address",
     "location": "Ps&Gs", "description": "Address by SETP President, Kelly Latimer.", "category": "session"},
    {"date": "2026-07-27", "day_label": "Mon 27 July", "time": "14:05", "title": "Technical Session 2",
        "location": "Ps&Gs", "description": "Presentation of Papers 6 and 7.", "category": "session", "speakerId": "dr-amina-khan"},
    {"date": "2026-07-27", "day_label": "Mon 27 July", "time": "15:10", "title": "Coffee Break",
     "location": "Ps&Gs", "description": "Afternoon refreshments.", "category": "break"},
    {"date": "2026-07-27", "day_label": "Mon 27 July", "time": "15:30", "title": "Technical Session 2 (Cont.)",
        "location": "Ps&Gs", "description": "Presentation of Papers 8 and 9.", "category": "session", "speakerId": "dr-amina-khan"},
    {"date": "2026-07-27", "day_label": "Mon 27 July", "time": "16:40", "title": "Closing Remarks",
     "location": "Ps&Gs", "description": "End of day 1 technical sessions.", "category": "session"},
    {"date": "2026-07-27", "day_label": "Mon 27 July", "time": "18:30", "end_time": "21:30",
     "title": "Taste of Scotland Social", "location": "Ps&Gs",
     "description": "Casual evening featuring a buffet, Witches and Whisky cultural show, Knights Vault sword demonstration, and music by Reely Jiggered.",
     "category": "social"},

    # Tue 28 July
    {"date": "2026-07-28", "day_label": "Tue 28 July", "time": "08:00", "title": "Check In",
     "location": "Ps&Gs", "description": "Light snacks, coffee, and tea.", "category": "meal"},
    {"date": "2026-07-28", "day_label": "Tue 28 July", "time": "08:30", "title": "Opening Address",
     "location": "Ps&Gs", "description": "Address by Symposium Chairman, Dave Mackay.", "category": "session"},
    {"date": "2026-07-28", "day_label": "Tue 28 July", "time": "08:50", "title": "Technical Session 3",
        "location": "Ps&Gs", "description": "Presentation of Papers 10 and 11.", "category": "session", "speakerId": "capt-james-smith"},
    {"date": "2026-07-28", "day_label": "Tue 28 July", "time": "09:55", "title": "Coffee Break",
     "location": "Ps&Gs", "description": "Morning refreshments.", "category": "break"},
    {"date": "2026-07-28", "day_label": "Tue 28 July", "time": "10:00", "title": "Partner's Walking Tour",
        "location": "Departs Courtyard by Marriott Edinburgh",
     "description": "Guided walking tour of the Royal Mile and Edinburgh Castle. Returns by 15:00.",
        "maps_url": COURTYARD_MARRIOTT_MAPS_URL,
     "category": "tour"},
    {"date": "2026-07-28", "day_label": "Tue 28 July", "time": "10:15", "title": "Technical Session 3 (Cont.)",
        "location": "Ps&Gs", "description": "Presentation of Papers 12, 13, and 14.", "category": "session", "speakerId": "capt-james-smith"},
    {"date": "2026-07-28", "day_label": "Tue 28 July", "time": "11:55", "title": "Lunch",
     "location": "Ps&Gs", "description": "Midday lunch break.", "category": "meal"},
    {"date": "2026-07-28", "day_label": "Tue 28 July", "time": "13:30", "title": "State of the Union Address",
     "location": "Ps&Gs", "description": "Address by SETP President.", "category": "session"},
    {"date": "2026-07-28", "day_label": "Tue 28 July", "time": "14:05", "title": "Technical Session 4",
        "location": "Ps&Gs", "description": "Presentation of Papers 15 and 16.", "category": "session", "speakerId": "dr-amina-khan"},
    {"date": "2026-07-28", "day_label": "Tue 28 July", "time": "15:10", "title": "Coffee Break",
     "location": "Ps&Gs", "description": "Afternoon refreshments.", "category": "break"},
    {"date": "2026-07-28", "day_label": "Tue 28 July", "time": "15:30", "title": "Technical Session 4 (Cont.)",
        "location": "Ps&Gs", "description": "Presentation of Papers 17 and 18.", "category": "session", "speakerId": "dr-amina-khan"},
    {"date": "2026-07-28", "day_label": "Tue 28 July", "time": "16:40", "title": "Closing Remarks",
     "location": "Ps&Gs", "description": "End of day 2 technical sessions.", "category": "session"},
    {"date": "2026-07-28", "day_label": "Tue 28 July", "time": "19:00", "end_time": "22:00",
     "title": "Royal Yacht Britannia Reception", "location": "Royal Yacht Britannia",
     "description": "Reception sponsored by QinetiQ. Transport provided from https://maps.app.goo.gl/S8MciQDKqXvE6yHQ6.",
     "coachTime": "18:30",
     "transportDetails": "6:30 pm - Coach leaves hotel",
     "category": "social"},

    # Wed 29 July
    {"date": "2026-07-29", "day_label": "Wed 29 July", "time": "08:00", "title": "Check In",
    "location": "The Royal College of Physicians of Edinburgh", "description": "Light snacks, coffee, and tea.", "category": "meal"},
    {"date": "2026-07-29", "day_label": "Wed 29 July", "time": "08:30", "title": "Opening Address",
    "location": "The Royal College of Physicians of Edinburgh",
     "description": "Address by Symposium Chairman, Dave Mackay.", "category": "session"},
    {"date": "2026-07-29", "day_label": "Wed 29 July", "time": "08:50", "title": "Technical Session 5",
    "location": "The Royal College of Physicians of Edinburgh", "description": "Presentation of Papers 19 and 20.",
        "category": "session", "speakerId": "prof-liam-byrne"},
    {"date": "2026-07-29", "day_label": "Wed 29 July", "time": "09:55", "title": "Coffee Break",
    "location": "The Royal College of Physicians of Edinburgh", "description": "Morning refreshments.", "category": "break"},
    {"date": "2026-07-29", "day_label": "Wed 29 July", "time": "10:15", "title": "Technical Session 5 (Cont.)",
    "location": "The Royal College of Physicians of Edinburgh", "description": "Presentation of Papers 21, 22, and 23.",
        "category": "session", "speakerId": "prof-liam-byrne"},
    {"date": "2026-07-29", "day_label": "Wed 29 July", "time": "11:55", "title": "Lunch",
    "location": "The Royal College of Physicians of Edinburgh", "description": "Midday lunch break.", "category": "meal"},
    {"date": "2026-07-29", "day_label": "Wed 29 July", "time": "13:15", "title": "Guest Speaker",
    "location": "The Royal College of Physicians of Edinburgh",
        "description": "Speaker presentation (Paul Beaver TBC).", "category": "session", "speakerId": "paul-beaver"},
    {"date": "2026-07-29", "day_label": "Wed 29 July", "time": "19:00", "end_time": "23:00",
    "title": "Symposium Banquet", "location": "The Royal College of Physicians of Edinburgh",
     "description": "Formal closing banquet with guest speaker Will Whitehorn. 10-minute walk or taxi from https://maps.app.goo.gl/S8MciQDKqXvE6yHQ6.",
     "category": "social"},

    # Thu 30 July
     {"date": "2026-07-30", "day_label": "Thu 30 July", "time": "10:00", "end_time": "15:00",
      "title": "Technical Boat Tour", "location": "Forth Boat Tours",
          "description": "Private charter boat trip to conclude the symposium. Dedicated coach transport from city centre.",
          "coachTime": "08:45",
          "transportDetails": "08:45 – Coach leaves hotel",
          "maps_url": "https://www.google.com/maps/place/Forth+Boat+Tours/@55.992642,-3.4070465,751m/data=!3m2!1e3!4b1!4m6!3m5!1s0x4887a7ddba653f21:0x5582e10adf18277f!8m2!3d55.992642!4d-3.4070465!16s%2Fg%2F1tk62prr?authuser=0&hl=en&entry=ttu&g_ep=EgoyMDI2MDYyNC4wIKXMDSoASAFQAw%3D%3D",
      "category": "tour"},
]


SEED_SPEAKERS = [
    {
        "id": "capt-james-smith",
        "name": "James Smith",
        "title": "Capt.",
        "company": "Royal Air Force",
        "imageUrl": "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=facearea&w=240&h=240&q=80",
        "bioText": "Captain James Smith is a senior experimental test pilot with more than two decades of service across rotary and fixed-wing flight test programs. He began his operational career on maritime patrol aircraft before transitioning into developmental testing, where he focused on mission systems integration and envelope expansion for high-workload sorties. Across multiple collaborative trials, he has led test planning teams that brought together military operators, airworthiness engineers, and software specialists to de-risk capability insertions under compressed delivery timelines. His published symposium work frequently explores practical methods for balancing evidence-based risk decisions with the realities of squadron tempo and limited instrumentation windows. James is known for his disciplined approach to cockpit data capture, emphasizing repeatable briefing structures, tight card design, and post-flight reconstruction that can be understood by mixed technical audiences. Beyond cockpit duties, he has mentored early-career pilots through transition pathways into formal test organizations, with particular attention to communication habits and technical writing quality. He has represented his unit in multinational exchanges focused on mission autonomy, degraded-navigation resilience, and pilot decision support. At this symposium, he is presenting lessons learned from recent integrated trials and offering recommendations for improving the handoff between design teams and front-line operators. His perspective reflects both operational urgency and long-horizon safety stewardship, and he remains committed to raising standards in collaborative flight test execution across the wider community.",
    },
    {
        "id": "dr-amina-khan",
        "name": "Amina Khan",
        "title": "Dr.",
        "company": "QinetiQ",
        "imageUrl": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&w=240&h=240&q=80",
        "bioText": "Dr. Amina Khan is a flight sciences specialist and systems evaluation lead at QinetiQ, where she directs multidisciplinary teams working at the boundary between aerodynamic performance, control law behavior, and mission-level effectiveness. She earned her doctorate in aerospace engineering with research centered on pilot-vehicle interaction during high-gain maneuvering, and she has since contributed to both military and civil test campaigns involving advanced augmentation and fault-tolerant control. Amina is recognized for translating dense analytical outputs into briefing material that pilots and program leaders can quickly apply during dynamic campaign planning. Her recent projects have included model-assisted envelope build-up, comparative handling assessments across software baselines, and rapid evidence packages for certification-adjacent reviews. She is a frequent contributor to internal standards on data integrity, telemetry confidence, and test repeatability under weather-constrained schedules. Colleagues value her ability to align specialist perspectives from simulation, instrumentation, and operations without losing focus on test intent. In mentoring roles, she has developed practical curricula for new flight test engineers that emphasize question framing, traceable assumptions, and actionable debrief synthesis. At this year’s symposium, Amina is sharing techniques for accelerating insight generation during technical session campaigns while preserving analytical rigor and safety margins. Her work demonstrates that disciplined preparation, transparent uncertainty handling, and collaborative debrief culture can materially improve both campaign pace and decision quality. She remains committed to strengthening evidence-led practice across the global test pilot and engineer community.",
    },
    {
        "id": "prof-liam-byrne",
        "name": "Liam Byrne",
        "title": "Prof.",
        "company": "University of Glasgow",
        "imageUrl": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=facearea&w=240&h=240&q=80",
        "bioText": "Professor Liam Byrne is Chair of Applied Flight Systems at the University of Glasgow and an advisor to multiple joint-industry programs focused on resilient airborne mission architectures. His academic and consulting work bridges system safety, human factors, and verification strategy for rapidly evolving avionics stacks. Over the last fifteen years, he has partnered with test organizations to design evidence frameworks that connect cockpit observations with traceable engineering claims, allowing teams to make faster yet defensible decisions during campaign execution. Liam has authored widely used guidance on scenario-based test design, emphasizing representative operational contexts rather than narrow requirement demonstrations alone. He has served on review boards for modernization initiatives that integrate new autonomy features into legacy airframes, helping teams identify latent coupling risks before flight. In classroom and executive settings, he is known for making complex assurance concepts practical, with a strong focus on communication quality between pilots, analysts, and program leadership. His recent publications discuss methods for reducing re-test churn through sharper hypothesis definition and better instrumented debrief workflows. At the symposium, Liam is presenting perspectives from technical session five on evidence confidence, argument quality, and sustained learning across campaign phases. He advocates for test cultures that reward curiosity, candor, and disciplined dissent, particularly when schedule pressure is high. His contributions continue to influence how organizations structure cross-functional test collaboration, train emerging specialists, and deliver meaningful capability improvements with safety at the core.",
    },
    {
        "id": "paul-beaver",
        "name": "Paul Beaver",
        "title": "Mr.",
        "company": "Aviation Historian & Broadcaster",
        "imageUrl": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&w=240&h=240&q=80",
        "bioText": "Paul Beaver is an aviation historian, commentator, and author whose work has helped connect specialist flight test discourse with wider public understanding of aerospace innovation. Over a long career spanning journalism, documentary collaboration, and technical event hosting, he has built a reputation for contextualizing modern program choices against historical lessons from landmark development campaigns. Paul has interviewed generations of pilots, engineers, and maintainers, curating first-hand accounts that illuminate why successful test cultures depend on both technical rigor and candid human communication. His speaking engagements frequently explore how institutional memory can strengthen contemporary decision-making, particularly in periods of rapid capability transition. He has contributed to museum and heritage initiatives that preserve records of experimental programs while translating complex artifacts into accessible narratives for broader audiences. At professional symposia, Paul is known for bridging communities: encouraging engineers to surface assumptions clearly, helping operators articulate mission realities, and challenging leaders to preserve learning pathways beyond individual projects. His current work highlights the value of narrative discipline in post-flight analysis, where the way findings are framed can influence whether teams act decisively or defer critical changes. During this event, he offers a keynote perspective on continuity, leadership, and the enduring principles that underpin safe innovation in flight test. His message emphasizes that technological progress is strongest when technical evidence, operational insight, and historical awareness are considered together. Through writing and public engagement, Paul continues to champion informed dialogue across the international aerospace community.",
    },
]


TECHNICAL_SESSION_PAPERS = {
    "Technical Session 1": "Papers 1 and 2",
    "Technical Session 1 (Cont.)": "Papers 3, 4, and 5",
    "Technical Session 2": "Papers 6 and 7",
    "Technical Session 2 (Cont.)": "Papers 8 and 9",
    "Technical Session 3": "Papers 10 and 11",
    "Technical Session 3 (Cont.)": "Papers 12, 13, and 14",
    "Technical Session 4": "Papers 15 and 16",
    "Technical Session 4 (Cont.)": "Papers 17 and 18",
    "Technical Session 5": "Papers 19 and 20",
    "Technical Session 5 (Cont.)": "Papers 21, 22, and 23",
    "Guest Speaker": "Guest Speaker Presentation",
}


def speaker_seed_by_id(speaker_id: str) -> Optional[dict]:
    for speaker in SEED_SPEAKERS:
        if speaker.get("id") == speaker_id:
            return speaker
    return None


def build_session_bio(speaker: dict, paper_title: str) -> dict:
    return SessionSpeakerBio(
        paperTitle=paper_title,
        name=speaker.get("name", ""),
        title=speaker.get("title", ""),
        company=speaker.get("company", ""),
        bioText=speaker.get("bioText", ""),
        imageUrl=speaker.get("imageUrl", ""),
    ).model_dump()


async def seed_admins():
    configs = [
        ("ADMIN1_USERNAME", "ADMIN1_PASSWORD", "ADMIN1_NAME"),
        ("ADMIN2_USERNAME", "ADMIN2_PASSWORD", "ADMIN2_NAME"),
        ("ADMIN3_USERNAME", "ADMIN3_PASSWORD", "ADMIN3_NAME"),
    ]
    for u_env, p_env, n_env in configs:
        username = (os.getenv(u_env) or "").strip().lower()
        password = os.getenv(p_env)
        name = (os.getenv(n_env) or "").strip() or username_to_display_name(username)
        if not username or not password:
            continue
        # Self-healing upsert: keep the admin's password_hash and name in sync
        # with the environment variables on every startup. This repairs records
        # that are missing/incorrect (e.g. a corrupt doc with no password_hash)
        # and lets credentials be managed entirely via env vars + a redeploy.
        await admins_col.update_one(
            {"username": username},
            {
                "$set": {
                    "username": username,
                    "name": name,
                    "password_hash": hash_pw(password),
                    "role": "admin",
                },
                "$setOnInsert": {
                    "created_at": datetime.now(timezone.utc).isoformat(),
                },
            },
            upsert=True,
        )


async def seed_schedule():
    await schedule_col.update_one(
        {"date": "2026-07-28", "time": "19:00", "location": "Royal Yacht Britannia"},
        {"$set": {"coachTime": "18:30", "transportDetails": "6:30 pm - Coach leaves hotel"}},
    )
    count = await schedule_col.count_documents({})
    if count > 0:
        await schedule_col.update_one(
            {"title": "Registration & Welcome Reception"},
            {"$set": {"location": "Courtyard by Marriott Edinburgh", "maps_url": COURTYARD_MARRIOTT_MAPS_URL}},
        )
        await schedule_col.update_one(
            {"title": "Partner's Tour"},
            {"$set": {"location": "Departs Courtyard by Marriott Edinburgh", "maps_url": COURTYARD_MARRIOTT_MAPS_URL}},
        )
        await schedule_col.update_one(
            {"title": "Partner's Walking Tour"},
            {"$set": {"location": "Departs Courtyard by Marriott Edinburgh", "maps_url": COURTYARD_MARRIOTT_MAPS_URL}},
        )
        speaker_map = {
            "Technical Session 1": "capt-james-smith",
            "Technical Session 1 (Cont.)": "capt-james-smith",
            "Technical Session 2": "dr-amina-khan",
            "Technical Session 2 (Cont.)": "dr-amina-khan",
            "Technical Session 3": "capt-james-smith",
            "Technical Session 3 (Cont.)": "capt-james-smith",
            "Technical Session 4": "dr-amina-khan",
            "Technical Session 4 (Cont.)": "dr-amina-khan",
            "Technical Session 5": "prof-liam-byrne",
            "Technical Session 5 (Cont.)": "prof-liam-byrne",
            "Guest Speaker": "paul-beaver",
        }
        for title, speaker_id in speaker_map.items():
            await schedule_col.update_many({"title": title, "speakerId": {"$exists": False}}, {"$set": {"speakerId": speaker_id}})
            speaker_doc = await speakers_col.find_one({"id": speaker_id}, {"_id": 0})
            if not speaker_doc:
                continue
            paper_title = TECHNICAL_SESSION_PAPERS.get(title, title)
            await schedule_col.update_many(
                {
                    "title": title,
                    "$or": [
                        {"speakerBios": {"$exists": False}},
                        {"speakerBios": []},
                    ],
                },
                {"$set": {"speakerBios": [build_session_bio(speaker_doc, paper_title)]}},
            )
        return
    docs = []
    speaker_map = {
        "Technical Session 1": "capt-james-smith",
        "Technical Session 1 (Cont.)": "capt-james-smith",
        "Technical Session 2": "dr-amina-khan",
        "Technical Session 2 (Cont.)": "dr-amina-khan",
        "Technical Session 3": "capt-james-smith",
        "Technical Session 3 (Cont.)": "capt-james-smith",
        "Technical Session 4": "dr-amina-khan",
        "Technical Session 4 (Cont.)": "dr-amina-khan",
        "Technical Session 5": "prof-liam-byrne",
        "Technical Session 5 (Cont.)": "prof-liam-byrne",
        "Guest Speaker": "paul-beaver",
    }
    for item in SEED_SCHEDULE:
        d = dict(item)
        d["id"] = str(uuid.uuid4())
        title = d.get("title", "")
        speaker_id = speaker_map.get(title)
        if speaker_id and not d.get("speakerBios"):
            speaker = speaker_seed_by_id(speaker_id)
            if speaker:
                d["speakerBios"] = [build_session_bio(speaker, TECHNICAL_SESSION_PAPERS.get(title, title))]
        docs.append(d)
    if docs:
        await schedule_col.insert_many(docs)


async def seed_messages():
    count = await messages_col.count_documents({})
    if count > 0:
        return
    welcome = {
        "id": str(uuid.uuid4()),
        "title": "Welcome to Edinburgh!",
        "text": "Welcome to the SETP Test Pilot Symposium 2026. Registration opens Friday 25 July at https://maps.app.goo.gl/S8MciQDKqXvE6yHQ6 from 16:00. Safe travels!",
        "priority": "important",
        "author": "Dave Mackay",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await messages_col.insert_one(welcome)


async def seed_speakers():
    for speaker in SEED_SPEAKERS:
        await speakers_col.update_one(
            {"id": speaker["id"]},
            {"$set": speaker},
            upsert=True,
        )


@app.on_event("startup")
async def on_startup():
    await seed_admins()
    await seed_speakers()
    await seed_schedule()
    await seed_messages()


# ---------- Auth routes ----------
@api.post("/auth/login", response_model=TokenOut)
async def login(data: LoginIn):
    # Normalize the same way create_admin/delete_admin do (strip + lowercase),
    # so usernames are matched case-insensitively. Without this, an admin created
    # as "kelly.latimer" could not log in by typing "Kelly.Latimer".
    username = data.username.strip().lower()
    admin = await admins_col.find_one({"username": username})
    pw_hash = admin.get("password_hash") if admin else None
    if not admin or not pw_hash or not verify_pw(data.password, pw_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token({
        "sub": admin["username"], "username": admin["username"], "role": "admin"
    })
    return TokenOut(
        access_token=token, username=admin["username"], name=admin_display_name(admin)
    )


@api.get("/auth/me", response_model=AdminOut)
async def me(admin=Depends(get_current_admin)):
    return AdminOut(username=admin["username"], name=admin_display_name(admin))


# ---------- Admin Management ----------
ADMIN_MANAGER_NAMES = {"terry parker", "dave mackay"}


def can_manage_admins(admin: dict) -> bool:
    return (admin_display_name(admin) or "").strip().lower() in ADMIN_MANAGER_NAMES


@api.get("/admins", response_model=List[AdminOut])
async def list_admins(admin=Depends(get_current_admin)):
    docs = await admins_col.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    docs.sort(key=lambda d: d.get("created_at", ""))
    return [AdminOut(username=d["username"], name=admin_display_name(d)) for d in docs]


@api.post("/admins", response_model=AdminOut, status_code=201)
async def create_admin(data: AdminCreate, admin=Depends(get_current_admin)):
    if not can_manage_admins(admin):
        raise HTTPException(status_code=403, detail="Not authorized to manage committee members")
    username = data.username.strip().lower()
    name = data.name.strip()
    password = data.password
    if not username or not name or not password:
        raise HTTPException(status_code=400, detail="username, name and password are required")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if " " in username:
        raise HTTPException(status_code=400, detail="Username cannot contain spaces")
    existing = await admins_col.find_one({"username": username})
    if existing:
        raise HTTPException(status_code=409, detail="Username already exists")
    await admins_col.insert_one({
        "username": username,
        "name": name,
        "password_hash": hash_pw(password),
        "role": "admin",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return AdminOut(username=username, name=name)


@api.delete("/admins/{username}")
async def delete_admin(username: str, admin=Depends(get_current_admin)):
    if not can_manage_admins(admin):
        raise HTTPException(status_code=403, detail="Not authorized to manage committee members")
    target = username.strip().lower()
    if target == admin["username"]:
        raise HTTPException(status_code=400, detail="You can't remove your own account")
    total = await admins_col.count_documents({})
    if total <= 1:
        raise HTTPException(status_code=400, detail="At least one admin must remain")
    res = await admins_col.delete_one({"username": target})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Admin not found")
    return {"deleted": True}


# ---------- Schedule ----------
@api.get("/schedule", response_model=List[SessionItem])
async def list_schedule():
    docs = await schedule_col.find({}, {"_id": 0}).to_list(1000)
    # sort by date then time
    docs.sort(key=lambda d: (d.get("date", ""), d.get("time", "")))
    return [normalize_session_maps_url(doc) for doc in docs]


@api.get("/schedule/{session_id}", response_model=SessionItem)
async def get_session(session_id: str):
    doc = await schedule_col.find_one({"id": session_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return normalize_session_maps_url(doc)


@api.post("/schedule", response_model=SessionItem)
async def create_session(data: SessionCreate, admin=Depends(get_current_admin)):
    item = SessionItem(**data.dict())
    await schedule_col.insert_one(item.dict())
    return normalize_session_maps_url(item.dict())


@api.put("/schedule/{session_id}", response_model=SessionItem)
async def update_session(session_id: str, data: SessionUpdate, admin=Depends(get_current_admin)):
    existing = await schedule_col.find_one({"id": session_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if update_data:
        await schedule_col.update_one({"id": session_id}, {"$set": update_data})
    updated = await schedule_col.find_one({"id": session_id}, {"_id": 0})
    return normalize_session_maps_url(updated)


@api.delete("/schedule/{session_id}")
async def delete_session(session_id: str, admin=Depends(get_current_admin)):
    res = await schedule_col.delete_one({"id": session_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    # cascade — drop the notes attached to this event
    await event_notes_col.delete_many({"event_id": session_id})
    return {"deleted": True}


# ---------- Speakers ----------
@api.get("/speakers", response_model=List[SpeakerItem])
async def list_speakers():
    docs = await speakers_col.find({}, {"_id": 0}).to_list(1000)
    docs.sort(key=lambda d: (d.get("name", ""), d.get("title", "")))
    return docs


@api.get("/speakers/{speaker_id}", response_model=SpeakerItem)
async def get_speaker(speaker_id: str):
    doc = await speakers_col.find_one({"id": speaker_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Speaker not found")
    return doc


@api.put("/speakers/{speaker_id}", response_model=SpeakerItem)
async def update_speaker(speaker_id: str, data: SpeakerUpdate, admin=Depends(get_current_admin)):
    existing = await speakers_col.find_one({"id": speaker_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Speaker not found")
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if update_data:
        await speakers_col.update_one({"id": speaker_id}, {"$set": update_data})
    updated = await speakers_col.find_one({"id": speaker_id}, {"_id": 0})
    return updated


# ---------- Per-Event Notes ----------
@api.get("/schedule/{session_id}/notes", response_model=List[EventNote])
async def list_event_notes(session_id: str):
    docs = await event_notes_col.find({"event_id": session_id, "deleted": {"$ne": True}}, {"_id": 0}).to_list(200)
    docs.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    return docs


@api.post("/schedule/{session_id}/notes", response_model=EventNote)
async def create_event_note(
    session_id: str, data: EventNoteCreate, admin=Depends(get_current_admin)
):
    session = await schedule_col.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Event not found")
    note = EventNote(
        event_id=session_id,
        text=data.text,
        author=admin_display_name(admin),
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    await event_notes_col.insert_one(note.dict())
    return note


@api.delete("/schedule/{session_id}/notes/{note_id}")
async def delete_event_note(session_id: str, note_id: str, admin=Depends(get_current_admin)):
    existing = await event_notes_col.find_one({"id": note_id, "event_id": session_id, "deleted": {"$ne": True}}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")

    deleted_at = datetime.now(timezone.utc).isoformat()
    deleted_by = admin.get("username") or admin.get("name") or "admin"
    res = await event_notes_col.update_one(
        {"id": note_id, "event_id": session_id, "deleted": {"$ne": True}},
        {"$set": {"deleted": True, "deleted_at": deleted_at, "deleted_by": deleted_by}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    event = await schedule_col.find_one({"id": session_id}, {"_id": 0, "title": 1})
    await send_admin_audit_email(
        "[SETP admin] Session note archived",
        build_admin_audit_body("archive", "session note", admin, [
            f"Note ID: {note_id}",
            f"Event ID: {session_id}",
            f"Event title: {(event or {}).get('title', '(unknown)')}",
            f"Author: {existing.get('author', '(unknown)')}",
            f"Text: {existing.get('text', '')}",
        ]),
    )
    return {"deleted": True}


@api.post("/schedule/{session_id}/notes/{note_id}/restore")
async def restore_event_note(session_id: str, note_id: str, admin=Depends(get_current_admin)):
    existing = await event_notes_col.find_one({"id": note_id, "event_id": session_id, "deleted": True}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")

    res = await event_notes_col.update_one(
        {"id": note_id, "event_id": session_id, "deleted": True},
        {"$set": {"deleted": False, "deleted_at": None, "deleted_by": None}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    event = await schedule_col.find_one({"id": session_id}, {"_id": 0, "title": 1})
    await send_admin_audit_email(
        "[SETP admin] Session note restored",
        build_admin_audit_body("restore", "session note", admin, [
            f"Note ID: {note_id}",
            f"Event ID: {session_id}",
            f"Event title: {(event or {}).get('title', '(unknown)')}",
            f"Author: {existing.get('author', '(unknown)')}",
            f"Text: {existing.get('text', '')}",
        ]),
    )
    return {"ok": True}


@api.delete("/schedule/{session_id}/notes/{note_id}/permanent")
async def permanently_delete_event_note(session_id: str, note_id: str, admin=Depends(get_current_admin)):
    existing = await event_notes_col.find_one({"id": note_id, "event_id": session_id, "deleted": True}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")

    res = await event_notes_col.delete_one({"id": note_id, "event_id": session_id, "deleted": True})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    event = await schedule_col.find_one({"id": session_id}, {"_id": 0, "title": 1})
    await send_admin_audit_email(
        "[SETP admin] Session note permanently deleted",
        build_admin_audit_body("permanent delete", "session note", admin, [
            f"Note ID: {note_id}",
            f"Event ID: {session_id}",
            f"Event title: {(event or {}).get('title', '(unknown)')}",
            f"Author: {existing.get('author', '(unknown)')}",
            f"Text: {existing.get('text', '')}",
        ]),
    )
    return {"deleted": True}


# ---------- Merged Feed (announcements + event notes) ----------
@api.get("/feed", response_model=List[FeedItem])
async def merged_feed():
    msgs = await messages_col.find({"deleted": {"$ne": True}}, {"_id": 0}).to_list(500)
    notes = await event_notes_col.find({"deleted": {"$ne": True}}, {"_id": 0}).to_list(500)

    return await build_feed_items(msgs, notes)


async def build_feed_items(msgs: List[dict], notes: List[dict]) -> List[dict]:
    msgs = [dict(m) for m in msgs]
    notes = [dict(n) for n in notes]

    event_ids = list({n["event_id"] for n in notes})
    titles: dict = {}
    if event_ids:
        async for doc in schedule_col.find(
            {"id": {"$in": event_ids}}, {"_id": 0, "id": 1, "title": 1}
        ):
            titles[doc["id"]] = doc["title"]

    items: List[dict] = []
    for m in msgs:
        items.append({
            "kind": "announcement",
            "id": m["id"],
            "text": m["text"],
            "title": m.get("title", ""),
            "priority": m.get("priority", "info"),
            "author": m["author"],
            "created_at": m["created_at"],
            "event_id": None,
            "event_title": None,
            "deleted": bool(m.get("deleted")),
            "deleted_at": m.get("deleted_at"),
            "deleted_by": m.get("deleted_by"),
        })
    for n in notes:
        items.append({
            "kind": "event_note",
            "id": n["id"],
            "text": n["text"],
            "title": "",
            "priority": None,
            "author": n["author"],
            "created_at": n["created_at"],
            "event_id": n.get("event_id"),
            "event_title": titles.get(n.get("event_id")),
            "deleted": bool(n.get("deleted")),
            "deleted_at": n.get("deleted_at"),
            "deleted_by": n.get("deleted_by"),
        })
    items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return items


@api.get("/feed/deleted", response_model=List[FeedItem])
async def deleted_feed(admin=Depends(get_current_admin)):
    msgs = await messages_col.find({"deleted": True}, {"_id": 0}).to_list(500)
    notes = await event_notes_col.find({"deleted": True}, {"_id": 0}).to_list(500)

    items = await build_feed_items(msgs, notes)
    items.sort(key=lambda x: x.get("deleted_at") or x.get("created_at", ""), reverse=True)
    return items


# ---------- Contact Admin ----------
@api.post("/contact")
async def create_contact(data: ContactCreate):
    name = data.name.strip()
    subject = data.subject.strip()
    message = data.message.strip()
    organisation = (data.organisation or "").strip()
    phone = (data.phone or "").strip()
    if not name or not subject or not message:
        raise HTTPException(status_code=400, detail="name, subject and message are required")

    event_id = (data.event_id or "").strip() or None
    if event_id:
        # validate that event exists; if not, drop the attachment rather than 400
        ev = await schedule_col.find_one({"id": event_id}, {"_id": 0, "id": 1})
        if not ev:
            event_id = None

    sender_email = str(data.email) if data.email else ""
    created_at = datetime.now(timezone.utc).isoformat()
    thread_id = (data.thread_id or "").strip() or None
    delegate_message = build_contact_thread_message(
        "delegate", name, sender_email, subject, message, created_at
    )

    if thread_id:
        existing = await contact_col.find_one({"id": thread_id, "deleted": {"$ne": True}}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Thread not found")
        existing = normalize_contact_thread(existing)
        update_doc = {
            "messages": existing["messages"] + [delegate_message],
            "updated_at": created_at,
            "read": False,
        }
        if sender_email:
            update_doc["email"] = sender_email
        if organisation:
            update_doc["organisation"] = organisation
        if phone:
            update_doc["phone"] = phone
        if event_id is not None:
            update_doc["event_id"] = event_id
        await contact_col.update_one({"id": thread_id}, {"$set": update_doc})
        email_item = {
            **existing,
            "email": sender_email or existing.get("email", ""),
            "organisation": organisation or existing.get("organisation", ""),
            "phone": phone or existing.get("phone", ""),
            "subject": subject,
            "message": message,
            "created_at": created_at,
            "event_id": event_id if event_id is not None else existing.get("event_id"),
        }
        await send_contact_email(email_item)
        return {"id": thread_id, "ok": True}

    item = {
        "id": str(uuid.uuid4()),
        "name": name,
        "email": sender_email,
        "organisation": organisation,
        "phone": phone,
        "subject": subject,
        "message": message,
        "created_at": created_at,
        "updated_at": created_at,
        "read": False,
        "event_id": event_id,
        "messages": [delegate_message],
        "deleted": False,
        "deleted_at": None,
        "deleted_by": None,
    }
    await contact_col.insert_one(item)
    await send_contact_email(item)
    return {"id": item["id"], "ok": True}


async def send_contact_email(item: dict):
    if not RESEND_API_KEY:
        logging.warning("RESEND_API_KEY is not configured; skipping contact email send.")
        return

    subject = f"[SETP contact] {item['subject']}"
    event_text = item.get("event_id") or "None"
    reply_to = [item["email"]] if item.get("email") else []
    sender_email = item.get("email") or "(not provided)"
    organisation = item.get("organisation") or "(not provided)"
    phone = item.get("phone") or "(not provided)"
    payload = {
        "from": RESEND_FROM_EMAIL,
        "to": [RESEND_CONTACT_RECIPIENT],
        "subject": subject,
    }
    if reply_to:
        payload["reply_to"] = reply_to
    if RESEND_CONTACT_TEMPLATE_ID:
        payload["template"] = {
            "id": RESEND_CONTACT_TEMPLATE_ID,
            "variables": {
                "name": item["name"],
                "email": sender_email,
                "organisation": organisation,
                "phone": phone,
                "message": item["message"],
                "subject": item["subject"],
                "eventId": event_text,
                "createdAt": item["created_at"],
            },
        }
    else:
        payload["text"] = (
            f"Name: {item['name']}\n"
            f"Email: {sender_email}\n"
            f"Organisation: {organisation}\n"
            f"Phone: {phone}\n"
            f"Event ID: {event_text}\n"
            f"Received: {item['created_at']}\n\n"
            f"Message:\n{item['message']}"
        )

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                RESEND_API_URL,
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=15,
            )
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        details = exc.response.text if exc.response is not None else str(exc)
        logging.error("Resend rejected contact email payload: %s", details)
    except Exception as exc:
        logging.error("Failed to send contact notification email via Resend: %s", exc)


async def send_admin_audit_email(subject: str, body: str):
    if not RESEND_API_KEY:
        logging.warning("RESEND_API_KEY is not configured; skipping admin audit email send.")
        return

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                RESEND_API_URL,
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": RESEND_FROM_EMAIL,
                    "to": [RESEND_CONTACT_RECIPIENT],
                    "subject": subject,
                    "text": body,
                },
                timeout=15,
            )
            response.raise_for_status()
    except Exception as exc:
        logging.error("Failed to send admin audit email via Resend: %s", exc)


def build_admin_audit_body(action: str, item_type: str, admin: dict, details: List[str]) -> str:
    admin_name = admin_display_name(admin)
    timestamp = datetime.now(timezone.utc).isoformat()
    return "\n".join([
        f"Action: {action}",
        f"Item type: {item_type}",
        f"Performed by: {admin_name}",
        f"Timestamp: {timestamp}",
        "",
        "Details:",
        *details,
    ])


async def send_contact_reply_email(item: dict, subject: str, message: str, admin_name: str):
    if not RESEND_API_KEY:
        raise HTTPException(status_code=503, detail="Email delivery is not configured")

    if not item.get("email"):
        raise HTTPException(status_code=400, detail="This contact did not provide an email address")

    clean_subject = (subject or "").strip()
    if clean_subject:
        if clean_subject.lower().startswith("thank you for your enquiry"):
            base_subject = clean_subject
        else:
            base_subject = f"Thank you for your Enquiry - {clean_subject}"
    else:
        base_subject = "Thank you for your Enquiry"

    outbound_subject = f"{base_subject}{RESEND_REPLY_DEBUG_SUBJECT_SUFFIX}" if RESEND_REPLY_DEBUG_SUBJECT_SUFFIX else base_subject

    payload = {
        "from": RESEND_FROM_EMAIL,
        "to": [item["email"]],
        "reply_to": [RESEND_CONTACT_RECIPIENT],
        "subject": outbound_subject,
        "template": {
            "id": RESEND_CONTACT_REPLY_TEMPLATE_ID,
            "variables": {
                "replyHtml": html.escape(message).replace("\n", "<br/>") if message else "",
                # Include common key aliases so existing template placeholders resolve
                # without requiring immediate template edits.
                "reply": message,
                "replyText": message,
                "reply_text": message,
                "replyMessage": message,
                "reply_message": message,
                "message": message,
                "body": message,
                "content": message,
                "adminReply": message,
                "admin_message": message,
                "adminName": admin_name,
                "signatureName": admin_name,
                "signatureLine": f"Committee Admin - {admin_name}" if admin_name else "Committee Admin",
                "senderName": admin_name,
                "delegateName": item.get("name") or "Delegate",
                "delegateEmail": item.get("email") or "",
                "originalSubject": item.get("subject") or "",
                "subject": outbound_subject,
                "subjectLine": outbound_subject,
                "replySubject": outbound_subject,
                "emailSubject": outbound_subject,
                "originalMessage": item.get("message") or "",
                "originalCreatedAt": item.get("created_at") or "",
            },
        },
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                RESEND_API_URL,
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=15,
            )
            response.raise_for_status()
    except HTTPException:
        raise
    except Exception as exc:
        logging.error("Failed to send admin reply email via Resend: %s", exc)
        raise HTTPException(status_code=502, detail="Failed to send email")


async def hydrate_contact_threads(docs: List[dict]) -> List[dict]:
    docs = [normalize_contact_thread(d) for d in docs]
    docs.sort(key=lambda d: d.get("updated_at", d.get("created_at", "")), reverse=True)

    event_ids = [d["event_id"] for d in docs if d.get("event_id")]
    titles: dict = {}
    if event_ids:
        async for ev in schedule_col.find(
            {"id": {"$in": list(set(event_ids))}}, {"_id": 0, "id": 1, "title": 1}
        ):
            titles[ev["id"]] = ev["title"]
    for d in docs:
        d["event_title"] = titles.get(d.get("event_id")) if d.get("event_id") else None
    return docs


@api.get("/contact", response_model=List[ContactItem])
async def list_contact(admin=Depends(get_current_admin)):
    docs = await contact_col.find({"deleted": {"$ne": True}}, {"_id": 0}).to_list(500)
    return await hydrate_contact_threads(docs)


@api.get("/contact/deleted", response_model=List[ContactItem])
async def list_deleted_contact(admin=Depends(get_current_admin)):
    docs = await contact_col.find({"deleted": True}, {"_id": 0}).to_list(500)
    return await hydrate_contact_threads(docs)


@api.patch("/contact/{cid}/read")
async def mark_contact_read(cid: str, admin=Depends(get_current_admin)):
    res = await contact_col.update_one({"id": cid, "deleted": {"$ne": True}}, {"$set": {"read": True}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@api.post("/contact/{cid}/reply")
async def reply_contact(cid: str, data: ContactReplyCreate, admin=Depends(get_current_admin)):
    item = await contact_col.find_one({"id": cid, "deleted": {"$ne": True}}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Not found")

    message = data.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")

    item = normalize_contact_thread(item)
    subject = (data.subject or "").strip() or f"Re: {item['subject']}"
    created_at = datetime.now(timezone.utc).isoformat()
    admin_name = admin_display_name(admin)
    reply_message = build_contact_thread_message(
        "admin",
        admin_name,
        RESEND_CONTACT_RECIPIENT,
        subject,
        message,
        created_at,
    )
    await send_contact_reply_email(item, subject, message, admin_name)
    await contact_col.update_one(
        {"id": cid},
        {
            "$set": {
                "messages": item["messages"] + [reply_message],
                "updated_at": created_at,
                "read": True,
            },
        },
    )
    return {"ok": True, "message": reply_message}


@api.delete("/contact/{cid}")
async def delete_contact(cid: str, admin=Depends(get_current_admin)):
    existing = await contact_col.find_one({"id": cid, "deleted": {"$ne": True}}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")

    deleted_at = datetime.now(timezone.utc).isoformat()
    deleted_by = admin.get("username") or admin.get("name") or "admin"
    res = await contact_col.update_one(
        {"id": cid, "deleted": {"$ne": True}},
        {"$set": {"deleted": True, "deleted_at": deleted_at, "deleted_by": deleted_by, "updated_at": deleted_at, "read": True}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await send_admin_audit_email(
        "[SETP admin] Contact thread archived",
        build_admin_audit_body("archive", "contact thread", admin, [
            f"Thread ID: {cid}",
            f"Name: {existing.get('name', '(unknown)')}",
            f"Email: {existing.get('email') or '(not provided)'}",
            f"Subject: {existing.get('subject', '')}",
            f"Message: {existing.get('message', '')}",
        ]),
    )
    return {"deleted": True}


@api.post("/contact/{cid}/restore")
async def restore_contact(cid: str, admin=Depends(get_current_admin)):
    existing = await contact_col.find_one({"id": cid, "deleted": True}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")

    restored_at = datetime.now(timezone.utc).isoformat()
    res = await contact_col.update_one(
        {"id": cid, "deleted": True},
        {"$set": {"deleted": False, "deleted_at": None, "deleted_by": None, "updated_at": restored_at, "read": True}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await send_admin_audit_email(
        "[SETP admin] Contact thread restored",
        build_admin_audit_body("restore", "contact thread", admin, [
            f"Thread ID: {cid}",
            f"Name: {existing.get('name', '(unknown)')}",
            f"Email: {existing.get('email') or '(not provided)'}",
            f"Subject: {existing.get('subject', '')}",
        ]),
    )
    return {"ok": True}


@api.delete("/contact/{cid}/permanent")
async def permanently_delete_contact(cid: str, admin=Depends(get_current_admin)):
    existing = await contact_col.find_one({"id": cid, "deleted": True}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")

    res = await contact_col.delete_one({"id": cid, "deleted": True})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await send_admin_audit_email(
        "[SETP admin] Contact thread permanently deleted",
        build_admin_audit_body("permanent delete", "contact thread", admin, [
            f"Thread ID: {cid}",
            f"Name: {existing.get('name', '(unknown)')}",
            f"Email: {existing.get('email') or '(not provided)'}",
            f"Subject: {existing.get('subject', '')}",
        ]),
    )
    return {"deleted": True}


async def hydrate_question_items(docs: List[dict]) -> List[dict]:
    docs = [normalize_question_record(d) for d in docs]
    docs.sort(key=lambda d: d.get("updated_at", d.get("created_at", "")), reverse=True)

    event_ids = [d["event_id"] for d in docs if d.get("event_id")]
    titles: dict = {}
    if event_ids:
        async for ev in schedule_col.find(
            {"id": {"$in": list(set(event_ids))}}, {"_id": 0, "id": 1, "title": 1}
        ):
            titles[ev["id"]] = ev["title"]
    for d in docs:
        d["event_title"] = titles.get(d.get("event_id")) if d.get("event_id") else None
    return docs


@api.post("/questions")
async def create_question(data: QuestionCreate):
    name = data.name.strip()
    question_text = data.question.strip()
    if not name or not question_text:
        raise HTTPException(status_code=400, detail="name and question are required")

    event_id = (data.event_id or "").strip() or None
    if event_id:
        ev = await schedule_col.find_one({"id": event_id}, {"_id": 0, "id": 1})
        if not ev:
            event_id = None

    created_at = datetime.now(timezone.utc).isoformat()
    item = {
        "id": str(uuid.uuid4()),
        "name": name,
        "email": str(data.email) if data.email else "",
        "question": question_text,
        "created_at": created_at,
        "updated_at": created_at,
        "reviewed": False,
        "reviewed_at": None,
        "reviewed_by": None,
        "event_id": event_id,
    }
    await questions_col.insert_one(item)
    await send_question_email(item)
    return {"id": item["id"], "ok": True}


async def send_question_email(item: dict):
    if not RESEND_API_KEY:
        logging.warning("RESEND_API_KEY is not configured; skipping question email send.")
        return

    payload = {
        "from": RESEND_FROM_EMAIL,
        "to": [RESEND_CONTACT_RECIPIENT],
        "subject": f"[SETP ask the speaker] {item.get('event_title') or item.get('event_id') or 'General'}",
        "text": (
            f"Name: {item.get('name', '(unknown)')}\n"
            f"Email: {item.get('email') or '(not provided)'}\n"
            f"Event ID: {item.get('event_id') or '(not provided)'}\n"
            f"Received: {item.get('created_at')}\n\n"
            f"Question:\n{item.get('question', '')}"
        ),
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                RESEND_API_URL,
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=15,
            )
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        details = exc.response.text if exc.response is not None else str(exc)
        logging.error("Resend rejected question email payload: %s", details)
    except Exception as exc:
        logging.error("Failed to send question notification email via Resend: %s", exc)


@api.get("/questions", response_model=List[QuestionItem])
async def list_questions(admin=Depends(get_current_admin)):
    docs = await questions_col.find({"deleted": {"$ne": True}}, {"_id": 0}).to_list(500)
    return await hydrate_question_items(docs)


@api.get("/questions/deleted", response_model=List[QuestionItem])
async def list_deleted_questions(admin=Depends(get_current_admin)):
    docs = await questions_col.find({"deleted": True}, {"_id": 0}).to_list(500)
    return await hydrate_question_items(docs)


@api.patch("/questions/{qid}/review")
async def mark_question_reviewed(qid: str, admin=Depends(get_current_admin)):
    existing = await questions_col.find_one({"id": qid, "deleted": {"$ne": True}}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")

    reviewed_at = datetime.now(timezone.utc).isoformat()
    reviewed_by = admin_display_name(admin)
    res = await questions_col.update_one(
        {"id": qid, "deleted": {"$ne": True}},
        {"$set": {"reviewed": True, "reviewed_at": reviewed_at, "reviewed_by": reviewed_by, "updated_at": reviewed_at}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@api.delete("/questions/{qid}")
async def delete_question(qid: str, admin=Depends(get_current_admin)):
    existing = await questions_col.find_one({"id": qid, "deleted": {"$ne": True}}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")

    deleted_at = datetime.now(timezone.utc).isoformat()
    deleted_by = admin.get("username") or admin.get("name") or "admin"
    res = await questions_col.update_one(
        {"id": qid, "deleted": {"$ne": True}},
        {"$set": {"deleted": True, "deleted_at": deleted_at, "deleted_by": deleted_by, "updated_at": deleted_at, "reviewed": True, "reviewed_at": existing.get("reviewed_at") or deleted_at, "reviewed_by": existing.get("reviewed_by") or deleted_by}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"deleted": True}


@api.post("/questions/{qid}/restore")
async def restore_question(qid: str, admin=Depends(get_current_admin)):
    existing = await questions_col.find_one({"id": qid, "deleted": True}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")

    restored_at = datetime.now(timezone.utc).isoformat()
    res = await questions_col.update_one(
        {"id": qid, "deleted": True},
        {"$set": {"deleted": False, "deleted_at": None, "deleted_by": None, "updated_at": restored_at}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@api.delete("/questions/{qid}/permanent")
async def permanently_delete_question(qid: str, admin=Depends(get_current_admin)):
    existing = await questions_col.find_one({"id": qid, "deleted": True}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")

    res = await questions_col.delete_one({"id": qid, "deleted": True})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"deleted": True}


# ---------- Live Messages ----------
@api.get("/messages", response_model=List[MessageItem])
async def list_messages():
    docs = await messages_col.find({"deleted": {"$ne": True}}, {"_id": 0}).to_list(1000)
    docs.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    return docs


@api.post("/messages", response_model=MessageItem)
async def create_message(data: MessageCreate, admin=Depends(get_current_admin)):
    item = MessageItem(
        text=data.text,
        title=data.title or "",
        priority=data.priority,
        author=admin_display_name(admin),
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    await messages_col.insert_one(item.dict())
    return item


@api.delete("/messages/{message_id}")
async def delete_message(message_id: str, admin=Depends(get_current_admin)):
    existing = await messages_col.find_one({"id": message_id, "deleted": {"$ne": True}}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")

    deleted_at = datetime.now(timezone.utc).isoformat()
    deleted_by = admin.get("username") or admin.get("name") or "admin"
    res = await messages_col.update_one(
        {"id": message_id, "deleted": {"$ne": True}},
        {"$set": {"deleted": True, "deleted_at": deleted_at, "deleted_by": deleted_by}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await send_admin_audit_email(
        "[SETP admin] Announcement archived",
        build_admin_audit_body("archive", "announcement", admin, [
            f"Message ID: {message_id}",
            f"Title: {existing.get('title', '')}",
            f"Priority: {existing.get('priority', 'info')}",
            f"Author: {existing.get('author', '(unknown)')}",
            f"Text: {existing.get('text', '')}",
        ]),
    )
    return {"deleted": True}


@api.post("/messages/{message_id}/restore")
async def restore_message(message_id: str, admin=Depends(get_current_admin)):
    existing = await messages_col.find_one({"id": message_id, "deleted": True}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")

    res = await messages_col.update_one(
        {"id": message_id, "deleted": True},
        {"$set": {"deleted": False, "deleted_at": None, "deleted_by": None}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await send_admin_audit_email(
        "[SETP admin] Announcement restored",
        build_admin_audit_body("restore", "announcement", admin, [
            f"Message ID: {message_id}",
            f"Title: {existing.get('title', '')}",
            f"Priority: {existing.get('priority', 'info')}",
            f"Author: {existing.get('author', '(unknown)')}",
            f"Text: {existing.get('text', '')}",
        ]),
    )
    return {"ok": True}


@api.delete("/messages/{message_id}/permanent")
async def permanently_delete_message(message_id: str, admin=Depends(get_current_admin)):
    existing = await messages_col.find_one({"id": message_id, "deleted": True}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")

    res = await messages_col.delete_one({"id": message_id, "deleted": True})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await send_admin_audit_email(
        "[SETP admin] Announcement permanently deleted",
        build_admin_audit_body("permanent delete", "announcement", admin, [
            f"Message ID: {message_id}",
            f"Title: {existing.get('title', '')}",
            f"Priority: {existing.get('priority', 'info')}",
            f"Author: {existing.get('author', '(unknown)')}",
            f"Text: {existing.get('text', '')}",
        ]),
    )
    return {"deleted": True}


# ---------- Prototype Lab (draft -> publish) ----------
@api.get("/prototype-ideas", response_model=List[PrototypeIdea])
async def list_published_prototype_ideas():
    docs = await prototype_ideas_col.find({"status": "published"}, {"_id": 0}).to_list(500)
    docs.sort(key=lambda d: d.get("published_at", ""), reverse=True)
    return docs


@api.get("/admin/prototype-ideas", response_model=List[PrototypeIdea])
async def list_admin_prototype_ideas(admin=Depends(get_current_admin)):
    docs = await prototype_ideas_col.find({}, {"_id": 0}).to_list(500)
    docs.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    return docs


@api.post("/admin/prototype-ideas", response_model=PrototypeIdea)
async def create_prototype_idea(data: PrototypeIdeaCreate, admin=Depends(get_current_admin)):
    title = data.title.strip()
    summary = data.summary.strip()
    if not title or not summary:
        raise HTTPException(status_code=400, detail="title and summary are required")

    item = PrototypeIdea(
        title=title,
        summary=summary,
        proposed_screen=(data.proposed_screen or "").strip(),
        mock_link=(data.mock_link or "").strip(),
        status="draft",
        created_by=admin_display_name(admin),
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    await prototype_ideas_col.insert_one(item.dict())
    return item


@api.patch("/admin/prototype-ideas/{idea_id}/publish", response_model=PrototypeIdea)
async def publish_prototype_idea(idea_id: str, admin=Depends(get_current_admin)):
    existing = await prototype_ideas_col.find_one({"id": idea_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")

    now = datetime.now(timezone.utc).isoformat()
    await prototype_ideas_col.update_one(
        {"id": idea_id},
        {"$set": {
            "status": "published",
            "published_at": now,
            "published_by": admin_display_name(admin),
        }},
    )
    updated = await prototype_ideas_col.find_one({"id": idea_id}, {"_id": 0})
    return updated


@api.delete("/admin/prototype-ideas/{idea_id}")
async def delete_prototype_idea(idea_id: str, admin=Depends(get_current_admin)):
    res = await prototype_ideas_col.delete_one({"id": idea_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"deleted": True}


# ---------- City Guide (static, embedded) ----------
@api.get("/city-guide")
async def city_guide():
    return {
        "hero": {
            "title": "Welcome to Edinburgh",
            "subtitle": "Symposium quick guide",
        },
        "essentials": [
            {"icon": "currency-pound", "title": "Currency",
             "summary": "British Pound (GBP / £). $1 USD ≈ £0.79. Cards widely accepted; carry £20 for taxis & tips."},
            {"icon": "plug", "title": "Plugs & Power",
             "summary": "UK Type G 3-pin plugs, 230V/50Hz. Bring a US→UK adapter; most laptops are dual-voltage."},
            {"icon": "tip", "title": "Tipping",
             "summary": "Restaurants: 10–12.5% if not on bill. Taxis: round up. Bartenders: not expected, but appreciated."},
            {"icon": "phone", "title": "Emergencies",
             "summary": "Dial 999 or 112 for police, fire, ambulance. Non-emergency police: 101."},
        ],
        "transport": [
            {"name": "Edinburgh Trams", "icon": "tram",
             "description": "Single line from Airport → York Place (city centre). Single ticket £1.80. Buy at platform machines or contactless tap (cap £4.80/day).",
             "tip": "Tram from Edinburgh Airport to https://maps.app.goo.gl/S8MciQDKqXvE6yHQ6 (Edinburgh Park) is fastest — ~10 min.",
             "url": "https://edinburghtrams.com"},
            {"name": "Lothian Buses", "icon": "bus",
             "description": "Extensive network. Single £1.80 (contactless capped at £4.80/day). Exact change cash. Download the 'Lothian Buses' app for live times.",
             "tip": "Bus 22 connects city centre to Ocean Terminal (Royal Yacht Britannia).",
             "url": "https://www.lothianbuses.com"},
            {"name": "Taxis & Black Cabs", "icon": "car",
             "description": "Black cabs are metered & hailable. Airport → city centre ≈ £25–30.",
             "tip": "Pre-book via City Cabs (+44 131 228 1211) or Central Taxis (+44 131 229 2468)."},
            {"name": "Uber & Bolt", "icon": "rideshare",
             "description": "Both operate in Edinburgh. Often cheaper than black cabs for short trips.",
             "tip": "Wait times at the airport can be 5–10 min — confirm pickup point."},
            {"name": "Walking", "icon": "walk",
             "description": "Central Edinburgh is compact. https://maps.app.goo.gl/S8MciQDKqXvE6yHQ6 → Royal Mile ≈ 25 min walk or 10 min taxi.",
             "tip": "Cobblestones! Wear comfortable shoes — the Royal Mile is steep in places."},
            {"name": "ScotRail", "icon": "train",
             "description": "Trains from Waverley & Haymarket stations to Glasgow, St Andrews, Highlands.",
             "tip": "Book in advance for best fares.",
             "url": "https://www.scotrail.co.uk"},
        ],
        "phrases": [
            {"phrase": "Cheers", "meaning": "Thanks / goodbye / toast — used constantly"},
            {"phrase": "Wee", "meaning": "Small (a wee dram = a small whisky)"},
            {"phrase": "Ta", "meaning": "Thanks (informal)"},
            {"phrase": "Loo", "meaning": "Restroom / bathroom"},
            {"phrase": "Brilliant", "meaning": "Great / awesome"},
            {"phrase": "Aye", "meaning": "Yes"},
            {"phrase": "Pavement", "meaning": "Sidewalk"},
            {"phrase": "Lift", "meaning": "Elevator"},
        ],
        "venues": [
            {"name": "Courtyard by Marriott Edinburgh", "address": "1 – 3 Baxter's Pl, Edinburgh EH1 3AF",
             "notes": "Symposium HQ. Close to Haymarket station and tram stop.",
             "maps_url": COURTYARD_MARRIOTT_MAPS_URL},
            {"name": "Apex Grassmarket Hotel", "address": "31-35 Grassmarket, Edinburgh EH1 2HS",
             "notes": "City-centre hotel beneath Edinburgh Castle on the historic Grassmarket. 5 min walk to the Royal Mile, 10 min to The Royal College of Physicians of Edinburgh.",
             "maps_url": "https://www.google.com/maps/search/Apex+Grassmarket+Hotel+Edinburgh"},
            {"name": "St Paul's & St George's Church (Ps&Gs)", "address": "10 York Pl, Edinburgh EH1 3EP",
             "notes": "Mon & Tue technical sessions. City centre — tram to 'York Place'.",
             "maps_url": PSGS_MAPS_URL},
            {"name": "Royal Yacht Britannia", "address": "Ocean Terminal, Leith, Edinburgh EH6 6JJ",
             "notes": "Tue evening reception. Transport provided from https://maps.app.goo.gl/S8MciQDKqXvE6yHQ6.",
             "maps_url": "https://www.google.com/maps/search/Royal+Yacht+Britannia"},
            {"name": "The Royal College of Physicians of Edinburgh", "address": "9 Queen Street, Edinburgh EH2 1JQ",
             "notes": "Wed sessions & closing banquet. 10-min walk from Royal Mile.",
             "maps_url": RCPE_MAPS_URL},
            {"name": "Forth Boat Tours", "address": "Hawes Pier, South Queensferry EH30 9SQ",
             "notes": "Thu technical boat tour departure point in South Queensferry.",
             "maps_url": "https://www.google.com/maps/place/Forth+Boat+Tours/@55.992642,-3.4070465,751m/data=!3m2!1e3!4b1!4m6!3m5!1s0x4887a7ddba653f21:0x5582e10adf18277f!8m2!3d55.992642!4d-3.4070465!16s%2Fg%2F1tk62prr?authuser=0&hl=en&entry=ttu&g_ep=EgoyMDI2MDYyNC4wIKXMDSoASAFQAw%3D%3D"},
        ],
    }


app.include_router(api)

# ---------- CORS ----------
# Explicitly allow the production/branch Vercel domains, plus any extra origins
# provided via the FRONTEND_URL env var (comma-separated), plus a regex that
# matches all *.vercel.app preview deployments for this project.
_default_origins = [
    "https://telboy-setp-git-main-setp.vercel.app",
    "https://telboy-setp.vercel.app",
    "http://localhost:3000",
    "http://localhost:8081",
]
_env_origins = [
    o.strip()
    for o in os.environ.get("FRONTEND_URL", "").split(",")
    if o.strip()
]
allowed_origins = list(dict.fromkeys(_env_origins + _default_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
