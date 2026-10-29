import { useState, useEffect, useCallback, useMemo, Component } from 'react'
import { SCRIPTS, apiFetch } from '../../api/scripts'
import { useWeather } from '../../hooks/useWeather'
import useAutoFit from '../../hooks/useAutoFit'
import WeatherIcon from '../../components/WeatherIcon/WeatherIcon'
import {
  getNextUSHolidays, evSummary, dateParts, classifyEvent, countdownLabel, isStale,
  centerStageCountdown, isCenterStageStale,
} from '../Home/homeUtils'
import BulletinPanel from '../Home/panels/BulletinPanel'
import './Glance.css'
import Icon from '../../components/Icon/Icon'

// ── At a Glance — walk-by kiosk screen near the front door ──────────
// This screen is visible to guests, not just the family, which rules out
// anything personal (chores, who's-home) — so it stays purely calendar +
// bulletin. Three tiles, nothing rotating, everything visible at once:
//   • Today (top-left)  split tile: any all-day events sit in a small
//                       banner above everything (see 2026-08-26 below),
//                       then today's timed events stack on the left
//                       (closest one gets the center-stage countdown,
//                       already-passed ones stay in the stack but dim
//                       out), events from beyond the 7-day strip on the
//                       right ("Further Out", see 2026-10-28 below)
//   • Lookahead (bottom) compact 7-day strip of everything, sports
//                       visually distinct, with each day's forecast
//   • Bulletin (right)  compact strip, full height
//
// A 4th "Upcoming" tile (a flat list of everything after Today) used to
// sit next to it, but it just duplicated the Lookahead grid in a
// different shape — worse, actually, since a recurring event (e.g. a
// weekly "Garbage to street") shows up as one line per occurrence in a
// flat list, but only once per day in the grid. Removed rather than
// replaced; Today and Lookahead take the full width instead.
//
// 2026-08-21: replaced the old single-event Hero (biggest countdown =
// the very next event, full stop) with this split Today tile. Hero's
// "next event of any kind" pick meant a same-day all-day entry (e.g.
// "Family Movie Night") could occupy the spotlight ahead of a still-
// upcoming timed event later that same day, and its day-level countdown
// ("TODAY") had no granularity once something was actually close. See
// design-session-log.md for the fuller writeup.
//
// 2026-08-26: all-day events pulled out of center-stage contention
// entirely — they now render as their own small (~16pt) banner above
// the stack instead of sorting first and grabbing the spotlight. The
// first still-relevant *timed* event today always gets center stage
// with its minutes/hours countdown; the rest of the stack, plus the
// Coming Up rows on the right, are sized at ~40% of that center-stage
// title (via the --main-event-title-size custom property in Glance.css)
// so everything visibly ranks off the one event that matters most.
//
// 2026-10-28: three changes from a review of the page as a walk-by screen.
//   • Once nothing timed is left today (or there never was anything),
//     the Today tile spotlights Tomorrow instead of a dimmed list of
//     what already happened — evenings are when tomorrow matters. Today's
//     all-day items stay up as a small "Also today" line.
//   • "Coming Up" duplicated the 7-day strip right below it. It's now
//     "Further Out": the next few events *after* the 7-day window, with
//     their dates, so big things show up early. Recurring events already
//     in the strip (weekly trash, practices) are skipped.
//   • The 7-day strip shows each day's forecast, kid names in their own
//     colors on their own line, and start times only, so titles get the
//     whole column width instead of breaking mid-word.
//   • The calendar refreshes every 15 min (was hourly) and right away when
//     the screen wakes up. A small "Updated 4:12 PM" note in the 7-day
//     header turns into a warning when loads fail or the data is over 2h
//     old, and a failed load keeps the last good calendar on screen
//     instead of wiping it to "Nothing today".

const LOOKAHEAD_DAYS = 7
const DAY_ABBR = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

// Capped so the tile's height stays predictable even on a packed day —
// same "+N more" pattern Bulletin already uses.
const TODAY_CAP = 5
// "Further Out" (right side) — just enough to keep the tile from ever
// reading empty, without turning into its own scrollable list.
const FURTHER_OUT_COUNT = 3

// Calendar refresh cadence. 15 min keeps a new event from a phone showing
// up quickly; at ~100 calls a day it's far inside Apps Script's quotas.
const REFRESH_MS = 15 * 60 * 1000
// Older than this and the status note turns into a warning
const STALE_MS = 2 * 60 * 60 * 1000

