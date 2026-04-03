import { useState, useEffect, useCallback, useLayoutEffect, useRef, Component } from 'react'
import Panel, { PanelHeader } from '../../components/Panel/Panel'
import { SCRIPTS, apiFetch } from '../../api/scripts'
import { getDayDiff, getNextUSHolidays } from '../Home/homeUtils'
import './Glance.css'

// ── helpers ───────────────────────────────────────────────────
function toArr(d) {
  if (Array.isArray(d)) return d
  if (d && Array.isArray(d.result)) return d.result
  if (d && Array.isArray(d.items))  return d.items
  if (d && Array.isArray(d.data))   return d.data
  return []
}

function evSummary(ev) {
  return typeof ev === 'string' ? ev : (ev.summary || ev.name || '')
}

function dateParts(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function toDateStr(di) {
  return di instanceof Date ? dateParts(di) : String(di)
}

// "Apr 09 2026" format
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtFull(dateInput) {
  const str = toDateStr(dateInput)
  const d = new Date(str + 'T00:00:00')
  if (isNaN(d.getTime())) return ''
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2,'0')} ${d.getFullYear()}`
}

// Returns { days, hours, hasTime } — hours only available when a time is provided
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

// ── Main page ─────────────────────────────────────────────────
export default function Glance() {
  const [calDays,   setCalDays]   = useState([])
  const [wrestling, setWrestling] = useState([])
  const [bulletin,  setBulletin]  = useState([])
  const [dinner,    setDinner]    = useState(null)

  const loadAll = useCallback(async () => {
    const [calRes, wrestleRes, bulletinRes, mealRes] = await Promise.allSettled([
      apiFetch(SCRIPTS.CHORES + '?type=upcoming&days=60').then(r => r.json()),
      apiFetch(SCRIPTS.TORI   + '?type=events').then(r => r.json()),
      apiFetch(SCRIPTS.CHORES + '?type=bulletin').then(r => r.json()),
      apiFetch(SCRIPTS.MEAL).then(r => r.json()),
    ])
    if (calRes.status     === 'fulfilled') setCalDays(Array.isArray(calRes.value)     ? calRes.value     : [])
    if (wrestleRes.status === 'fulfilled') setWrestling(toArr(wrestleRes.value))
    if (bulletinRes.status === 'fulfilled') setBulletin(Array.isArray(bulletinRes.value) ? bulletinRes.value : [])
    if (mealRes.status === 'fulfilled') {
      const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
      setDinner(mealRes.value?.[DAYS[new Date().getDay()]] || null)
    }
  }, [])

  useEffect(() => {
    loadAll()
    const id = setInterval(loadAll, 60 * 60 * 1000) // refresh every hour
    return () => clearInterval(id)
  }, [loadAll])

  return (
    <GlanceErrorBoundary>
      <div className="glance-content">
        <div className="glance-col-events">
          <EventsPanel calDays={calDays} wrestling={wrestling} />
        </div>
        <div className="glance-col-bulletin">
          <GlanceBulletinPanel notes={bulletin} dinner={dinner} />
        </div>
        <div className="glance-col-agenda">
          <GlanceAgendaPanel calDays={calDays} />
        </div>
      </div>
    </GlanceErrorBoundary>
  )
}

// ── Auto-sizing title — binary-searches for largest fitting font ──
function AutoSizeTitle({ text, color }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let lo = 0.55, hi = 2.8
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2
      el.style.fontSize = `${mid}rem`
      if (el.scrollWidth <= el.clientWidth) lo = mid
      else hi = mid
    }
    el.style.fontSize = `${(lo * 0.96).toFixed(3)}rem`
  }, [text])
  return <div ref={ref} className="glance-ev-title" style={{ color }}>{text}</div>
}

// ── 4-row event block ─────────────────────────────────────────
function EventBlock({ name, dateStr, timeStr, location, accentColor }) {
  const ds = toDateStr(dateStr)
  const cd = getCountdown(ds, timeStr)
  return (
    <div className="glance-ev-block">
      <AutoSizeTitle text={name} color={accentColor} />
      <div className="glance-ev-block-date">
        {fmtFull(dateStr)}{timeStr ? ` · ${timeStr}` : ''}
      </div>
      {location && <div className="glance-ev-block-loc">📍 {location}</div>}
      <div className="glance-ev-block-countdown">
        <span className="glance-ev-cd-days">{cd.days === 0 ? 'TODAY' : `${cd.days}d`}</span>
        {cd.hasTime && cd.hours != null && (
          <span className="glance-ev-cd-hours">{cd.hours}h</span>
        )}
      </div>
    </div>
  )
}

// ── Calendar cell — handles 1, 2, or 3+ events on the same day ─
function CalCell({ day, accentColor, secondary }) {
  const cls = `glance-split-half${secondary ? ' glance-split-secondary' : ''}`
  if (!day?.events?.length) {
    return <div className={cls}><span className="next-up-empty">None</span></div>
  }
  const evts   = day.events
  const getTime = ev => (ev.isAllDay === false && ev.startTime) ? ev.startTime : null
  const ev1    = evts[0]
  const ev2    = evts[1] ?? null
  const rest   = evts.slice(2)
  return (
    <div className={cls}>
      <EventBlock name={evSummary(ev1)} dateStr={day.date} timeStr={getTime(ev1)} accentColor={accentColor} />
      {ev2 && <>
        <div className="glance-ev-inner-divider" />
        <EventBlock name={evSummary(ev2)} dateStr={day.date} timeStr={getTime(ev2)} accentColor={accentColor} />
      </>}
      {rest.length > 0 && <>
        <div className="glance-ev-inner-divider" />
        <div className="glance-ev-rest">
          {rest.map((ev, i) => <div key={i} className="glance-ev-rest-item">· {evSummary(ev)}</div>)}
        </div>
      </>}
    </div>
  )
}

// ── Single-event cell (wrestling, holiday) ────────────────────
function SingleCell({ name, dateStr, timeStr, location, accentColor, secondary }) {
  const cls = `glance-split-half${secondary ? ' glance-split-secondary' : ''}`
  if (!name) return <div className={cls}><span className="next-up-empty">None</span></div>
  return (
    <div className={cls}>
      <EventBlock name={name} dateStr={dateStr} timeStr={timeStr} location={location} accentColor={accentColor} />
    </div>
  )
}

// ── Events panel ──────────────────────────────────────────────
function EventsPanel({ calDays, wrestling }) {
  const today    = new Date(); today.setHours(0,0,0,0)
  const todayStr = dateParts(today)

  const calWithEvents = calDays
    .filter(d => d.date >= todayStr && d.events?.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 2)

  const wrestleEvents = toArr(wrestling)
    .filter(e => e.date && getDayDiff(e.date) >= 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 2)

  const holidays = getNextUSHolidays(2)

  return (
    <Panel className="glance-events-panel">
      <PanelHeader title={<span style={{ color: 'var(--accent6)' }}>Events</span>} />
      <div className="glance-events-body">

        <div className="glance-ev-section">
          <div className="glance-section-label">Calendar</div>
          <div className="glance-card-row">
            <CalCell day={calWithEvents[0] ?? null} accentColor="var(--accent6)" />
            <div className="glance-split-divider" />
            <CalCell day={calWithEvents[1] ?? null} accentColor="var(--accent6)" secondary />
          </div>
        </div>

        <div className="glance-ev-section">
          <div className="glance-section-label" style={{ color: 'var(--accent4)' }}>Tori's Events</div>
          <div className="glance-card-row">
            <SingleCell
              name={wrestleEvents[0]?.name ?? null}
              dateStr={wrestleEvents[0]?.date}
              timeStr={wrestleEvents[0]?.time || wrestleEvents[0]?.startTime || null}
              location={wrestleEvents[0]?.location ?? null}
              accentColor="var(--accent4)"
            />
            <div className="glance-split-divider" />
            <SingleCell
              name={wrestleEvents[1]?.name ?? null}
              dateStr={wrestleEvents[1]?.date}
              timeStr={wrestleEvents[1]?.time || wrestleEvents[1]?.startTime || null}
              location={wrestleEvents[1]?.location ?? null}
              accentColor="var(--accent4)"
              secondary
            />
          </div>
        </div>

        <div className="glance-ev-section">
          <div className="glance-section-label" style={{ color: 'var(--accent2)' }}>Holidays</div>
          <div className="glance-card-row">
            <SingleCell
              name={holidays[0]?.name ?? null}
              dateStr={holidays[0]?.date ?? null}
              accentColor="var(--accent2)"
            />
            <div className="glance-split-divider" />
            <SingleCell
              name={holidays[1]?.name ?? null}
              dateStr={holidays[1]?.date ?? null}
              accentColor="var(--accent2)"
              secondary
            />
          </div>
        </div>

      </div>
    </Panel>
  )
}

// ── Bulletin panel (read-only mirror of Home) ─────────────────
const BULLETIN_FONTS = ['dancing','caveat','pacifico','satisfy','kalam','patrick']
function bulletinFont(row) {
  return BULLETIN_FONTS[Math.abs(row || 0) % BULLETIN_FONTS.length]
}

function GlanceBulletinNote({ item, isDinner }) {
  const color = isDinner ? 'teal' : (item.color || 'amber')
  const font  = isDinner ? 'dancing' : bulletinFont(item.row)
  let dateStr = ''
  if (item.date) {
    const d = new Date(item.date)
    if (!isNaN(d.getTime())) dateStr = `${d.getMonth()+1}/${d.getDate()}`
  }
  return (
    <div className="bulletin-item" data-color={color} data-font={font}>
      <div className="bulletin-inner">
        <div className={`bulletin-who${isDinner ? ' bulletin-dinner-who' : ''}`}>
          {isDinner ? "Tonight's Dinner" : (item.who || 'Someone')}
        </div>
        <div className={`bulletin-text${isDinner && !item.text ? ' empty-dinner' : ''}`}>
          {isDinner ? (item.text || 'Nothing planned yet') : (item.text || '')}
        </div>
        {dateStr && <div className="bulletin-date">{dateStr}</div>}
      </div>
    </div>
  )
}

function GlanceBulletinPanel({ notes, dinner }) {
  return (
    <Panel style={{ overflow: 'hidden', height: '100%' }}>
      <PanelHeader title="Bulletin Board" />
      <div className="home-bulletin-strip corkboard-body glance-bulletin-body">
        <GlanceBulletinNote item={{ text: dinner }} isDinner />
        {notes.slice(0, 14).map((b, i) => (
          <GlanceBulletinNote key={i} item={b} />
        ))}
        {notes.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: '0.82rem', padding: '4px 0' }}>
            Nothing posted yet
          </div>
        )}
      </div>
    </Panel>
  )
}

// ── Compact Agenda panel ──────────────────────────────────────
function GlanceAgendaPanel({ calDays }) {
  const today    = new Date(); today.setHours(0,0,0,0)
  const todayStr = dateParts(today)

  const filtered = calDays
    .filter(d => d.events?.length > 0 && d.date >= todayStr)
    .slice(0, 10)

  function fmtShort(dateStr) {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <Panel className="glance-agenda-panel">
      <PanelHeader title="Upcoming" />
      {filtered.length === 0 ? (
        <div className="glance-agenda-empty">Nothing coming up</div>
      ) : (
        <div className="glance-agenda-list">
          {filtered.map(day => {
            const diff = getDayDiff(day.date)
            const cls  = diff === 0 ? 'today' : diff <= 3 ? 'soon' : 'upcoming'
            const lbl  = diff === 0 ? 'Today' : diff === 1 ? 'Tmrw' : `${diff}d`
            return (
              <div key={day.date} className="glance-agenda-day">
                <div className="glance-agenda-date-row">
                  <span className="glance-agenda-date">{fmtShort(day.date)}</span>
                  <span className={`countdown-badge ${cls}`} style={{ fontSize: '0.58rem', padding: '1px 5px' }}>{lbl}</span>
                </div>
                {day.events.slice(0, 2).map((ev, i) => (
                  <div key={i} className="glance-agenda-ev">{evSummary(ev)}</div>
                ))}
                {day.events.length > 2 && (
                  <div className="glance-agenda-more">+{day.events.length - 2} more</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}
