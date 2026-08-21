// ── Date helpers ────────────────────────────────────────────
export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function normalizeDate(dateStr) {
  if (!dateStr) return null
  const clean = String(dateStr).split('T')[0].trim()
  let d = new Date(clean + 'T00:00:00')
  if (!isNaN(d.getTime())) { d.setHours(0,0,0,0); return d }
  d = new Date(dateStr)
  if (!isNaN(d.getTime())) { d.setHours(0,0,0,0); return d }
  return null
}

export function getDayDiff(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0)
  const target = normalizeDate(dateStr)
  if (!target) return NaN
  return Math.round((target - today) / 86400000)
}

export function formatDateShort(dateStr) {
  const d = normalizeDate(dateStr)
  if (!d) return ''
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}

// ── Person-tagged calendar events ──────────────────────────────
// Matches summaries like "Nova - Basketball Tournament" or "Tori: Recital".
// Returns the remainder after the name + separator, or null if no match.
export function parsePersonEvent(summary, name) {
  if (!summary || !name) return null
  const re = new RegExp('^\\s*' + name + '\\s*[-:–]\\s*(.+)$', 'i')
  const m = String(summary).match(re)
  return m ? m[1].trim() : null
}

// ── Shared calendar-event shape helpers ────────────────────────
// Calendar payloads come back either as bare strings or as objects, so
// every consumer needs these two. They used to be redefined in Glance,
// TwoWeekCalendar and Unwind independently.
export function evSummary(ev) {
  return typeof ev === 'string' ? ev : (ev.summary || ev.name || '')
}

