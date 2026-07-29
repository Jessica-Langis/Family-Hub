import { useState, useEffect, useCallback } from 'react'
import Panel, { PanelHeader } from '../Panel/Panel'
import { SCRIPTS, apiFetch } from '../../api/scripts'
import './TwoWeekCalendar.css'

// ── Two-week calendar tile ───────────────────────────────────────────
// Moved here from At a Glance during the At a Glance decluttering pass —
// a 14-day grid is "sit and plan" content, not "glance" content, so it
// now lives on And Stuff as a lower supplementary tile instead. Glanceable
// per-day (short event titles), click any day for the full list.

function evSummary(ev) {
  return typeof ev === 'string' ? ev : (ev.summary || ev.name || '')
}
function dateParts(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
const MONTHS    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function ordinal(n) {
  const v = n % 100
  return n + (['th','st','nd','rd'][(v - 20) % 10] || ['th','st','nd','rd'][v] || 'th')
}

function DayModal({ dateStr, events, onClose }) {
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

export default function TwoWeekCalendar() {
  const [calDays, setCalDays] = useState([])
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(SCRIPTS.CHORES + '?type=upcoming&days=14').then(r => r.json())
      setCalDays(Array.isArray(data) ? data : [])
    } catch (e) { console.error('two-week calendar load', e) }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 60 * 60 * 1000) // refresh every hour
    return () => clearInterval(id)
  }, [load])

  const today = new Date(); today.setHours(0,0,0,0)
  const week = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    const dateStr = dateParts(d)
    const calDay  = calDays.find(cd => cd.date === dateStr)
    return { date: d, dateStr, events: calDay?.events || [] }
  })

  return (
    <Panel className="twowk-panel">
      <PanelHeader title="Next 2 Weeks" />
      <div className="twowk-grid">
        {week.map(({ date, dateStr, events }, i) => {
          const dayName   = DAYS_FULL[date.getDay()]
          const dateShort = `${MONTHS[date.getMonth()]} ${date.getDate()}`
          const dateOrd   = `${MONTHS[date.getMonth()]} ${ordinal(date.getDate())}`
          const isToday   = i === 0
          const isWeekend = date.getDay() === 0 || date.getDay() === 6
          const hasEvents = events.length > 0

          let cls = 'twowk-day'
          if (isToday)   cls += ' twowk-today'
          if (isWeekend) cls += ' twowk-weekend'
          if (hasEvents) cls += ' twowk-has-events'

          return (
            <div
              key={dateStr}
              className={cls}
              onClick={hasEvents ? () => setSelected({ dateStr, events }) : undefined}
            >
              <div className="twowk-desktop-header">
                <span className="twowk-day-name">{dayName}</span>
                <span className="twowk-day-date">{dateShort}</span>
              </div>

              <div className="twowk-mobile-label">
                <span className="twowk-day-name-mob">{dayName} {dateOrd}</span>
              </div>

              <div className="twowk-events">
                {events.length === 0
                  ? <span className="twowk-no-events">—</span>
                  : events.slice(0, 2).map((ev, j) => (
                    <span key={j} className={`twowk-ev${isWeekend ? ' twowk-ev-weekend' : ''}`}>{evSummary(ev)}</span>
                  ))
                }
                {events.length > 2 && (
                  <span className="twowk-more">+{events.length - 2} more</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {selected && (
        <DayModal
          dateStr={selected.dateStr}
          events={selected.events}
          onClose={() => setSelected(null)}
        />
      )}
    </Panel>
  )
}
