import { useState, useEffect, useCallback, useMemo } from 'react'
import Panel, { PanelHeader } from '../Panel/Panel'
import { SCRIPTS, apiFetch } from '../../api/scripts'
import {
  evSummary, dateParts, classifyEvent, urgencyClass, countdownLabel, isStale,
} from '../../pages/Home/homeUtils'
import './UpcomingEventsList.css'

// ── Upcoming Events — And Stuff's "sit and plan" tile ────────────────
// Replaces the old 2-week day-grid with a flat, ranked list — same shape
// as At a Glance's Hero+Lookahead source list, just uncapped to the next
// 20 events instead of "next" + "next 7 days". A day grid is glanceable
// at a distance; here there's room to just list things out with a
// countdown per row, same as Glance's now-removed Upcoming tile did.

const EVENT_LIMIT = 20

function useUpcomingEvents(calDays) {
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

    return all.slice(0, EVENT_LIMIT)
  }, [calDays])
}

export default function UpcomingEventsList() {
  const [calDays, setCalDays] = useState([])

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(SCRIPTS.CHORES + '?type=upcoming&days=60').then(r => r.json())
      setCalDays(Array.isArray(data) ? data : [])
    } catch (e) { console.error('upcoming events load', e) }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 60 * 60 * 1000) // refresh every hour
    return () => clearInterval(id)
  }, [load])

  const events = useUpcomingEvents(calDays)

  return (
    <Panel className="uel-panel">
      <PanelHeader title="Upcoming Events" />
      {events.length === 0 ? (
        <div className="uel-empty">Nothing on the calendar</div>
      ) : (
        <div className="uel-list">
          {events.map((ev, i) => (
            <div
              key={`${ev.date}-${ev.title}-${i}`}
              className={`uel-row urgency-${urgencyClass(ev.date)}${ev.isSports ? ' is-sport' : ''}`}
            >
              {ev.isSports && <span className="uel-medal">🏅</span>}
              {ev.person && (
                <span className="uel-person" data-person={ev.person.toLowerCase()}>
                  {ev.person}
                </span>
              )}
              <span className="uel-title">{ev.title}</span>
              <span className="uel-when">
                {countdownLabel(ev.date)}
                {ev.time ? ` · ${ev.time}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
