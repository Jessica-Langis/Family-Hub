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
- 2026-08-21: "Daily digest" email — send a scheduled email to specific people with an outline of that day's events plus chores and reminders for that day and the next day. Design/build details (recipients, send time, delivery mechanism — likely a GAS time-driven trigger since the backend is already Apps Script) not yet worked out; revisit during planning.
- 2026-08-21: Glance ("At a Glance") — replace the Hero card with a new "Today" tile:
  - **Left side:** all of today's events, stacked time ASC, with the closest upcoming event given center-stage visual emphasis (bigger/highlighted vs. the rest of the stack, similar spirit to the current Hero countdown treatment).
  - **Right side:** next 2-3 upcoming events regardless of day (so it stays populated even on a light today).
  - A subtle divider separates the two halves within the one tile.
  - Lookahead (7-day strip) and Bulletin stay as-is; this only replaces Hero. Since Glance is guest-visible, stays calendar-only — no chores/personal info here.
  - Layout/visual details (sizing, exact divider styling, how many "today" events before it scrolls/truncates) not yet worked out; revisit during planning.
- 2026-08-21: Hero countdown — when the next event is today, it just reads "TODAY" with no further granularity. Want an hours-based countdown instead (e.g. "in 3 hours") once the event is same-day, so it's more useful close-up than a flat day-level label. Under 60 minutes out, switch to minutes (e.g. "in 42 min") instead of "in 0 hours" / "in 1 hour". Root cause: `countdownLabel()` in [homeUtils.js](src/pages/Home/homeUtils.js#L100-L106) short-circuits any `d <= 0` to the literal string `'TODAY'` — no time-of-day math at all. Shared by Glance's Hero and And Stuff's Upcoming Events list, so a fix there would need to consider both call sites (and whatever replaces Hero per the Today-tile item above — its "center stage" event should get the same treatment). Needs the event's start time, which the data already carries (`ev.startTime`) but `countdownLabel` currently only takes a date. Not yet worked out: what it should say once the event's time has passed today (already-happened same-day events), or for all-day events with no time. Revisit during planning.
- 2026-08-21: Hero panel — drop an event from Hero once it's ≥20 min past its start time, instead of it lingering as the "next event" all day. Distinct from the existing `isStale()` helper in [homeUtils.js:111](src/pages/Home/homeUtils.js#L111-L116), which uses a 2h grace window and is shared by Glance (feeds both Hero and Lookahead from the same filtered list) and And Stuff's Upcoming Events list — that 2h window is deliberate for "what's happening" boards and shouldn't just be tightened globally to 20 min, since Lookahead's day-strip and Upcoming Events likely still want the longer window. So this needs its own tighter check scoped to just the "next event" pick, not a change to the shared `isStale`. Also needs reconciling with the Today-tile item above (which replaces Hero) — presumably this 20-min-past rule governs which event gets "center stage" there, and a separate question is whether today's stacked list on the left should still show already-passed events (dimmed?) or drop them too. Revisit during planning.

## Built since last log entry (undated — picked up mid-conversation, 2026-08-26)

The four items above (Today tile, hour/minute countdown, 20-min-past drop) are now live in [Glance.jsx](src/pages/Glance/Glance.jsx) and [Glance.css](src/pages/Glance/Glance.css) — `TodayTile` replaced the old Hero, with `centerStageCountdown` / `isCenterStageStale` in homeUtils.js handling the countdown granularity and the 20-min cutoff for the center-stage pick specifically (left as designed: separate from the shared 2h `isStale`).

## Backlog (later, not this session) — continued