// "5:00 PM" → "5 PM"; "5:30 PM" stays as is. Saves width in tight spots.
const shortTime = t => String(t || '').replace(':00', '')

// "Thu, Nov 5" for a yyyy-mm-dd string
function shortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return isNaN(d.getTime())
    ? dateStr
    : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// One day's timed events → the stack TodayTile draws, with the closest
// still-relevant one flagged as center stage — "relevant" meaning not yet
// 20 min past its start (see isCenterStageStale).
function buildStack(timed) {
  const centerIdx = timed.findIndex(e => !isCenterStageStale(e.date, e.time))
  return {
    events: timed.slice(0, TODAY_CAP).map((e, i) => ({
      ...e,
      isCenterStage: i === centerIdx,
      isPast: isCenterStageStale(e.date, e.time),
      countdown: i === centerIdx ? centerStageCountdown(e.date, e.time) : null,
    })),
    overflow: Math.max(0, timed.length - TODAY_CAP),
  }
}

// ── Flatten calendar days → one sorted, classified event list ───────
// `tick` isn't read below — it's a plain re-render trigger (see Glance())
// so the Today tile's minute-level countdown keeps advancing between the
// calendar refetches instead of sitting frozen.
function useGlanceEvents(calDays, tick) {
  return useMemo(() => {
    const today    = new Date(); today.setHours(0, 0, 0, 0)
    const todayStr = dateParts(today)
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = dateParts(tomorrow)
    const cutoff   = new Date(today); cutoff.setDate(cutoff.getDate() + LOOKAHEAD_DAYS)
    const cutoffStr = dateParts(cutoff)

    const all = []
    calDays.filter(d => d.date >= todayStr).forEach(d => {
      ;(d.events || []).forEach(ev => {
        const time = ev.isAllDay === false && ev.startTime ? ev.startTime : null
        const endTime = ev.isAllDay === false && ev.endTime ? ev.endTime : null
        if (isStale(d.date, time)) return
        const { isSports, person, title } = classifyEvent(evSummary(ev))
        const location = typeof ev === 'string' ? '' : (ev.location || '')
        all.push({ date: d.date, time, endTime, title, person, isSports, location })
      })
    })

    all.sort((a, b) =>
      a.date === b.date
        ? (a.time || '').localeCompare(b.time || '')
        : a.date.localeCompare(b.date)
    )

    const todayRaw    = all.filter(e => e.date === todayStr)
    const tomorrowRaw = all.filter(e => e.date === tomorrowStr)

    // All-day events don't compete for the center-stage spot — they get
    // their own small banner above everything instead (see TodayTile),
    // so a same-day all-day entry (e.g. "Family Movie Night") can never
    // bump a still-upcoming timed event out of the spotlight.
    const todayAllDay = todayRaw.filter(e => !e.time)

    // Spotlight today while something timed is still to come (or only
    // just started); otherwise move on to tomorrow, as long as tomorrow
    // has anything at all. With nothing tomorrow either, stay on today
    // so the tile isn't blank.
    const todayLeft  = todayRaw.some(e => e.time && !isCenterStageStale(e.date, e.time))
    const isTomorrow = !todayLeft && tomorrowRaw.length > 0
    const spotRaw    = isTomorrow ? tomorrowRaw : todayRaw
    const stack      = buildStack(spotRaw.filter(e => e.time))
    const spotlight  = {
      label:     isTomorrow ? 'Tomorrow' : 'Today',
      allDay:    spotRaw.filter(e => !e.time),
      events:    stack.events,
      overflow:  stack.overflow,
      // Today's all-day items ("Garbage to street") still matter tonight
      alsoToday: isTomorrow ? todayAllDay : [],
    }

    // "Further Out" — the next few events after the 7-day strip, one per
    // title. A title that already shows in the strip is a recurring event
    // the family can already see, so it's skipped.
    const key = e => e.title.toLowerCase()
    const inStrip = new Set(all.filter(e => e.date < cutoffStr).map(key))
    const seen = new Set()
    let furtherOut = all.filter(e => {
      if (e.date < cutoffStr || inStrip.has(key(e)) || seen.has(key(e))) return false
      seen.add(key(e))
      return true
    }).slice(0, FURTHER_OUT_COUNT)
    if (furtherOut.length === 0) {
      const h = getNextUSHolidays(4).find(h => dateParts(h.date) >= cutoffStr)
      if (h) furtherOut = [{ date: dateParts(h.date), time: null, title: h.name, person: null, isSports: false, location: '' }]
    }

    // 7-day strip — every day gets a column whether or not it has events.
    const lookahead = Array.from({ length: LOOKAHEAD_DAYS }, (_, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      const ds = dateParts(d)
      return {
        dateStr: ds,
        label:   i === 0 ? 'Today' : DAY_ABBR[d.getDay()],
        dayNum:  d.getDate(),
        isToday: i === 0,
        events:  all.filter(e => e.date === ds),
      }
    })

    return { spotlight, furtherOut, lookahead }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calDays, tick])
}

