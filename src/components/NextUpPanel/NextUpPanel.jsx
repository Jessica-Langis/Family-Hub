import { useState, useEffect, useCallback } from 'react'
import Panel, { PanelHeader } from '../Panel/Panel'
import { SCRIPTS, apiFetch } from '../../api/scripts'
import { getDayDiff, formatDateShort, parsePersonEvent } from '../../pages/Home/homeUtils'
import './NextUpPanel.css'

// ── Shared "Next Up" panel ──────────────────────────────────────────
// Merges a kid's own manually-added events with any family-calendar event
// tagged "Name - ..." and shows whichever is soonest (top 1-2). Originally
// built for Tori; Nova previously had two separate tiles doing overlapping
// jobs (a "Today" list from his own events, plus a separate big-number
// "Countdown" hero from tagged calendar events) — this consolidates both
// pages onto the one pattern instead of Nova having a redundant pair.
//
// Props: name ('Tori' | 'Nova'), script (SCRIPTS.TORI | SCRIPTS.NOVA)

function toArr(d) {
  if (Array.isArray(d)) return d
  if (d && Array.isArray(d.result)) return d.result
  if (d && Array.isArray(d.items))  return d.items
  if (d && Array.isArray(d.data))   return d.data
  return []
}

function choreBadgeCls(dateStr) {
  const diff = getDayDiff(dateStr)
  if (isNaN(diff)) return 'upcoming'
  if (diff < 0)    return 'past'
  if (diff === 0)  return 'today'
  if (diff <= 7)   return 'soon'
  return 'upcoming'
}

export default function NextUpPanel({ name, script }) {
  const [manualEvents, setManualEvents] = useState([])
  const [calEvents, setCalEvents]       = useState([])
  const [loading, setLoading]           = useState(true)
  const [showAdd, setShowAdd]           = useState(false)
  const [form, setForm]                 = useState({ name: '', evtType: '', date: '', location: '' })
  const [saving, setSaving]             = useState(false)

  const loadManual = useCallback(async () => {
    try {
      const res  = await apiFetch(`${script}?type=events`)
      const data = await res.json()
      setManualEvents(toArr(data))
    } catch (e) { console.error(`${name} events`, e) }
  }, [script, name])

  const loadCalendar = useCallback(async () => {
    try {
      const res  = await apiFetch(`${SCRIPTS.CHORES}?type=upcoming&days=365`)
      const data = await res.json()
      const found = toArr(data)
        .flatMap(d => (d.events || []).map(ev => ({ summary: ev.summary, date: d.date, location: ev.location })))
        .map(ev => {
          const title = parsePersonEvent(ev.summary, name)
          return title ? { id: `cal-${ev.date}-${title}`, name: title, date: ev.date, location: ev.location, type: '' } : null
        })
        .filter(Boolean)
      setCalEvents(found)
    } catch (e) { console.error(`${name} calendar countdown`, e) }
  }, [name])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadManual(), loadCalendar()]).finally(() => setLoading(false))
  }, [loadManual, loadCalendar])

  const upcoming = [...toArr(manualEvents), ...calEvents]
    .filter(e => getDayDiff(e.date) >= 0)
    .sort((a, b) => getDayDiff(a.date) - getDayDiff(b.date))

  const next  = upcoming[0] || null
  const next2 = upcoming[1] || null

  async function addEvent() {
    if (!form.name || !form.date) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('action', 'add')
      fd.append('type', 'events')
      fd.append('name', form.name)
      fd.append('evtType', form.evtType)
      fd.append('date', form.date)
      fd.append('location', form.location)
      await apiFetch(script, { method: 'POST', body: fd })
      setForm({ name: '', evtType: '', date: '', location: '' })
      setShowAdd(false)
      loadManual()
    } catch (e) { console.error('add event', e) }
    finally { setSaving(false) }
  }

  return (
    <>
      <Panel>
        <PanelHeader
          title="Next Up"
          actions={<button className="add-btn" onClick={() => setShowAdd(true)}>+ add</button>}
        />
        {loading
          ? <div className="next-up-hero"><span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Loading…</span></div>
          : next
            ? <div className="next-up-split-hero">
                <div className="next-up-primary">
                  <div className="next-up-name">{next.name}</div>
                  {next.type && <div className="next-up-type">{next.type}</div>}
                  <div className="next-up-date">{formatDateShort(next.date)}</div>
                  {next.location && <div className="next-up-loc">📍 {next.location}</div>}
                  <span className={`countdown-badge ${choreBadgeCls(next.date)}`}>
                    {(() => {
                      const d = getDayDiff(next.date)
                      if (d === 0) return 'TODAY'
                      if (d < 0)  return `${Math.abs(d)}d ago`
                      return `${d}d away`
                    })()}
                  </span>
                </div>

                {next2 && <>
                  <div className="next-up-divider" />
                  <div className="next-up-secondary">
                    <div className="next-up-name next-up-name-sm">{next2.name}</div>
                    {next2.type && <div className="next-up-type">{next2.type}</div>}
                    <div className="next-up-date">{formatDateShort(next2.date)}</div>
                    {next2.location && <div className="next-up-loc">📍 {next2.location}</div>}
                    <span className={`countdown-badge ${choreBadgeCls(next2.date)}`}>
                      {(() => {
                        const d = getDayDiff(next2.date)
                        if (d === 0) return 'TODAY'
                        if (d < 0)  return `${Math.abs(d)}d ago`
                        return `${d}d away`
                      })()}
                    </span>
                  </div>
                </>}
              </div>
            : <div className="next-up-hero"><div className="next-up-empty">No upcoming events</div></div>
        }
      </Panel>

      {showAdd && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="overlay-box">
            <div className="overlay-title">Add Event</div>
            <input className="overlay-input" placeholder="Event name" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <input className="overlay-input" placeholder="Type (e.g. Meet, Tournament)" value={form.evtType}
              onChange={e => setForm(f => ({ ...f, evtType: e.target.value }))} />
            <input className="overlay-input" type="date" value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            <input className="overlay-input" placeholder="Location (optional)" value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            <div className="overlay-actions">
              <button className="overlay-btn cancel" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="overlay-btn submit" onClick={addEvent} disabled={saving || !form.name || !form.date}>
                {saving ? 'Saving…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
