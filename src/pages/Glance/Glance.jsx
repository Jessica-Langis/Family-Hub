import { useState, useEffect, useCallback, useMemo, Component } from 'react'
import { SCRIPTS, apiFetch } from '../../api/scripts'
import { useWeather } from '../../hooks/useWeather'
import {
  getNextUSHolidays, evSummary, dateParts, classifyEvent, countdownLabel, isStale,
  centerStageCountdown, isCenterStageStale,
} from '../Home/homeUtils'
import BulletinPanel from '../Home/panels/BulletinPanel'
import './Glance.css'

// ── At a Glance — walk-by kiosk screen near the front door ──────────
// This screen is visible to guests, not just the family, which rules out
// anything personal (chores, who's-home) — so it stays purely calendar +
// bulletin. Three tiles, nothing rotating, everything visible at once:
//   • Today (top-left)  split tile: any all-day events sit in a small
//                       banner above everything (see 2026-08-26 below),
//                       then today's timed events stack on the left
//                       (closest one gets the center-stage countdown,
//                       already-passed ones stay in the stack but dim
//                       out), next few events from beyond today on the
//                       right so the tile is never empty on a light day
//   • Lookahead (bottom) compact 7-day strip of everything, sports
//                       visually distinct, with today's weather inline
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

const LOOKAHEAD_DAYS = 7
const DAY_ABBR = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

// Capped so the tile's height stays predictable even on a packed day —
// same "+N more" pattern Bulletin already uses.
const TODAY_CAP = 5
// "Coming Up" (right side) — just enough to keep the tile from ever
// reading empty, without turning into its own scrollable list.
const UPCOMING_BEYOND_COUNT = 3

