# Family Hub — Session Handoff

Snapshot of what we did this session, current state of the code, and open items. Paste this into a new session as context.

## Project shape (things the next session needs to know)

- React + Vite frontend under `src/`, deployed pages under `src/pages/`.
- Three separate Google Apps Script backends, one per user/scope, URLs in `src/api/scripts.js`:
  - **CHORES** = Family Hub *shared* script (Parentals + At A Glance + family calendar reads). Sheet ID `1G00GtbuEKDFUc7uD5qbiotTjSnFQ_7KUsVJR7ZkjkLk`.
  - **TORI** = Tori's personal script. Sheet ID `1VEVs4691nyzGM727GCT3vL8H8bzVxEszc980cy2So-A`.
  - **NOVA** = Nova's personal script.
- All three scripts follow the same doGet(type=…) / doPost(action=…, type=…, …) shape and return JSON.
- Family calendar reads now come from **Calendar Advanced Service** (`Calendar.Events.list` with `singleEvents:true`), not ICS. Recurring events expand server-side.
- **Script deploying account:** `projectstorageacct@gmail.com`. Anything the script needs to read (calendars, sheets, drive folders) must be shared with this account, not `jlynn198@gmail.com`. Manifest `executeAs` is `USER_DEPLOYING`.
- Manifest declares `oauthScopes` explicitly, so any new scope needs to be added manually to `appsscript.json` — Apps Script won't auto-request.

Nav tabs (front-end names): Home, Unwind, Tori, Nova, At a Glance.

## What we changed this session

### 1. Tori → Reminders tile: adds weren't persisting
**Root cause:** Tori GAS `doGet` for `type=reminders` does `.slice(1)` to skip a header row, but the Reminders tab on the Tori sheet had no header. `appendRow` wrote the first reminder to A1/B1, then the next GET stripped it back off. Data was in the sheet; just filtered out on read.

**Fix applied:** add header row `Text` | `Date` in row 1 of the Tori sheet's Reminders tab. No code change.

Related follow-up we didn't do: `apiFetch` in `src/api/scripts.js` only checks `res.ok` and ignores JSON `{error: '...'}` bodies with HTTP 200 — GAS returns those on failure and they silently look like success. Worth tightening.

### 2. Event location on At A Glance Events tile
**Frontend** (`src/pages/Glance/Glance.jsx`): `CalCell` now passes `location` through to `EventBlock` via a `getLocation` helper. Tori's Events (`SingleCell`) already did.

**Backend** (Shared CHORES script): `parseICSEvents` now extracts `LOCATION` (moved outside the timed/all-day branch so both types get it). The `upcoming` handler now includes `location` in the per-day event object. Deduplication-by-summary was removed since it was silently killing legitimate same-name events.

### 3. Weather icons on Tori's Events
Already wired up — `EventBlock` calls `useWeatherIcon(location, dateStr)` and both `CalCell` and `SingleCell` render through it. NWS forecast API only goes 7 days out, so events further out fall back to the 📍 pin. If you want it to extend further, swap NWS for Open-Meteo forecast (16-day window).

### 4. At A Glance layout restructure
`Glance.css` grid changed to 3 rows × 2 cols:
- Events tile — col 1, rows 1–3
- Bulletin board — col 2, row 1 (smaller than before, 1/3 height)
- Calendar — col 2, rows 2–3 (now 2 weeks instead of 1)

`GlanceAgendaPanel` now generates 14 days in a `7 col × 2 row` grid. Title changed "This Week" → "Next 2 Weeks". Border logic updated: `:nth-child(7n)` strips right border on end-of-week cells, `:nth-child(-n+7)` adds bottom border between week 1 and week 2. Mobile media query resets `grid-template-rows: none` so the vertical list still works.

Open follow-up: bulletin board still has `notes.slice(0, 14)` — at 1/3 height not all fit visually. Reduce to `slice(0, 5)` or similar if it looks clipped.

