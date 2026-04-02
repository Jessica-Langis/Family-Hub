import { useState, useEffect, useCallback, Component } from 'react'
import Panel, { PanelHeader } from '../../components/Panel/Panel'
import { SCRIPTS, apiFetch } from '../../api/scripts'
import { getDayDiff, getNextUSHoliday, countdownBadge } from '../Home/homeUtils'
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

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function dateParts(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
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

// ── Events panel ──────────────────────────────────────────────
function EventsPanel({ calDays, wrestling }) {
  const today    = new Date(); today.setHours(0,0,0,0)
  const todayStr = dateParts(today)

  // ── Section 1: Next Event (calendar + holiday only) ──
  const holiday    = getNextUSHoliday()
  const holidayStr = holiday ? dateParts(holiday.date) : null

  // Map calendar events by date for fast lookup
  const calByDate = {}
  calDays.forEach(day => {
    if (day.date >= todayStr && day.events?.length) calByDate[day.date] = day.events
  })

  // Find soonest date
  const calDates = Object.keys(calByDate).sort()
  let soonestDate = calDates[0] || null
  if (holidayStr) {
    if (!soonestDate || holidayStr < soonestDate) soonestDate = holidayStr
  }

  // Build combined event list for soonest date
  let nextEvents = []
  if (soonestDate) {
    const calEvts = calByDate[soonestDate] || []
    calEvts.forEach(ev => {
      const isAllDay = ev.isAllDay !== false
      nextEvents.push({
        name:     evSummary(ev),
        isAllDay,
        time:     !isAllDay ? (ev.startTime || null) : null,
      })
    })
    if (holidayStr === soonestDate) {
      nextEvents.push({ name: holiday.name, isAllDay: true, time: null })
    }
    // Sort: all-day first, then A-Z
    nextEvents.sort((a, b) => {
      if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }

  // ── Section 2: Wrestling events (next 2) ──
  const upcomingWrestle = toArr(wrestling)
    .filter(e => e.date && getDayDiff(e.date) >= 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 2)

  return (
    <Panel className="glance-events-panel">
      <PanelHeader title={<span style={{ color: 'var(--accent6)' }}>Events</span>} />

      <div className="glance-events-body">
        {/* ── Next Event ── */}
        <div className="glance-section-label">Next Up</div>

        {soonestDate ? (
          <div className="glance-next-event">
            <div className="glance-next-date-row">
              <span className="glance-next-date">{fmtDate(soonestDate)}</span>
              {(() => {
                const b = countdownBadge(getDayDiff(soonestDate))
                return b.text ? <span className={`countdown-badge ${b.cls}`}>{b.text}</span> : null
              })()}
            </div>
            <div className="glance-event-list">
              {nextEvents.map((ev, i) => (
                <div key={i} className={`glance-event-row${ev.isAllDay ? ' allday' : ''}`}>
                  <span className="glance-event-dot" />
                  <span className="glance-event-name">{ev.name}</span>
                  {ev.time
                    ? <span className="glance-event-time">{ev.time}</span>
                    : <span className="glance-allday-tag">All Day</span>
                  }
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="glance-empty">Nothing coming up</div>
        )}

        <div className="glance-divider" />

        {/* ── Tori's Wrestling Events ── */}
        <div className="glance-section-label" style={{ color: 'var(--accent4)' }}>Tori's Events</div>

        {upcomingWrestle.length === 0 ? (
          <div className="glance-empty">No events scheduled</div>
        ) : (
          <div className="glance-wrestle-list">
            {upcomingWrestle.map((ev, i) => {
              const b = countdownBadge(getDayDiff(ev.date))
              return (
                <div key={ev.id ?? i} className={`glance-wrestle-item${i === 0 ? ' primary' : ' secondary'}`}>
                  <div className="glance-wrestle-top">
                    <span className="glance-wrestle-name">{ev.name}</span>
                    {b.text && <span className={`countdown-badge ${b.cls}`}>{b.text}</span>}
                  </div>
                  {ev.type && <div className="glance-wrestle-type">{ev.type}</div>}
                  <div className="glance-wrestle-meta">
                    <span className="glance-wrestle-date">{fmtDate(ev.date)}</span>
                    {ev.location && <span className="glance-wrestle-loc">📍 {ev.location}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
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
      <div className="home-bulletin-strip corkboard-body">
        <GlanceBulletinNote item={{ text: dinner }} isDinner />
        {notes.slice(0, 4).map((b, i) => (
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
