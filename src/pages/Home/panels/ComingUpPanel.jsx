import { useState, useEffect } from 'react'
import Panel, { PanelHeader } from '../../../components/Panel/Panel'
import { SCRIPTS, apiFetch } from '../../../api/scripts'
import { getDayDiff, countdownBadge, getNextUSHoliday, normalizeDate } from '../homeUtils'

function fmtDate(str) {
  const d = new Date(str + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function CountdownPill({ diff }) {
  const badge = countdownBadge(diff)
  if (!badge.text) return null
  return <span className={`countdown-badge ${badge.cls}`}>{badge.text}</span>
}

export default function ComingUpPanel() {
  const [nextUpEvts,   setNextUpEvts]   = useState([])
  const [nextWrestle,  setNextWrestle]  = useState(null)
  const [status,       setStatus]       = useState('loading')

  useEffect(() => {
    async function load() {
      // Load calendar upcoming events (independent — failure won't block wrestling)
      try {
        const calRes   = await apiFetch(SCRIPTS.CHORES + '?type=upcoming')
        const days     = await calRes.json()
        const todayStr = new Date().toISOString().slice(0,10)
        const allEvents = []
        if (Array.isArray(days)) {
          days.forEach(day => (day.events || []).forEach(name => allEvents.push({ date: day.date, name })))
        }
        const future = allEvents.filter(e => e.date >= todayStr).sort((a,b) => a.date.localeCompare(b.date))
        if (future.length) {
          const soonest = future[0].date
          setNextUpEvts(future.filter(e => e.date === soonest).sort((a,b) => a.name.localeCompare(b.name)))
        }
      } catch(e) {
        console.error('[ComingUp] CHORES fetch failed:', e)
      }

      // Load Tori wrestling events (independent — failure won't block calendar)
      try {
        const wrestleRes    = await apiFetch(SCRIPTS.TORI + '?type=events')
        const wrestleEvents = await wrestleRes.json()
        const wrestleArr = Array.isArray(wrestleEvents)
          ? wrestleEvents
          : (wrestleEvents?.result || wrestleEvents?.items || wrestleEvents?.data || [])
        const upcoming = wrestleArr
          .filter(e => e.date && getDayDiff(e.date) >= 0)
          .sort((a,b) => normalizeDate(a.date) - normalizeDate(b.date))
        if (upcoming.length) setNextWrestle(upcoming[0])
      } catch(e) {
        console.error('[ComingUp] TORI fetch failed:', e)
      }

      setStatus('ok')
    }
    load()
  }, [])

  const holiday = getNextUSHoliday()

  if (status === 'loading') {
    return (
      <Panel className="hg-comingup">
        <PanelHeader title={<span style={{ color: 'var(--accent)' }}>Coming Up Next</span>} />
        <div className="weekend-clear">Loading…</div>
      </Panel>
    )
  }

  return (
    <Panel className="hg-comingup">
      <PanelHeader title={<span style={{ color: 'var(--accent)' }}>Coming Up Next</span>} />

      <div className="fp-stack">
        {/* NEXT UP */}
        <div className="fp-row">
          <div className="fp-row-label" style={{ color: 'var(--accent)' }}>NEXT UP</div>
          {nextUpEvts.length ? (
            <>
              {nextUpEvts.map((e, i) => (
                <div key={i} className="fp-hero-item">
                  <div className="fp-hero-name">{e.name}</div>
                </div>
              ))}
              <div className="fp-hero-meta">
                {fmtDate(nextUpEvts[0].date)}&nbsp;
                <CountdownPill diff={getDayDiff(nextUpEvts[0].date)} />
              </div>
            </>
          ) : (
            <div className="fp-none">None</div>
          )}
        </div>

        <div className="fp-divider" />

        {/* NEXT EVENT */}
        <div className="fp-row">
          <div className="fp-row-label" style={{ color: 'var(--accent4)' }}>NEXT EVENT</div>
          {nextWrestle ? (
            <>
              <div className="fp-hero-item">
                <div className="fp-hero-type">{nextWrestle.type || 'Event'}</div>
                <div className="fp-hero-name">{nextWrestle.name}</div>
              </div>
              <div className="fp-hero-meta">
                {fmtDate(nextWrestle.date)}
                {nextWrestle.location ? ` · ${nextWrestle.location}` : ''}
                &nbsp;<CountdownPill diff={getDayDiff(nextWrestle.date)} />
              </div>
            </>
          ) : (
            <div className="fp-none">None</div>
          )}
        </div>

        <div className="fp-divider" />

        {/* NEXT HOLIDAY */}
        <div className="fp-row fp-row-holiday">
          {holiday && (
            <div className="fp-holiday-inner">
              <div className="fp-holiday-label">NEXT HOLIDAY</div>
              <div className="fp-holiday-name">{holiday.name}</div>
              <div className="fp-holiday-date">{fmtDate(holiday.date.toISOString().slice(0,10))}</div>
              <div style={{ marginTop: 5 }}>
                <CountdownPill diff={getDayDiff(holiday.date.toISOString().slice(0,10))} />
              </div>
            </div>
          )}
        </div>
      </div>
    </Panel>
  )
}