### 5. Missing events on 5/22 → migrated to Calendar Advanced Service
**Original problem:** modal on At A Glance only showed 3 events on 5/22 when Google Calendar had more. Diagnosed via hitting `/exec?type=upcoming&days=60` directly. Root cause was two issues stacked:

1. Same-summary dedup in `upcoming` was silently dropping legit duplicates. Removed.
2. Recurring events with old `DTSTART` (e.g. Grandma Ruth's Birthday recurring annually) weren't expanded because `parseICSEvents` ignored `RRULE`.

**Fix:** rather than implement RRULE parsing (~80 lines of nasty spec-following code), swapped both `upcoming` and `weekend` handlers to use the Calendar Advanced Service with `singleEvents: true`. Google expands recurring events server-side. `parseICSEvents` and `FAMILY_ICS_URL` are deleted.

### 6. Auth setup for Calendar Advanced Service (long path — worth documenting)
This was the multi-step chain that had to happen after the code swap:

1. **Enable service** — Apps Script editor → Services → + → Google Calendar API → Add. Without this, `Calendar.Events.list` throws `ReferenceError: Calendar is not defined`.
2. **Add scope to manifest** — because `oauthScopes` was declared explicitly in `appsscript.json`, Apps Script doesn't auto-request the calendar scope. Added `https://www.googleapis.com/auth/calendar.readonly` manually.
3. **Trigger consent** — created a throwaway `authorizeCalendar()` function that calls `Calendar.Events.list(CALENDAR_ID, { maxResults: 1 })`, ran it from the editor, accepted the "See events on all your calendars" prompt.
4. **Share the calendar** — the script deploys as `projectstorageacct@gmail.com`. That account didn't have the family calendar shared with it, so `Calendar.Events.list` returned "Not Found". Diagnosed by running `listMyCalendars()` and seeing the family calendar wasn't in the list. Shared it, error resolved.
5. **Redeploy** — every code/manifest change needs Deploy → Manage deployments → pencil → Version: New version → Deploy. Just saving doesn't update what `/exec` serves.

## Current state of the GAS script

The clean, deployable Family Hub shared (CHORES) script lives at `chores_gas_script.gs` in the project root. It has:

- `parseICSEvents` deleted
- `FAMILY_ICS_URL` deleted
- Both `weekend` and `upcoming` on Calendar Advanced Service
- Orphan duplicate code (that was throwing "Illegal return statement" errors) removed
- `CALENDAR_ID` hoisted to a top-level constant

If the deployed version doesn't match this file, replace it and redeploy.

## Manifest state (`appsscript.json`)

```json
{
  "timeZone": "America/Los_Angeles",
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  },
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/calendar.readonly"
  ],
  "dependencies": {
    "enabledAdvancedServices": [
      { "userSymbol": "Calendar", "version": "v3", "serviceId": "calendar" }
    ]
  }
}
```

## Open items / known limitations

- **`apiFetch` doesn't inspect response body** — GAS `{error: '...'}` with HTTP 200 looks like success. Tighten `src/api/scripts.js`.
- **Bulletin board note count** — `notes.slice(0, 14)` at 1/3 height clips. Consider reducing.
- **Agenda day cell density** — at half the previous height, event pills pack tighter. May need per-day event max or smaller font.
- **Weather icons cap at 7 days** — NWS forecast limitation. Open-Meteo has a 16-day window if we want to extend for Tori's events which are typically further out.
- **`weekend` endpoint** — already migrated to Calendar Advanced Service in the clean script. If deployed version was reverted to ICS, recurring events on Sat/Sun will be missing.
- **Nova + Tori personal scripts** — still sheet-only, no calendar reads. Same auth patterns would apply if calendar reads are added later.

## Reference URLs

- Calendar reads test: `https://script.google.com/macros/s/AKfycbxWTpChkrWj-CYqBq4zt-ukj-FpSz2bttXklwHbBwNS0yv7p2hc5eNzQaNbHCF-vCXc/exec?type=upcoming&days=60`
- Family calendar ID: `family12041959028375865807@group.calendar.google.com`
- Shared script deploying account: `projectstorageacct@gmail.com`
