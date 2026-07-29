# Family Hub — Design Session Log

Running list from our ongoing design brainstorm. "Decided" = agreed and ready to build. "Suggested" = my ideas from the whole-app assessment, not yet confirmed.

## Built — 2026-07-29

All items below are built and verified (clean production build). Two manual steps needed on your end before they go live:
1. In the shared spreadsheet's Chores tab, column H is now `CompletedAt` (auto-filled by the app going forward — no need to backfill existing rows).
2. Paste the updated `chores_gas_script.gs` into the Apps Script editor and redeploy (same manual step as always).

## Decided

**At a Glance**
- Rebuild as 3 zones instead of 5 stacked modules: thin header (clock/date + single-day weather, not 5-day forecast), a dominant "what's happening" hero (next 1-2 events, today's event visually largest, holidays folded in as just another entry), and a compact bulletin strip (top ~3 items as single lines, tap to expand the rest).
- No auto-rotation/cycling — everything stays static on one screen (it's a walk-by kiosk near the front door).
- Remove the two-week calendar grid from this page entirely — moves to And Stuff.

**And Stuff (Unwind)**
- Fold in the "Where I'll Be" panel (currently built but orphaned/unrendered in the code) — placed near the top since it's time-sensitive (sleepovers, who's away).
- Add the two-week calendar as a lower supplementary tile — compact/glanceable (short event title + "+N more" per day), click any day to open a popup with full event details.

**Tori page**
- Merge "To Do" and "Reminders" into a single panel — confirmed redundant.

**Nova page**
- Consolidate "Today" and "Countdown" panels into one merged "Next Up" panel, matching the pattern already used on Tori's page (merges manual events + calendar-tagged events, shows top 1-2).

**App-wide**
- Refactor the chores add/edit/delete logic — currently copy-pasted nearly identically across Unwind, Tori, and Nova — into one shared component. This is *why* the notes-saving bug happened; fixing the duplication prevents that class of bug going forward.
- Add a lightweight "completed" feed so finished chores/points don't just vanish — visible completion is part of what makes the points system motivating.

## Planned for next session

- Whole-app visual theme update, based on the At a Glance screenshot you shared — apply that look/palette consistently across all pages (currently only loosely shared via CSS tokens). Design details still to be worked out.

## Backlog (later, not this session)

- Session "sign out this device" control — right now revoking a session means manually deleting a row in the Sessions sheet.

## Declined / no action needed

- Kiosk sleep/dim schedule + idle-state photo slideshow — not wanted.
- ICS calendar token rotation — fine to leave as-is for now.
- Google Sign-In gate — confirmed everyone has their own Google account; gate is fine as designed, no changes.
- Automated tests — skipped for now given low change frequency and one-person maintenance. Use a manual checklist after any GAS script edit instead: add a chore, edit one with notes, mark done, delete — confirm each round-trips before redeploying. Revisit if GAS edits become frequent enough that manual re-testing gets tedious.
