import { useState, useEffect } from 'react'
import Panel, { PanelHeader } from '../../../components/Panel/Panel'
import { SCRIPTS, apiFetch } from '../../../api/scripts'
import { getDayDiff, countdownBadge } from '../homeUtils'

const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

// Events can be plain strings or objects { name, time }
function evName(ev) { return typeof ev === 'string' ? ev : (ev.summary || ev.name || '') }
function evTime(ev) { return typeof ev === 'string' ? null : (ev.startTime || ev.time || null) }

function DayDetailModal({ dateStr, events, onClose }) {
  const d = new Date(dateStr + 'T00:00:00')
  const fmtFull = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const diff = getDayDiff(dateStr)
  const diffStr = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : `In ${diff} days`
  const diffColor = diff === 0 ? 'var(--accent3)' : diff === 1 ? 'var(--accent2)' : 'var(--accent4)'

  return (
    <div className="fun-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fun-overlay-box" style={{ maxWidth: 380 }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 16, background: 'none', border: 'none', color: 'var(--muted)', fontSize: '1.1rem', cursor: 'pointer' }}>✕</button>
        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent2)', marginBottom: 6, fontWeight: 700 }}>📅 Family Events</div>
        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{fmtFull}</div>
        <div style={{ fontSize: '0.78rem', color: diffColor, fontWeight: 600, marginBottom: 16 }}>{diffStr}</div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 4 }}>
          {events.map((ev, i) => {
            const name = evName(ev)
            const time = evTime(ev)
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent2)', flexShrink: 0, marginTop: 5 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text)', lineHeight: 1.4 }}>{name}</div>
                  <div style={{ fontSize: '0.7rem', color: time ? 'var(--accent)' : 'var(--muted)', marginTop: 2 }}>
                    {time || 'All day'}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function CalendarPanel() {
  const [eventMap,  setEventMap]  = useState({})
  const [rangeLabel, setRange]    = useState('')
  const [selected,  setSelected]  = useState(null) // { dateStr, events }
  const [status,    setStatus]    = useState('loading')

  async function load() {
    setStatus('loading')
    try {
      const res  = await apiFetch(SCRIPTS.CHORES + '?type=upcoming&days=28')
      const days = await res.json()
      const map  = {}
      if (Array.isArray(days)) {
        days.forEach(day => { if (day.events?.length) map[day.date] = day.events })
      }

      setEventMap(map)
      setStatus('ok')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => { load() }, [])

  // Build 4-week grid
  const today = new Date(); today.setHours(0,0,0,0)
  const startDate = new Date(today)
  startDate.setDate(today.getDate() - today.getDay()) // back to Sunday
  const endDate = new Date(startDate); endDate.setDate(startDate.getDate() + 27)

  const fmtShort = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const rangeStr = `${fmtShort(today)} – ${fmtShort(endDate)}`

  const m1 = MONTH_NAMES[startDate.getMonth()], m2 = MONTH_NAMES[endDate.getMonth()]
  const yr1 = startDate.getFullYear(), yr2 = endDate.getFullYear()
  const monthLabel = m1 === m2 ? `${m1} ${yr1}` : yr1 === yr2 ? `${m1} / ${m2} ${yr1}` : `${m1} ${yr1} / ${m2} ${yr2}`

  const cells = []
  for (let i = 0; i < 28; i++) {
    const dateObj = new Date(startDate); dateObj.setDate(startDate.getDate() + i)
    const dateStr = dateObj.toISOString().slice(0,10)
    const isToday    = dateObj.getTime() === today.getTime()
    const isPast     = dateObj < today
    const isWeekend  = dateObj.getDay() === 0 || dateObj.getDay() === 6
    const events     = eventMap[dateStr] || []
    const hasEvents  = events.length > 0

    let cls = 'cal-day'
    if (isToday)   cls += ' cal-today'
    if (isPast)    cls += ' cal-past'
    if (isWeekend) cls += ' cal-weekend'
    if (hasEvents) cls += ' cal-has-events'

    cells.push({ dateObj, dateStr, isToday, cls, events, hasEvents })
  }

  return (
    <Panel className="hg-calendar">
      <PanelHeader
        title="Family Calendar"
        badge={rangeStr}
        actions={
          <button className="clear-btn" onClick={load} style={{ fontSize: '0.7rem' }}>↻</button>
        }
      />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {status === 'error' && <div style={{ color: 'var(--muted)', fontSize: '0.8rem', padding: '8px 12px' }}>Unavailable</div>}
        {status !== 'error' && (
          <div className="cal-wrap">
            <div className="cal-month-label">{monthLabel}</div>
            <div className="cal-grid">
              {DOW.map(d => <div key={d} className="cal-dow">{d}</div>)}
              {cells.map(({ dateObj, dateStr, cls, events, hasEvents }) => (
                <div
                  key={dateStr}
                  className={cls}
                  onClick={hasEvents ? () => setSelected({ dateStr, events }) : undefined}
                >
                  <span className="cal-day-num">{dateObj.getDate()}</span>
                  {events.length > 0 && (
                    <div className="cal-pills">
                      {events.slice(0, 2).map((ev, i) => (
                        <div key={i} className="cal-pill">{evName(ev)}</div>
                      ))}
                      {events.length > 2 && <div className="cal-pill-more">+{events.length - 2}</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {selected && (
        <DayDetailModal
          dateStr={selected.dateStr}
          events={selected.events}
          onClose={() => setSelected(null)}
        />
      )}
    </Panel>
  )
}
