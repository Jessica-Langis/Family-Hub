import { useState, useEffect, useCallback, Component } from 'react'
import Panel, { PanelHeader } from '../../components/Panel/Panel'
import { SCRIPTS, apiFetch } from '../../api/scripts'
import { getDayDiff, getNextUSHolidays, countdownBadge } from '../Home/homeUtils'
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

// "Apr 9" format — accepts date string or Date object
function fmtMed(dateInput) {
  const str = dateInput instanceof Date
    ? dateParts(dateInput)
    : String(dateInput)
  const d = new Date(str + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// date string from either string or Date
function toDateStr(dateInput) {
  return dateInput instanceof Date ? dateParts(dateInput) : String(dateInput)
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

// ── Split half — shared inner cell for all row types ──────────
function SplitHalf({ primary, nameColor, name, type, dateStr, location, dateInput }) {
  const diff = dateInput != null ? getDayDiff(toDateStr(dateInput)) : NaN
  const b    = countdownBadge(diff)
  const cls  = `glance-split-half${primary ? ' glance-split-primary' : ' glance-split-secondary'}`

  if (!name) {
    return (
      <div className={cls}>
        <span className="next-up-empty">None</span>
      </div>
    )
  }

  return (
    <div className={cls}>
      <div className="next-up-name" style={{ color: nameColor }}>{name}</div>
      {type     && <div className="next-up-type">{type}</div>}
      {dateStr  && <div className="next-up-date">{dateStr}</div>}
      {location && <div className="next-up-loc">📍 {location}</div>}
      {b.text   && <span className={`countdown-badge ${b.cls}`}>{b.text}</span>}
    </div>
  )
}

// ── Events panel ──────────────────────────────────────────────
function EventsPanel({ calDays, wrestling }) {
  const today    = new Date(); today.setHours(0,0,0,0)
  const todayStr = dateParts(today)

  // Next 2 calendar days with events
  const calWithEvents = calDays
    .filter(d => d.date >= todayStr && d.events?.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 2)

  // Next 2 wrestling events
  const wrestleEvents = toArr(wrestling)
    .filter(e => e.date && getDayDiff(e.date) >= 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 2)

  // Next 2 holidays
  const holidays = getNextUSHolidays(2)

  // Build props for each cell
  function calProps(day) {
    if (!day) return { name: null }
    const evts  = day.events || []
    const first = evts[0] ? evSummary(evts[0]) : null
    const name  = evts.length > 1 ? `${first} +${evts.length - 1}` : first
    return { name, dateStr: fmtMed(day.date), dateInput: day.date }
  }

  function wrestleProps(ev) {
    if (!ev) return { name: null }
    return { name: ev.name, type: ev.type || null, dateStr: fmtMed(ev.date), location: ev.location || null, dateInput: ev.date }
  }

  function holidayProps(h) {
    if (!h) return { name: null }
    return { name: h.name, dateStr: fmtMed(h.date), dateInput: h.date }
  }

  return (
    <Panel className="glance-events-panel">
      <PanelHeader title={<span style={{ color: 'var(--accent6)' }}>Events</span>} />

      <div className="glance-events-body">

        <div className="glance-ev-section">
          <div className="glance-section-label">Calendar</div>
          <div className="glance-card-row">
            <SplitHalf primary nameColor="var(--accent6)" {...calProps(calWithEvents[0] ?? null)} />
            <div className="glance-split-divider" />
            <SplitHalf nameColor="var(--accent6)" {...calProps(calWithEvents[1] ?? null)} />
          </div>
        </div>

        <div className="glance-ev-section">
          <div className="glance-section-label" style={{ color: 'var(--accent4)' }}>Tori's Events</div>
          <div className="glance-card-row">
            <SplitHalf primary nameColor="var(--accent4)" {...wrestleProps(wrestleEvents[0] ?? null)} />
            <div className="glance-split-divider" />
            <SplitHalf nameColor="var(--accent4)" {...wrestleProps(wrestleEvents[1] ?? null)} />
          </div>
        </div>

        <div className="glance-ev-section">
          <div className="glance-section-label" style={{ color: 'var(--accent2)' }}>Holidays</div>
          <div className="glance-card-row">
            <SplitHalf primary nameColor="var(--accent2)" {...holidayProps(holidays[0] ?? null)} />
            <div className="glance-split-divider" />
            <SplitHalf nameColor="var(--accent2)" {...holidayProps(holidays[1] ?? null)} />
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
