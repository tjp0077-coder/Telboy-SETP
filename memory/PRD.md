# Test Pilot Symposium Edinburgh 2026 — PRD

## Vision
A mobile companion for delegates attending the SETP Test Pilot Symposium in Edinburgh (25–30 July 2026), with a special focus on helping American delegates navigate the city (trams, transport, currency, etiquette) alongside the symposium agenda.

## Personas
- **Delegate (default)** — open access. Browses schedule, saves sessions, reads live announcements, consults city guide.
- **Admin (3 seeded)** — Chairman Dave Mackay, SETP President Kelly Latimer, SETP backup. JWT login. Can post live announcements.

## Core Features
1. **Schedule** — 25–30 July sessions seeded from organiser's CSV (registration, technical sessions, Royal Yacht reception, banquet, boat tour). Day chip selector, category icons, save-to-agenda bookmarks (offline AsyncStorage).
2. **Live Messages** — Public read-only feed. Admins post info / important / urgent announcements via FAB → bottom-sheet composer.
3. **Edinburgh City Guide** — Hero, essentials (currency, plugs, tipping, emergencies), transport (trams, buses, taxis, Uber, walking, rail) with American-specific tips, Scottish phrasebook, venues with deep-link map buttons.
4. **Profile / Agenda** — Saved sessions list, admin sign-in entry, sign-out.

## Tech
- **Backend**: FastAPI + Motor MongoDB + bcrypt + python-jose JWT. Admins, schedule and welcome message auto-seeded on startup.
- **Frontend**: Expo Router (4 bottom tabs + modal login), AsyncStorage cache for offline schedule/messages/city-guide, expo-secure-store for admin token, expo-image / expo-linear-gradient.
- **Design**: Aviation Navy `#1A2841` + Tartan Ochre `#AD4C3B`, Georgia display serif, generous spacing, no AI-slop purple gradients.

## Smart Business Enhancement
**Personal agenda export** (future): the saved-sessions list in Profile is the foundation for a calendar-sync / .ics export, increasing per-delegate engagement and acting as a sponsor showcase placement opportunity adjacent to the Royal Yacht Britannia reception card.

## Out of scope (v1)
- Push notifications (requires deployed build — flagged for v1.1)
- Per-delegate profiles / public chat
- Sponsor pages
