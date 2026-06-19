# EDI SETP 2026 — Glide Import Pack

These CSV files contain your app's content, ready to import into **Glide Tables**
so you can rebuild the app natively in Glide (glideapps.com).

## Files
| File | What it is | Suggested Glide screen |
|------|-----------|------------------------|
| `schedule.csv` (36 rows) | Full symposium agenda (Sun 26 – Thu 30 July) | Collection / Calendar |
| `messages.csv` | Live announcements feed | List / Feed |
| `city_hero.csv` | City guide header text | (text on a tab) |
| `city_essentials.csv` (4) | Currency, plugs, tipping, emergencies | Cards / List |
| `city_transport.csv` (6) | Trams, buses, taxis, etc. with tips + URLs | List with link buttons |
| `city_phrasebook.csv` (8) | Scottish phrases + meanings | Simple list |
| `city_venues.csv` (5) | Venues with addresses + Apple Maps URLs | List with map links |

## How to import into Glide
1. Go to https://www.glideapps.com and create a **New App**.
2. Choose **Glide Tables** as the data source (or import a Google Sheet — see below).
3. For each table: **Data editor → + (add table) → Import CSV** → upload the file.
   - Glide auto-detects columns from the header row.
4. Build screens:
   - **Schedule:** add a *Collection*; group by `day_label`; sort by `date` then `time`;
     show `title`, `time`–`end_time`, `location`, `description`; use `category` for an
     icon/badge.
   - **Messages:** *List* sorted by `created_at` (newest first); style `priority`.
   - **City Guide:** a tab with sections for Essentials / Transport / Phrasebook /
     Venues. For Transport use the `url` column as a "Open link" action; for Venues
     use `maps_url` as an "Open map" action.
5. (Optional) Recreate admin posting with Glide's user roles + an editable
   Messages table (Glide handles auth/roles natively — no need to port the JWT code).

## Prefer Google Sheets instead of direct CSV?
- Create a Google Sheet, then **File → Import → Upload** each CSV into its own tab.
- In Glide, choose **Google Sheets** as the data source and connect that sheet.
- Benefit: edit content in Sheets and Glide updates automatically.

## Notes
- The `id` columns are the original database IDs — harmless to keep; Glide adds its
  own Row IDs. You can hide `id` in the UI.
- Special characters (£, –, →, é) are UTF-8 encoded; Glide imports them fine.
- This is your *content*. The Glide app's look & navigation are rebuilt visually in
  Glide's editor (it won't match the original custom design 1:1).
