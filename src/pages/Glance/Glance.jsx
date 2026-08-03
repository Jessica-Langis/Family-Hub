import { useState, useEffect, useCallback, useMemo, Component } from 'react'
import { SCRIPTS, apiFetch } from '../../api/scripts'
import { useWeather } from '../../hooks/useWeather'
import {
  getNextUSHolidays, getDayDiff, evSummary, dateParts,
  classifyEvent, urgencyClass,
} from '../Home/homeUtils'
import BulletinPanel from '../Home/panels/BulletinPanel'
import './Glance.css'

// ── At a Glance — walk-by kiosk screen near the front door ──────────
// Four tiles, nothing rotating, everything visible at once:
//   • Hero (left)        next non-sports family event, countdown as the
//                        headline, tinted by urgency
//   • Sports (top right) every upcoming Tori/Nova sports event, equal
//                        visual weight to the hero
//   • Lookahead (bottom) compact 5-7 day strip of everything, sports
//                        visually distinct, with today's weather inline
//   • Bulletin (right)   unchanged, compact strip
//
// Sports vs. non-sports routing is pure frontend keyword matching —
// see classifyEvent in homeUtils. The calendar needs no special tags.

const LOOKAHEAD_DAYS = 7
const DAY_ABBR = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function fmtFull(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// A timed event drops off the board 2h after it started; all-day events
// stay up for the whole day.
function isStale(dateStr, timeStr) {
  if (!timeStr) return false
  const t = new Date(dateStr + ' ' + timeStr)
  if (isNaN(t.getTime())) return false
  return (new Date() - t) >= 2 * 60 * 60 * 1000
}

function countdownLabel(dateStr) {
  const d = getDayDiff(dateStr)
  if (isNaN(d)) return ''
  if (d <= 0)  return 'TODAY'
  if (d === 1) return 'TOMORROW'
  return `${d} DAYS`
}

// ── Flatten calendar days → one sorted, classified event list ───────
function useGlanceEvents(calDays) {
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

    const sports = all.filter(e => e.isSports)

    // The hero is the next thing that isn't a sports event — those get
    // their own tile, so repeating one here would waste the biggest slot.
    let hero = all.find(e => !e.isSports) || null
    if (!hero) {
      const h = getNextUSHolidays(1)[0]
      if (h) hero = { date: dateParts(h.date), time: null, title: h.name, person: null, isSports: false }
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

    return { hero, sports, lookahead }
  }, [calDays])
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

// ── Hero card — next non-sports event, countdown as the headline ────
function HeroCard({ event }) {
  if (!event) {
    return (
      <div className="glance-hero-card glance-card-empty">
        <span className="glance-empty-msg">Nothing on the calendar</span>
      </div>
    )
  }
  const diff = getDayDiff(event.date)
  const soon = diff <= 1   // TODAY / TOMORROW read as words, not a number

  return (
    <div className={`glance-hero-card urgency-${urgencyClass(event.date)}`}>
      <div className={`glance-hero-countdown${soon ? ' is-word' : ''}`}>
        {soon ? countdownLabel(event.date) : diff}
      </div>
      {!soon && <div className="glance-hero-unit">days away</div>}
      <div className="glance-hero-title">{event.title}</div>
      <div className="glance-hero-date">
        {fmtFull(event.date)}{event.time ? ` · ${event.time}` : ''}
      </div>
    </div>
  )
}

// ── Sports card — every upcoming Tori/Nova sports event ─────────────
function SportsCard({ events }) {
  return (
    <div className="glance-sports-card">
      <div className="glance-card-label">🏅 Sports</div>
      {events.length === 0 ? (
        <div className="glance-card-empty">
          <span className="glance-empty-msg">No sports scheduled</span>
        </div>
      ) : (
        <div className="glance-sports-list">
          {events.map((ev, i) => (
            <div key={`${ev.date}-${ev.title}-${i}`} className={`glance-sports-row urgency-${urgencyClass(ev.date)}`}>
              <span className="glance-sports-person" data-person={(ev.person || '').toLowerCase()}>
                {ev.person}
              </span>
              <span className="glance-sports-title">{ev.title}</span>
              <span className="glance-sports-when">
                {countdownLabel(ev.date)}
                {ev.time ? ` · ${ev.time}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
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
                      {ev.isSports && ev.person && (
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

  const { hero, sports, lookahead } = useGlanceEvents(calDays)

  return (
    <GlanceErrorBoundary>
      <div className="glance-content">
        <HeroCard event={hero} />
        <SportsCard events={sports} />
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
