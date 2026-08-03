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

export function countdownBadge(diff) {
  if (isNaN(diff)) return { text: '', cls: 'upcoming' }
  if (diff < 0)    return { text: `${Math.abs(diff)}d ago`, cls: 'past' }
  if (diff === 0)  return { text: 'TODAY', cls: 'today' }
  if (diff <= 7)   return { text: `${diff}d away`, cls: 'soon' }
  return { text: `${diff} days`, cls: 'upcoming' }
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
// An event counts as "sports" only when it is BOTH tagged to a kid
// ("Tori - ..." / "Nova - ...") AND its title mentions a sports keyword.
// Requiring both keeps ordinary kid events (dentist, birthday, haircut)
// out of the sports tile. The trade-off: a bare, unprefixed family entry
// like "Wrestling Tournament" will NOT be treated as sports. If that
// starts biting, change the `&&` in classifyEvent to `||`.
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
// `title` has the "Tori - " prefix stripped when one was present.
export function classifyEvent(summary) {
  for (const person of KID_NAMES) {
    const stripped = parsePersonEvent(summary, person)
    if (stripped) {
      return { isSports: hasSportsKeyword(stripped), person, title: stripped }
    }
  }
  return { isSports: false, person: null, title: String(summary || '').trim() }
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

export function getNextUSHoliday() {
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
  return candidates[0] || null
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