export function dateParts(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Sports event detection ─────────────────────────────────────
// Frontend-only, so the Google Calendar needs no special tagging.
//
// Detection is keyword-only: the real calendar entries are titled things
// like "Wrestling Meet" or "Districts" with no kid name in them, so an
// earlier version that also required a "Tori - " prefix matched nothing
// at all. If a prefix happens to be present we still use it to attribute
// the event, but it is never required.
export const SPORTS_KEYWORDS = [
  'tournament', 'meet', 'match', 'practice', 'wrestling', 'game',
  'scrimmage', 'tryout', 'competition', 'qualifier', 'regional',
  'championship', 'dual',
]

// Word-boundary matched with an optional plural suffix, so "meet" hits
// "meet"/"meets" but not "meeting", and "match" also catches "matches".
const SPORTS_RE = new RegExp(`\\b(?:${SPORTS_KEYWORDS.join('|')})(?:e?s)?\\b`, 'i')

export function hasSportsKeyword(text) {
  return SPORTS_RE.test(String(text || ''))
}

export const KID_NAMES = ['Tori', 'Nova']

// Returns { isSports, person, title } for a raw calendar summary.
// `person` is only non-null when the title actually carries a kid's name;
// most family-calendar entries don't, so expect null and render around it.
export function classifyEvent(summary) {
  const raw = String(summary || '').trim()
  for (const person of KID_NAMES) {
    const stripped = parsePersonEvent(raw, person)
    if (stripped) {
      return { isSports: hasSportsKeyword(stripped), person, title: stripped }
    }
  }
  return { isSports: hasSportsKeyword(raw), person: null, title: raw }
}

// ── Urgency ────────────────────────────────────────────────────
// today = warm amber, tomorrow = blue, 2+ days out = muted.
export function urgencyClass(dateStr) {
  const d = getDayDiff(dateStr)
  if (isNaN(d)) return 'later'
  if (d <= 0)   return 'today'
  if (d === 1)  return 'tomorrow'
  return 'later'
}

// "TODAY" / "TOMORROW" / "N DAYS" — shared between At a Glance's Hero tile
// and And Stuff's Upcoming Events list so the two can't drift out of sync
// on wording.
export function countdownLabel(dateStr) {
  const d = getDayDiff(dateStr)
  if (isNaN(d)) return ''
  if (d <= 0)  return 'TODAY'
  if (d === 1) return 'TOMORROW'
  return `${d} DAYS`
}

// A timed event drops off a "what's happening" board 2h after it started;
// all-day events stay up for the whole day. Shared for the same reason as
// countdownLabel above.
export function isStale(dateStr, timeStr) {
  if (!timeStr) return false
  const t = new Date(dateStr + ' ' + timeStr)
  if (isNaN(t.getTime())) return false
  return (new Date() - t) >= 2 * 60 * 60 * 1000
}

// ── Center-stage countdown (Glance Today tile) ──────────────────────
// Distinct from countdownLabel above — this gives an hours/minutes-level
// readout for the single "closest upcoming" event the new Today tile
// highlights, rather than the flat day-level TODAY/TOMORROW/N DAYS
// wording used everywhere else (Lookahead, And Stuff's Upcoming Events
// list). Only meaningful for a same-day event with a known start time;
// anything else (a future day, or an all-day event with no clock time)
// falls back to the same flat wording those other places use.
export function centerStageCountdown(dateStr, timeStr) {
  const d = getDayDiff(dateStr)
  if (isNaN(d)) return ''
  if (d !== 0) return countdownLabel(dateStr) // center-stage is always today's own pick
  if (!timeStr) return 'TODAY' // all-day event — no clock time to count down from

  const start = new Date(`${dateStr} ${timeStr}`)
  if (isNaN(start.getTime())) return 'TODAY'

  const minutes = Math.round((start - new Date()) / 60000)
  if (minutes <= 0) return 'NOW' // already started, but not stale yet — see isCenterStageStale
  if (minutes < 60) return `in ${minutes} min`
  const hours = Math.round(minutes / 60)
  return `in ${hours} hour${hours === 1 ? '' : 's'}`
}

// ── Center-stage staleness (Glance Today tile) ───────────────────────
// Tighter than isStale()'s 2h "what's happening" grace window above
// (shared by Lookahead + Upcoming Events, deliberately loose) — this one
// governs only which event earns the Today tile's single "closest
// upcoming" spot: drop it 20 min after it starts rather than letting it
// sit there all day. All-day events (no time) are never stale by this
// rule, so they stay eligible as center-stage for the whole day.
export function isCenterStageStale(dateStr, timeStr) {
  if (!timeStr) return false
  const start = new Date(`${dateStr} ${timeStr}`)
  if (isNaN(start.getTime())) return false
  const minutesPast = (new Date() - start) / 60000
  return minutesPast >= 20
}

export function formatReminderDate(dateStr) {
  if (!dateStr?.trim()) return ''
  const today = new Date(); today.setHours(0,0,0,0)
  const parsed = normalizeDate(dateStr)
  if (!parsed) return ''
  const diff = Math.round((parsed - today) / 86400000)
  if (diff === 0)  return 'Today'
  if (diff === 1)  return 'Tomorrow'
  if (diff < 0)   return `${Math.abs(diff)}d ago`
  return `${MONTHS[parsed.getMonth()]} ${parsed.getDate()}`
}

// ── US Holidays ──────────────────────────────────────────────
const US_HOLIDAYS = [
  { name: "New Year's Day",            month: 1,  day: 1  },
  { name: "Martin Luther King Jr. Day",month: 1,  nth: 3, weekday: 1 },
  { name: "Presidents' Day",           month: 2,  nth: 3, weekday: 1 },
  { name: "Memorial Day",              month: 5,  last: true, weekday: 1 },
  { name: "Juneteenth",                month: 6,  day: 19 },
  { name: "Independence Day",          month: 7,  day: 4  },
  { name: "Labor Day",                 month: 9,  nth: 1, weekday: 1 },
  { name: "Columbus Day",              month: 10, nth: 2, weekday: 1 },
  { name: "Veterans Day",              month: 11, day: 11 },
  { name: "Thanksgiving",              month: 11, nth: 4, weekday: 4 },
  { name: "Christmas Day",             month: 12, day: 25 },
]

function getNthWeekday(year, month, nth, weekday) {
  const d = new Date(year, month - 1, 1)
  let count = 0
  while (true) {
    if (d.getDay() === weekday) { count++; if (count === nth) return new Date(d) }
    d.setDate(d.getDate() + 1)
  }
}

function getLastWeekday(year, month, weekday) {
  const d = new Date(year, month, 0)
  while (d.getDay() !== weekday) d.setDate(d.getDate() - 1)
  return new Date(d)
}

export function getNextUSHolidays(n = 2) {
  const today = new Date(); today.setHours(0,0,0,0)
  const year = today.getFullYear()
  const candidates = []
  ;[year, year + 1].forEach(y => {
    US_HOLIDAYS.forEach(h => {
      let d
      if (h.day)       d = new Date(y, h.month - 1, h.day)
      else if (h.last) d = getLastWeekday(y, h.month, h.weekday)
      else             d = getNthWeekday(y, h.month, h.nth, h.weekday)
      if (d >= today) candidates.push({ name: h.name, date: d })
    })
  })
  candidates.sort((a, b) => a.date - b.date)
  return candidates.slice(0, n)
}