// ── Error Boundary ────────────────────────────────────────────
class GlanceErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--muted)' }}>
          <div style={{ color: '#e07070', marginBottom: 8 }}><Icon name="alert" size="1em" /> Something went wrong</div>
          <div style={{ fontFamily: 'monospace', fontSize: 'var(--fs-xs)', wordBreak: 'break-all',
            marginBottom: 20 }}>{this.state.error?.message}</div>
          <button
            style={{ padding: '6px 18px', background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 8, color: 'var(--text)', cursor: 'pointer', fontSize: 'var(--fs-md)' }}
            onClick={() => this.setState({ error: null })}
          >Retry</button>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Today tile — replaces the old single-event Hero. Left side stacks
// everything happening today (or tomorrow, once today is done — closest
// still-relevant one gets center stage, already-passed ones stay in the
// stack but dim out); right side shows what's coming after the 7-day
// strip, so the two tiles never repeat each other.
function TodayTile({ spotlight, furtherOut, loaded, onOpen }) {
  const { label, allDay, events, overflow, alsoToday } = spotlight
  // Before the first load lands, "Nothing today" would be a lie
  const emptyMsg = msg => loaded ? msg : 'Loading calendar…'
  const hasTimed = events.length > 0
  const fitRef = useAutoFit()

  return (
    <div ref={fitRef} className="glance-today-card fit-scope">
      <div className="glance-today-left">
        <span className="glance-card-label">{label}</span>
        {alsoToday.length > 0 && (
          <div className="glance-today-also">
            <span className="glance-today-also-label">Also today</span>
            {alsoToday.map((ev, i) => (
              <span key={i} className="glance-today-also-item glance-tappable" {...tapProps(() => onOpen(ev))}>
                {ev.person && (
                  <span className="glance-today-row-person" data-person={ev.person.toLowerCase()}>{ev.person}</span>
                )}
                {ev.title}
              </span>
            ))}
          </div>
        )}
        {allDay.length > 0 && (
          <div className="glance-today-allday">
            {allDay.map((ev, i) => (
              <div key={i} className="glance-today-allday-row glance-tappable" {...tapProps(() => onOpen(ev))}>
                {ev.person && (
                  <span className="glance-today-row-person" data-person={ev.person.toLowerCase()}>{ev.person}</span>
                )}
                <span>{ev.title}</span>
              </div>
            ))}
          </div>
        )}
        {!hasTimed && allDay.length === 0 ? (
          <div className="glance-card-empty"><span className="glance-empty-msg">{emptyMsg(`Nothing ${label.toLowerCase()}`)}</span></div>
        ) : !hasTimed ? null : (
          <div className="glance-today-stack">
            {events.map((ev, i) => (
              <div
                key={i}
                className={`glance-today-row glance-tappable${ev.isCenterStage ? ' is-center' : ''}${ev.isPast ? ' is-past' : ''}`}
                {...tapProps(() => onOpen(ev))}
              >
                {ev.isCenterStage ? (
                  <>
                    <div className="glance-today-center-countdown">{ev.countdown}</div>
                    <div className="glance-today-center-title">
                      {ev.person && (
                        <span className="glance-today-person" data-person={ev.person.toLowerCase()}>{ev.person}</span>
                      )}
                      {ev.title}
                    </div>
                    {ev.time && <div className="glance-today-center-time">{ev.time}</div>}
                  </>
                ) : (
                  <>
                    {ev.person && (
                      <span className="glance-today-row-person" data-person={ev.person.toLowerCase()}>{ev.person}</span>
                    )}
                    <span className="glance-today-row-title">{ev.title}</span>
                    <span className="glance-today-row-time">{ev.time || 'All day'}</span>
                  </>
                )}
              </div>
            ))}
            {overflow > 0 && (
              <div className="glance-today-more">+{overflow} more {label.toLowerCase()}</div>
            )}
          </div>
        )}
      </div>

      <div className="glance-today-divider" />

      <div className="glance-today-right">
        <span className="glance-card-label">Further Out</span>
        {furtherOut.length === 0 ? (
          <div className="glance-card-empty"><span className="glance-empty-msg">{emptyMsg('Nothing else on the calendar')}</span></div>
        ) : (
          <div className="glance-upcoming-list">
            {furtherOut.map((ev, i) => (
              <div
                key={i}
                className={`glance-upcoming-row glance-tappable${ev.isSports ? ' is-sport' : ''}`}
                {...tapProps(() => onOpen(ev))}
              >
                {/* Medal and name ride inside the title so only title and
                    date share the row — the date stays put on the right. */}
                <span className="glance-upcoming-title">
                  {ev.isSports && <span className="glance-upcoming-medal"><Icon name="medal" size="1em" /></span>}
                  {ev.person && (
                    <span className="glance-upcoming-person" data-person={ev.person.toLowerCase()}>{ev.person}</span>
                  )}
                  {ev.title}
                </span>
                <span className="glance-upcoming-when">
                  {shortDate(ev.date)}
                  {ev.time && <span className="glance-upcoming-time">{shortTime(ev.time)}</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Event details ─────────────────────────────────────────────
// Every event row on this page (Today, Further Out, Next 7 Days) opens
// this on tap, so the full title, time range and location are one touch
// away even when the tile itself has had to shrink or clip them.
function tapProps(open) {
  return {
    role: 'button',
    tabIndex: 0,
    onClick: open,
    onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } },
  }
}

function EventDetailModal({ ev, onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const d = new Date(ev.date + 'T00:00:00')
  const dateStr = !isNaN(d.getTime())
    ? d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : ev.date
  const timeStr = ev.time ? `${ev.time}${ev.endTime ? ` – ${ev.endTime}` : ''}` : 'All day'

  return (
    <div className="fun-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fun-overlay-box glance-event-modal" role="dialog" aria-modal="true" aria-label="Event details">
        <button className="glance-event-modal-close" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        <div className="glance-event-modal-kicker">
          <Icon name={ev.isSports ? 'medal' : 'calendar'} size="1em" /> {countdownLabel(ev.date)}
        </div>
        <div className="glance-event-modal-title">
          {ev.person && (
            <span className="glance-today-person" data-person={ev.person.toLowerCase()}>{ev.person}</span>
          )}
          {ev.title}
        </div>
        <div className="glance-event-modal-line">{dateStr}</div>
        <div className="glance-event-modal-line">{timeStr}</div>
        {ev.location && (
          <div className="glance-event-modal-line">
            <Icon name="pin" size="1em" /> {ev.location}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Per-day forecast — sits under each day's name in the 7-day strip.
// The NWS forecast covers about a week, so the last day can come up empty.
function DayWeather({ day }) {
  if (!day) return null
  return (
    <span className="glance-look-weather" title={day.condition}>
      <WeatherIcon emoji={day.icon} className="glance-look-weather-icon" />
      <span className="glance-look-weather-hi">{day.high != null ? `${day.high}°` : '—'}</span>
      {day.low != null && <span className="glance-look-weather-lo">{day.low}°</span>}
    </span>
  )
}

// ── Calendar status — "Updated 4:12 PM", or a warning when the calendar
// can't be reached. A kiosk viewer has no other way to tell that what
// they're reading is out of date.
function CalendarStatus({ lastUpdated, loadFailed }) {
  const time = lastUpdated?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const stale = lastUpdated && Date.now() - lastUpdated.getTime() > STALE_MS
  if (!lastUpdated && !loadFailed) return null
  if (!lastUpdated) {
    return <span className="glance-cal-status is-warn"><Icon name="alert" size="1em" /> Couldn't load the calendar</span>
  }
  if (loadFailed || stale) {
    return <span className="glance-cal-status is-warn"><Icon name="alert" size="1em" /> Calendar not updating · last {time}</span>
  }
  return <span className="glance-cal-status">Updated {time}</span>
}

// ── Lookahead card — 7-day strip of everything ──────────────────────
function LookaheadCard({ days, status, onOpen }) {
  const fitRef = useAutoFit()
  const { days: forecast } = useWeather()
  const forecastByDate = Object.fromEntries(forecast.filter(f => f.date).map(f => [f.date, f]))
  return (
    <div ref={fitRef} className="glance-lookahead-card fit-scope">
      <div className="glance-lookahead-head">
        <span className="glance-card-label">Next {LOOKAHEAD_DAYS} Days</span>
        <CalendarStatus {...status} />
      </div>
      <div className="glance-lookahead-grid">
        {days.map(d => (
          <div key={d.dateStr} className={`glance-look-day${d.isToday ? ' is-today' : ''}`}>
            <div className="glance-look-dayname">
              {d.label} <span className="glance-look-daynum">{d.dayNum}</span>
            </div>
            <DayWeather day={forecastByDate[d.dateStr]} />
            <div className="glance-look-events">
              {d.events.length === 0
                ? <span className="glance-look-none">—</span>
                : d.events.map((ev, i) => (
                    <span key={i} className={`glance-look-ev glance-tappable${ev.isSports ? ' is-sport' : ''}`} {...tapProps(() => onOpen(ev))}>
                      {/* Show the name whenever we have one, sports or not —
                          a "Tori - Dentist" shouldn't render as just "Dentist".
                          Its own line, so the title gets the full width. */}
                      {ev.person && (
                        <span className="glance-look-ev-who" data-person={ev.person.toLowerCase()}>{ev.person}</span>
                      )}
                      <span className="glance-look-ev-title">{ev.title}</span>
                      {/* Start time only — the full range is one tap away in
                          the details popup. All-day events have none. */}
                      {ev.time && (
                        <span className="glance-look-ev-time">{shortTime(ev.time)}</span>
                      )}
                    </span>
                  ))
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function Glance() {
  const [calDays, setCalDays] = useState([])
  // Pure re-render trigger — see useGlanceEvents' comment on why this
  // needs to tick faster than the calendar refetch below.
  const [tick, setTick] = useState(0)
  const [selected, setSelected] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)  // Date of last good load
  const [loadFailed, setLoadFailed] = useState(false)   // most recent load failed

  // A failed load (network error, or the script answering with an error
  // object instead of the day list) keeps the last good calendar on screen
  // and flags it, rather than replacing it with an empty one.
  const loadAll = useCallback(async () => {
    try {
      const data = await apiFetch(SCRIPTS.CHORES + '?type=upcoming&days=60').then(r => r.json())
      if (!Array.isArray(data)) throw new Error(data?.error || 'unexpected calendar response')
      setCalDays(data)
      setLastUpdated(new Date())
      setLoadFailed(false)
    } catch (e) {
      console.error('glance calendar load', e)
      setLoadFailed(true)
    }
  }, [])

  useEffect(() => {
    loadAll()
    const id = setInterval(loadAll, REFRESH_MS)
    return () => clearInterval(id)
  }, [loadAll])

  // Tablets pause timers while the screen is asleep — catch up as soon
  // as it wakes instead of waiting out the rest of the interval.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (!lastUpdated || Date.now() - lastUpdated.getTime() > REFRESH_MS) loadAll()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [loadAll, lastUpdated])

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30 * 1000)
    return () => clearInterval(id)
  }, [])

  const { spotlight, furtherOut, lookahead } = useGlanceEvents(calDays, tick)

  return (
    <GlanceErrorBoundary>
      <div className="glance-content">
        <TodayTile spotlight={spotlight} furtherOut={furtherOut} loaded={!!lastUpdated} onOpen={setSelected} />
        <LookaheadCard days={lookahead} status={{ lastUpdated, loadFailed }} onOpen={setSelected} />
        <div className="glance-col-bulletin">
          <BulletinPanel
            compact
            bodyClassName="bulletin-strip-compact"
            limit={4}
            style={{ height: '100%' }}
          />
        </div>
      </div>
      {selected && <EventDetailModal ev={selected} onClose={() => setSelected(null)} />}
    </GlanceErrorBoundary>
  )
}