// ── Flatten calendar days → one sorted, classified event list ───────
// `tick` isn't read below — it's a plain re-render trigger (see Glance())
// so the Today tile's minute-level countdown keeps advancing between the
// hourly calendar refetches instead of sitting frozen for up to an hour.
function useGlanceEvents(calDays, tick) {
  return useMemo(() => {
    const today    = new Date(); today.setHours(0, 0, 0, 0)
    const todayStr = dateParts(today)

    const all = []
    calDays.filter(d => d.date >= todayStr).forEach(d => {
      ;(d.events || []).forEach(ev => {
        const time = ev.isAllDay === false && ev.startTime ? ev.startTime : null
        if (isStale(d.date, time)) return
        const { isSports, person, title } = classifyEvent(evSummary(ev))
        all.push({ date: d.date, time, title, person, isSports })
      })
    })

    all.sort((a, b) =>
      a.date === b.date
        ? (a.time || '').localeCompare(b.time || '')
        : a.date.localeCompare(b.date)
    )

    const todayRaw = all.filter(e => e.date === todayStr)
    const laterRaw = all.filter(e => e.date !== todayStr)

    // All-day events don't compete for the center-stage spot — they get
    // their own small banner above everything instead (see TodayTile),
    // so a same-day all-day entry (e.g. "Family Movie Night") can never
    // bump a still-upcoming timed event out of the spotlight.
    const todayAllDay = todayRaw.filter(e => !e.time)
    const todayTimed  = todayRaw.filter(e => e.time)

    // The closest still-relevant timed event today earns the center-stage
    // slot — "relevant" meaning not yet 20 min past its start (see
    // isCenterStageStale). If nothing timed is left today, nothing gets
    // the center-stage treatment (the all-day banner still shows).
    const centerIdx = todayTimed.findIndex(e => !isCenterStageStale(e.date, e.time))

    const todayEvents = todayTimed.slice(0, TODAY_CAP).map((e, i) => ({
      ...e,
      isCenterStage: i === centerIdx,
      isPast: isCenterStageStale(e.date, e.time),
      countdown: i === centerIdx ? centerStageCountdown(e.date, e.time) : null,
    }))
    const todayOverflow = Math.max(0, todayTimed.length - TODAY_CAP)

    // "Coming Up" — next few events from tomorrow on, regardless of how
    // many (if any) are left today, so the right side never goes blank.
    let upcomingBeyond = laterRaw.slice(0, UPCOMING_BEYOND_COUNT)
    if (upcomingBeyond.length === 0) {
      const h = getNextUSHolidays(1)[0]
      if (h) upcomingBeyond = [{ date: dateParts(h.date), time: null, title: h.name, person: null, isSports: false }]
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

    return { todayAllDay, todayEvents, todayOverflow, upcomingBeyond, lookahead }
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
          <div style={{ color: '#e07070', marginBottom: 8 }}>⚠ Something went wrong</div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', wordBreak: 'break-all',
            marginBottom: 20 }}>{this.state.error?.message}</div>
          <button
            style={{ padding: '6px 18px', background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 8, color: 'var(--text)', cursor: 'pointer', fontSize: '0.85rem' }}
            onClick={() => this.setState({ error: null })}
          >Retry</button>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Today tile — replaces the old single-event Hero. Left side stacks
// everything happening today (closest still-relevant one gets center
// stage, already-passed ones stay in the stack but dim out); right side
// is a small teaser of what's coming after today, so the tile still has
// something to show even on a light day.
function TodayTile({ todayAllDay, todayEvents, todayOverflow, upcomingBeyond }) {
  const hasTimed = todayEvents.length > 0

  return (
    <div className="glance-today-card">
      <div className="glance-today-left">
        <span className="glance-card-label">Today</span>
        {todayAllDay.length > 0 && (
          <div className="glance-today-allday">
            {todayAllDay.map((ev, i) => (
              <div key={i} className="glance-today-allday-row">
                {ev.person && (
                  <span className="glance-today-row-person" data-person={ev.person.toLowerCase()}>{ev.person}</span>
                )}
                <span>{ev.title}</span>
              </div>
            ))}
          </div>
        )}
        {!hasTimed && todayAllDay.length === 0 ? (
          <div className="glance-card-empty"><span className="glance-empty-msg">Nothing today</span></div>
        ) : !hasTimed ? null : (
          <div className="glance-today-stack">
            {todayEvents.map((ev, i) => (
              <div
                key={i}
                className={`glance-today-row${ev.isCenterStage ? ' is-center' : ''}${ev.isPast ? ' is-past' : ''}`}
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
            {todayOverflow > 0 && (
              <div className="glance-today-more">+{todayOverflow} more today</div>
            )}
          </div>
        )}
      </div>

      <div className="glance-today-divider" />

      <div className="glance-today-right">
        <span className="glance-card-label">Coming Up</span>
        {upcomingBeyond.length === 0 ? (
          <div className="glance-card-empty"><span className="glance-empty-msg">Nothing else on the calendar</span></div>
        ) : (
          <div className="glance-upcoming-list">
            {upcomingBeyond.map((ev, i) => (
              <div key={i} className="glance-upcoming-row">
                {ev.isSports && <span className="glance-upcoming-medal">🏅</span>}
                {ev.person && (
                  <span className="glance-upcoming-person" data-person={ev.person.toLowerCase()}>{ev.person}</span>
                )}
                <span className="glance-upcoming-title">{ev.title}</span>
                <span className="glance-upcoming-when">{countdownLabel(ev.date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Weather strip — compact, lives in the lookahead header ──────────
function WeatherStrip() {
  const { days, loading } = useWeather()
  const today = days[0]
  if (loading || !today) return null
  return (
    <span className="glance-weather-strip" title={today.condition}>
      <span className="gws-icon">{today.icon}</span>
      <span className="gws-temp">{today.temp}</span>
    </span>
  )
}

// ── Lookahead card — 7-day strip of everything ──────────────────────
function LookaheadCard({ days }) {
  return (
    <div className="glance-lookahead-card">
      <div className="glance-lookahead-head">
        <span className="glance-card-label">Next {LOOKAHEAD_DAYS} Days</span>
        <WeatherStrip />
      </div>
      <div className="glance-lookahead-grid">
        {days.map(d => (
          <div key={d.dateStr} className={`glance-look-day${d.isToday ? ' is-today' : ''}`}>
            <div className="glance-look-dayname">
              {d.label} <span className="glance-look-daynum">{d.dayNum}</span>
            </div>
            <div className="glance-look-events">
              {d.events.length === 0
                ? <span className="glance-look-none">—</span>
                : d.events.map((ev, i) => (
                    <span key={i} className={`glance-look-ev${ev.isSports ? ' is-sport' : ''}`}>
                      {/* Show the name whenever we have one, sports or not —
                          a "Tori - Dentist" shouldn't render as just "Dentist". */}
                      {ev.person && (
                        <span className="glance-look-ev-who">{ev.person}</span>
                      )}
                      {ev.title}
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
  // needs to tick faster than the hourly calendar refetch below.
  const [tick, setTick] = useState(0)

  const loadAll = useCallback(async () => {
    try {
      const data = await apiFetch(SCRIPTS.CHORES + '?type=upcoming&days=60').then(r => r.json())
      setCalDays(Array.isArray(data) ? data : [])
    } catch (e) { console.error('glance calendar load', e) }
  }, [])

  useEffect(() => {
    loadAll()
    const id = setInterval(loadAll, 60 * 60 * 1000)
    return () => clearInterval(id)
  }, [loadAll])

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30 * 1000)
    return () => clearInterval(id)
  }, [])

  const { todayAllDay, todayEvents, todayOverflow, upcomingBeyond, lookahead } = useGlanceEvents(calDays, tick)

  return (
    <GlanceErrorBoundary>
      <div className="glance-content">
        <TodayTile todayAllDay={todayAllDay} todayEvents={todayEvents} todayOverflow={todayOverflow} upcomingBeyond={upcomingBeyond} />
        <LookaheadCard days={lookahead} />
        <div className="glance-col-bulletin">
          <BulletinPanel
            compact
            bodyClassName="bulletin-strip-compact"
            limit={4}
            style={{ height: '100%' }}
          />
        </div>
      </div>
    </GlanceErrorBoundary>
  )
}