- 2026-08-26: Today tile is much too small on desktop/large screens, with a lot of unused space around it. Want everything centered and the text sized much larger — but still fluid/responsive, not a fixed jump. Likely touches:
  - `.glance-today-center-countdown` and `.glance-today-center-title` in [Glance.css:192-209](src/pages/Glance/Glance.css#L192-L209) — their `clamp()` ranges top out fairly modest (2.3rem / 1.15rem) regardless of how much room a large screen actually has, so they stop growing well before the available space is used.
  - `.glance-today-left` / `.glance-today-right` in [Glance.css:106-117](src/pages/Glance/Glance.css#L106-L117) — content is left-aligned/top-packed today; "center everything" implies both halves should center their content rather than hug the top-left.
  - The `.glance-content` grid ([Glance.css:21-33](src/pages/Glance/Glance.css#L21-L33)) gives Today only `1.15fr` of the row height next to Lookahead's `1fr` — worth revisiting whether Today should claim more of the vertical space on wide/tall screens specifically, vs. a flat ratio at every size.
  - Not yet worked out: what breakpoint(s) count as "desktop/large screen" here (existing breakpoints are 1100px tablet and 640px mobile — nothing distinguishes a large desktop from a mid-size one), and how large is "much larger" before it stops feeling dynamic/proportional. Revisit during planning.
  - **Built — 2026-08-26:** both halves of the Today tile now center their content (horizontally and vertically, via flex `align-items`/`justify-content` on `.glance-today-left/-right` and their inner stacks). Every font size in the tile — center-stage countdown/title/time, stack rows, "Coming Up" rows — switched from `vw`-only or fixed `clamp()` caps to combined `vw + vh` clamps with meaningfully higher ceilings (center-stage countdown now caps at 7.5rem vs. the old 2.3rem), so it keeps growing continuously with screen size instead of hard-capping — no explicit "large screen" breakpoint needed. Verified at 1920×1080 (desktop), 900×700 (tablet), and 390×844 (mobile) via a headless Playwright screenshot pass against the mock backend; all three read clean. Left the `1.15fr`/`1fr` grid row ratio (Today vs. Lookahead) unchanged — the centering + larger type already closed most of the visual gap without needing to reshuffle that.

## Backlog (later, not this session) — continued (2)

- 2026-08-26: Today tile — all-day events shouldn't compete for the center-stage spot, and the other events shown need to visibly rank below whichever one is center-stage:
  - All-day events (e.g. "Garbage to street") pull out of the stack entirely and show as a small (~16pt) banner above everything else, instead of sorting first and grabbing the spotlight ahead of a same-day timed event.
  - The first still-relevant timed event today becomes the priority/center-stage display, with the minutes/hours countdown.
  - Every other event's subject/description text (today-stack rows, Coming Up rows) sized at roughly 40% of the center-stage title's size, on desktop.
  - **Built — 2026-08-26:** implemented in [Glance.jsx](src/pages/Glance/Glance.jsx) and [Glance.css](src/pages/Glance/Glance.css). `useGlanceEvents` now splits today's events into `todayAllDay` / `todayTimed` before picking center-stage, so center-stage selection only ever considers timed events (`.glance-today-allday` banner renders the all-day ones separately, fixed 16pt, above the stack). Added a `--main-event-title-size` custom property on `.glance-today-card`; the center-stage title reads from it directly, and both `.glance-today-row` and `.glance-upcoming-row` derive `calc(var(--main-event-title-size) * 0.4)` so they scale together rather than independently. Scoped the 40% tie to tablet/desktop — added a fixed 0.85rem floor for those rows in the existing mobile (≤640px) breakpoint, since 40% of an already-small mobile title read too tiny to use. Verified against the mock backend's real mixed-day scenario (all-day "Garbage to street" + timed "Dentist Appointment" both today) at 1920×1080 and 390×844 — banner, center-stage handoff, and proportional sizing all confirmed working, no console errors.

## Declined / no action needed

- Kiosk sleep/dim schedule + idle-state photo slideshow — not wanted.
- ICS calendar token rotation — fine to leave as-is for now.
- Google Sign-In gate — confirmed everyone has their own Google account; gate is fine as designed, no changes.
- Automated tests — skipped for now given low change frequency and one-person maintenance. Use a manual checklist after any GAS script edit instead: add a chore, edit one with notes, mark done, delete — confirm each round-trips before redeploying. Revisit if GAS edits become frequent enough that manual re-testing gets tedious.
