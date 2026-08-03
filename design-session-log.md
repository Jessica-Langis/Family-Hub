# Family Hub — Design Session Log

Running list from our ongoing design brainstorm. "Decided" = agreed and ready to build. "Suggested" = my ideas from the whole-app assessment, not yet confirmed.

## Built — 2026-07-29

All items below are built and verified (clean production build). Two manual steps needed on your end before they go live:
1. In the shared spreadsheet's Chores tab, column H is now `CompletedAt` (auto-filled by the app going forward — no need to backfill existing rows).
2. Paste the updated `chores_gas_script.gs` into the Apps Script editor and redeploy (same manual step as always).

## Built — 2026-08-03

**Backend (`chores_gas_script.gs`)**
- Added Notes (G) and CompletedAt (H) columns to Chores sheet; toggle now stamps/clears CompletedAt with correct timezone offset.
- Root-caused and fixed blank calendar/spreadsheet data: `SS_ID` and `CALENDAR_ID` Script Properties had been silently blanked — restored both, re-added `ALLOWED_EMAILS`.

**New shared components**
- `ChoresList` — replaces 3x duplicated CRUD logic across Unwind/Tori/Nova (root cause of the original notes-save bug).
- `CompletedFeed` — recently-completed chores feed (Tori, Nova).
- `NextUpPanel` — merged manual + calendar-tagged events (Tori, Nova).
- `TwoWeekCalendar` — moved off Glance, now lives on And Stuff.

**Page rebuilds**
- Unwind: wired in `WhereAmIPanel` (built but never rendered) + its missing CSS; added `TwoWeekCalendar`.
- Tori: merged To Do + Reminders into one panel with a Task/Reminder toggle.
- Nova: merged Today + Countdown into `NextUpPanel`; chores via shared `ChoresList`.

**Glance ("At A Glance") — iterated twice**
- v1: 2-zone layout (events hero + compact bulletin strip), no auto-rotation, dropped the 2-week grid.
- v2 (current): 4-tile layout — Hero (next event, countdown headline, urgency-tinted), Upcoming (combined list, sports flagged, kid badges), Lookahead (7-day strip, inline weather), Bulletin; new shared helpers in `homeUtils.js` (`getDayDiff`, `classifyEvent`, `urgencyClass`).
- Bulletin dinner note now color-distinct from regular notes.

**Bug fixes (sanity-check pass)**
- `ChoresList` was refetching on every unrelated re-render (inline array-literal dependency) — fixed.
- `CompletedAt` missing timezone offset — fixed to match session `ExpiresAt` format.
- Holidays were crowding real events out of the ranked events list — fixed to prioritize real events.
- Removed dead CSS (Tori reminder-dot).

**Security**
- Full `git log -p --all` audit confirmed `SS_ID`, `CALENDAR_ID`, family emails, GAS URLs, and ICS token are exposed in public repo history (pre-existing, not from this week) — flagged with confidence levels, no history rewrite performed. See Backlog.

**Research**
- Whole-app usefulness assessment vs. Cozi/FamilyWall/Skylight/OurHome — informed the design decisions above.

## Planned for next session

- Whole-app visual theme update, based on the At a Glance screenshot you shared — apply that look/palette consistently across all pages (currently only loosely shared via CSS tokens). Design details still to be worked out.
- 2026-07-30: after the functional fixes landed, feedback was that the app is "looking pretty sparse" — worth revisiting density/visual weight (not just palette) alongside the theme pass. Candidates: panel backgrounds/borders, spacing, accent color usage, whether the simplified layouts (3-zone Glance, merged panels) read as empty vs. clean.

## Backlog (later, not this session)

- Session "sign out this device" control — right now revoking a session means manually deleting a row in the Sessions sheet.
- 2026-08-03: `SS_ID`, `CALENDAR_ID`, family emails, GAS URLs, and ICS token are exposed in public repo git history (pre-existing, not from this week's changes). Flagged, not acted on — decide whether to rewrite history / rotate the exposed values, or accept the risk given the repo's audience.

## Declined / no action needed

- Kiosk sleep/dim schedule + idle-state photo slideshow — not wanted.
- ICS calendar token rotation — fine to leave as-is for now.
- Google Sign-In gate — confirmed everyone has their own Google account; gate is fine as designed, no changes.
- Automated tests — skipped for now given low change frequency and one-person maintenance. Use a manual checklist after any GAS script edit instead: add a chore, edit one with notes, mark done, delete — confirm each round-trips before redeploying. Revisit if GAS edits become frequent enough that manual re-testing gets tedious.
