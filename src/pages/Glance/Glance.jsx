import { useState, useEffect, useCallback, useMemo, Component } from 'react'
import { SCRIPTS, apiFetch } from '../../api/scripts'
import { useWeather } from '../../hooks/useWeather'
import { getNextUSHolidays } from '../Home/homeUtils'
import BulletinPanel from '../Home/panels/BulletinPanel'
import './Glance.css'

// ── At a Glance — 3-card layout matching the design mockup:
// a TODAY hero (biggest, left), a secondary "what's next" + weather
// stack (middle), and the Bulletin Board (right, full height). No
// auto-rotation — this is a walk-by kiosk screen near the front door,
// so everything needs to be visible at once. The 2-week calendar grid
// lives on And Stuff; holidays fold into the same ranked list as real
// events instead of getting their own section.

// ── helpers ───────────────────────────────────────────────────
function evSummary(ev) {
  return typeof ev === 'string' ? ev : (ev.summary || ev.name || '')
}

function dateParts(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtFull(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return ''
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2,'0')} ${d.getFullYear()}`
}

function daysFromToday(dateStr) {
  const today  = new Date(); today.setHours(0,0,0,0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.round((target - today) / 86400000)
}

// Returns { days, hours, hasTime, past } — hours only available when a time is provided
function getCountdown(dateStr, timeStr) {
  const now        = new Date()
  const todayStart = new Date(); todayStart.setHours(0,0,0,0)
  const targetDay  = new Date(dateStr + 'T00:00:00')
  const days       = Math.round((targetDay - todayStart) / 86400000)

  if (timeStr) {
    const full = new Date(dateStr + ' ' + timeStr)
    if (!isNaN(full.getTime())) {
      const ms = full - now
      if (ms <= 0) return { days: 0, hours: 0, hasTime: true, past: true }
      const totalH = Math.floor(ms / 3600000)
      return { days: Math.floor(totalH / 24), hours: totalH % 24, hasTime: true }
    }
  }
  return { days: Math.max(0, days), hours: null, hasTime: false }
}

// Returns true if a timed event ended 2+ hours ago (triggers removal from the tile)
function isStale(dateStr, timeStr) {
  if (!timeStr) return false
  const t = new Date(dateStr + ' ' + timeStr)
  if (isNaN(t.getTime())) return false
  return (new Date() - t) >= 2 * 60 * 60 * 1000
}

// Flattens calendar days into individual events, sorted chronologically,
// and picks the top 2 — real events always win those two slots; a holiday
// only fills a slot when there's nothing else to show there.
function useTopEvents(calDays) {
  return useMemo(() => {
    const today    = new Date(); today.setHours(0,0,0,0)
    const todayStr = dateParts(today)

    const real = []
    calDays.filter(d => d.date >= todayStr).forEach(d => {
      ;(d.events || []).forEach(ev => {
        const t = ev.isAllDay === false && ev.startTime ? ev.startTime : null
        if (isStale(d.date, t)) return
        real.push({ date: d.date, time: t, name: evSummary(ev) })
      })
    })

    const byDateTime = (a, b) =>
      a.date === b.date ? (a.time || '').localeCompare(b.time || '') : a.date.localeCompare(b.date)
    real.sort(byDateTime)

    let merged = real.slice(0, 2)
    if (merged.length < 2) {
      const holidays = getNextUSHolidays(3).map(h => ({
        date: dateParts(h.date), time: null, name: h.name,
      }))
      merged = merged.concat(holidays.slice(0, 2 - merged.length)).sort(byDateTime)
    }

    return { hero: merged[0] ?? null, secondary: merged[1] ?? null }
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

// ── Hero card — today's (or the very next) headline event ──────
function HeroCard({ event }) {
  if (!event) {
    return (
      <div className="glance-hero-card glance-card-empty">
        <span className="glance-empty-msg">Nothing on the calendar</span>
      </div>
    )
  }
  const days    = daysFromToday(event.date)
  const eyebrow = days <= 0 ? 'TODAY' : days === 1 ? 'TOMORROW' : `IN ${days} DAYS`

  return (
    <div className="glance-hero-card">
      <div className="glance-hero-eyebrow">{eyebrow}</div>
      <div className="glance-hero-title">{event.name}</div>
      <div className="glance-hero-date">
        {fmtFull(event.date)}{event.time ? ` · ${event.time}` : ''}
      </div>
    </div>
  )
}

// ── Secondary card — what's coming up after that ────────────────
function SecondaryCard({ event }) {
  if (!event) {
    return (
      <div className="glance-secondary-card glance-card-empty">
        <span className="glance-empty-msg">Nothing else coming up</span>
      </div>
    )
  }
  const cd = getCountdown(event.date, event.time)

  return (
    <div className="glance-secondary-card">
      <div className="glance-secondary-title">{event.name}</div>
      <div className="glance-secondary-date">
        {fmtFull(event.date)}{event.time ? ` · ${event.time}` : ''}
      </div>
      {!cd.past && (
        <div className="glance-secondary-countdown">
          {cd.hasTime && cd.days === 0
            ? (cd.hours === 0 ? 'NOW' : `${cd.hours}h`)
            : (cd.days === 0 ? 'TODAY' : `${cd.days} ${cd.days === 1 ? 'day' : 'days'}`)}
        </div>
      )}
    </div>
  )
}

// ── Weather card — today's forecast, large ──────────────────────
function WeatherCard() {
  const { days, loading } = useWeather()
  const today = days[0]

  return (
    <div className="glance-weather-card">
      {loading ? (
        <span className="glance-empty-msg">Loading…</span>
      ) : today ? (
        <>
          <div className="glance-weather-icon">{today.icon}</div>
          <div className="glance-weather-temp">{today.temp}</div>
          <div className="glance-weather-cond">{today.condition}</div>
        </>
      ) : (
        <span className="glance-empty-msg">Weather unavailable</span>
      )}
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

  const { hero, secondary } = useTopEvents(calDays)

  return (
    <GlanceErrorBoundary>
      <div className="glance-content">
        <HeroCard event={hero} />
        <div className="glance-col-secondary">
          <SecondaryCard event={secondary} />
          <WeatherCard />
        </div>
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
