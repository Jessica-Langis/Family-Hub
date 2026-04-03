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

const MONTHS      = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS_FULL   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function ordinal(n) {
  const v = n % 100
  return n + (['th','st','nd','rd'][(v - 20) % 10] || ['th','st','nd','rd'][v] || 'th')
}
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
        <span className="glance-ev-cd-days" style={{ color: accentColor }}>
          {cd.days === 0 ? 'TODAY' : `${cd.days} ${cd.days === 1 ? 'day' : 'days'}`}
        </span>
        {cd.hasTime && cd.hours != null && (
          <span className="glance-ev-cd-hours" style={{ color: accentColor, opacity: 0.65 }}>{cd.hours}h</span>
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

// ── 7-day week view panel ─────────────────────────────────────
// ── Day detail popup (matches CalendarPanel modal style) ──────────
function WeekDayModal({ dateStr, events, onClose }) {
  const d       = new Date(dateStr + 'T00:00:00')
  const fmtFull = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const diff    = Math.round((d - (() => { const t = new Date(); t.setHours(0,0,0,0); return t })()) / 86400000)
  const diffStr   = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : `In ${diff} days`
  const diffColor = diff === 0 ? 'var(--accent3)' : diff === 1 ? 'var(--accent2)' : 'var(--accent4)'

  return (
    <div className="fun-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fun-overlay-box" style={{ maxWidth: 380 }}>
        <button onClick={onClose} style={{ position:'absolute', top:14, right:16, background:'none', border:'none', color:'var(--muted)', fontSize:'1.1rem', cursor:'pointer' }}>✕</button>
        <div style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--accent2)', marginBottom:6, fontWeight:700 }}>📅 Family Events</div>
        <div style={{ fontSize:'1.05rem', fontWeight:700, color:'var(--text)', marginBottom:4 }}>{fmtFull}</div>
        <div style={{ fontSize:'0.78rem', color:diffColor, fontWeight:600, marginBottom:16 }}>{diffStr}</div>
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:4 }}>
          {events.map((ev, i) => {
            const name = evSummary(ev)
            const time = typeof ev === 'string' ? null : (ev.startTime || ev.time || null)
            return (
              <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:'var(--accent2)', flexShrink:0, marginTop:5 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'0.88rem', fontWeight:500, color:'var(--text)', lineHeight:1.4 }}>{name}</div>
                  <div style={{ fontSize:'0.7rem', color: time ? 'var(--accent)' : 'var(--muted)', marginTop:2 }}>{time || 'All day'}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function GlanceAgendaPanel({ calDays }) {
  const [selected, setSelected] = useState(null) // { dateStr, events }
  const today = new Date(); today.setHours(0,0,0,0)

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    const dateStr = dateParts(d)
    const calDay  = calDays.find(cd => cd.date === dateStr)
    return { date: d, dateStr, events: calDay?.events || [] }
  })

  return (
    <Panel className="glance-agenda-panel">
      <PanelHeader title="This Week" />
      <div className="glance-week-grid">
        {week.map(({ date, dateStr, events }, i) => {
          const dayName   = DAYS_FULL[date.getDay()]
          const dateShort = `${MONTHS[date.getMonth()]} ${date.getDate()}`
          const dateOrd   = `${MONTHS[date.getMonth()]} ${ordinal(date.getDate())}`
          const isToday   = i === 0
          const isWeekend = date.getDay() === 0 || date.getDay() === 6
          const hasEvents = events.length > 0

          let cls = 'glance-week-day'
          if (isToday)   cls += ' glance-week-today'
          if (isWeekend) cls += ' gwk-weekend'
          if (hasEvents) cls += ' gwk-has-events'

          return (
            <div
              key={dateStr}
              className={cls}
              onClick={hasEvents ? () => setSelected({ dateStr, events }) : undefined}
            >
              {/* Desktop: stacked header */}
              <div className="gwk-desktop-header">
                <span className="gwk-day-name">{dayName}</span>
                <span className="gwk-day-date">{dateShort}</span>
              </div>

              {/* Mobile: inline label "Monday Apr 3rd" */}
              <div className="gwk-mobile-label">
                <span className="gwk-day-name-mob">{dayName} {dateOrd}</span>
              </div>

              {/* Events — shared between both layouts */}
              <div className="gwk-events">
                {events.length === 0
                  ? <span className="gwk-no-events">—</span>
                  : events.map((ev, j) => (
                    <span key={j} className={`gwk-ev${isWeekend ? ' gwk-ev-weekend' : ''}`}>{evSummary(ev)}</span>
                  ))
                }
              </div>
            </div>
          )
        })}
      </div>

      {selected && (
        <WeekDayModal
          dateStr={selected.dateStr}
          events={selected.events}
          onClose={() => setSelected(null)}
        />
      )}
    </Panel>
  )
}
