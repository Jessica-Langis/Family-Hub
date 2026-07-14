import { useState, useEffect, useCallback, Component } from 'react'
import Panel, { PanelHeader } from '../../components/Panel/Panel'
import WishlistPanel from '../../components/WishlistPanel/WishlistPanel'
import { SCRIPTS, apiFetch } from '../../api/scripts'
import { getDayDiff, formatDateShort, formatReminderDate, parsePersonEvent } from '../Home/homeUtils'
import './Tori.css'

// ── Normalize API response → array ───────────────────────────
// GAS can return bare arrays, or wrapped like {result:[...]}, {items:[...]}, etc.
function toArr(d) {
  if (Array.isArray(d)) return d
  if (d && Array.isArray(d.result)) return d.result
  if (d && Array.isArray(d.items))  return d.items
  if (d && Array.isArray(d.data))   return d.data
  return []
}

// Case/whitespace-insensitive "who" match — chores added from the old
// legacy dashboard (and the free-text "assigned to" field on And Stuff)
// can have who="Tori" or " tori " etc.
function isWho(c, name) {
  return (c.who || '').trim().toLowerCase() === name
}

// ── Error boundary ────────────────────────────────────────────
class ToriErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '20px', color: 'var(--muted)', fontSize: '0.85rem' }}>
          <div style={{ color: '#e07070', marginBottom: 8 }}>⚠ Tori page crashed</div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>
            {this.state.error?.message}
          </div>
          <button
            style={{ marginTop: 12, padding: '4px 12px', background: 'var(--surface2)',
              border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)',
              cursor: 'pointer', fontSize: '0.8rem' }}
            onClick={() => this.setState({ error: null })}
          >Retry</button>
        </div>
      )
    }
    return this.props.children
  }
}

// ── helpers ──────────────────────────────────────────────────
function choreBadgeCls(dateStr) {
  const diff = getDayDiff(dateStr)
  if (isNaN(diff)) return 'upcoming'
  if (diff < 0)    return 'past'
  if (diff === 0)  return 'today'
  if (diff <= 7)   return 'soon'
  return 'upcoming'
}

// ── Main tab ──────────────────────────────────────────────────
export default function Tori() {
  return (
    <ToriErrorBoundary>
      <div className="tori-content">
        <div className="ta-nextup"><NextUpPanel /></div>
        <div className="ta-reminders"><RemindersPanel /></div>
        <div className="ta-todo-col">
          <div className="ta-todo"><TodoPanel /></div>
          <div className="ta-wishlist"><WishlistPanel type="tori_wishlist" /></div>
        </div>
      </div>
    </ToriErrorBoundary>
  )
}

// ── Next Up panel — merges Tori's manual events with any family- ─
// calendar event tagged "Tori - ..."; shows whichever is soonest.
function NextUpPanel() {
  const [manualEvents, setManualEvents] = useState([])
  const [calEvents, setCalEvents]       = useState([])
  const [loading, setLoading]           = useState(true)
  const [showAdd, setShowAdd]           = useState(false)
  const [form, setForm]                 = useState({ name: '', evtType: '', date: '', location: '' })
  const [saving, setSaving]             = useState(false)

  const loadManual = useCallback(async () => {
    try {
      const res  = await apiFetch(`${SCRIPTS.TORI}?type=events`)
      const data = await res.json()
      setManualEvents(toArr(data))
    } catch (e) { console.error('tori events', e) }
  }, [])

  const loadCalendar = useCallback(async () => {
    try {
      const res  = await apiFetch(`${SCRIPTS.CHORES}?type=upcoming&days=365`)
      const data = await res.json()
      const found = toArr(data)
        .flatMap(d => (d.events || []).map(ev => ({ summary: ev.summary, date: d.date, location: ev.location })))
        .map(ev => {
          const title = parsePersonEvent(ev.summary, 'Tori')
          return title ? { id: `cal-${ev.date}-${title}`, name: title, date: ev.date, location: ev.location, type: '' } : null
        })
        .filter(Boolean)
      setCalEvents(found)
    } catch (e) { console.error('tori calendar countdown', e) }
  }, [])

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
      await apiFetch(SCRIPTS.TORI, { method: 'POST', body: fd })
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
                {/* Primary event — left */}
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

                {/* Second event — right, slightly smaller */}
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

// ── Reminders panel ───────────────────────────────────────────
function RemindersPanel() {
  const [reminders, setReminders] = useState([])
  const [loading, setLoading]     = useState(true)
  const [showAdd, setShowAdd]     = useState(false)
  const [form, setForm]           = useState({ text: '', date: '' })
  const [saving, setSaving]       = useState(false)

  const load = useCallback(async () => {
    try {
      const res  = await apiFetch(`${SCRIPTS.TORI}?type=reminders`)
      const data = await res.json()
      setReminders(toArr(data))
    } catch (e) { console.error('reminders load', e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function addReminder() {
    if (!form.text) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('action', 'add')
      fd.append('type', 'reminders')
      fd.append('text', form.text)
      fd.append('date', form.date)
      await apiFetch(SCRIPTS.TORI, { method: 'POST', body: fd })
      setForm({ text: '', date: '' })
      setShowAdd(false)
      load()
    } catch (e) { console.error('add reminder', e) }
    finally { setSaving(false) }
  }

  async function deleteReminder(id) {
    setReminders(r => r.filter(x => x.id !== id))
    try {
      const fd = new FormData()
      fd.append('action', 'delete')
      fd.append('type', 'reminders')
      fd.append('idx', id)
      await apiFetch(SCRIPTS.TORI, { method: 'POST', body: fd })
    } catch (e) { console.error('delete reminder', e); load() }
  }

  return (
    <>
      <Panel>
        <PanelHeader
          title="Reminders"
          actions={<button className="add-btn" onClick={() => setShowAdd(true)}>+ add</button>}
        />
        {loading
          ? <div className="reminder-empty">Loading…</div>
          : reminders.length === 0
            ? <div className="reminder-empty">Nothing to remember right now!</div>
            : <div className="reminder-list">
                {reminders.map((r, i) => (
                  <div key={r.id ?? i} className="reminder-item">
                    <span className="reminder-dot" />
                    <span className="reminder-text">{r.text}</span>
                    {r.date && <span className="reminder-date">{formatReminderDate(r.date)}</span>}
                    <button className="reminder-delete" onClick={() => deleteReminder(r.id)}>×</button>
                  </div>
                ))}
              </div>
        }
      </Panel>

      {showAdd && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="overlay-box">
            <div className="overlay-title">Add Reminder</div>
            <input className="overlay-input" placeholder="What to remember?" value={form.text}
              onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addReminder()} autoFocus />
            <input className="overlay-input" type="date" value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            <div className="overlay-actions">
              <button className="overlay-btn cancel" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="overlay-btn submit" onClick={addReminder} disabled={saving || !form.text}>
                {saving ? 'Saving…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── To Do panel (Tori's chores) ───────────────────────────────
const WEIGHT_LABELS = { 1: 'Easy', 2: 'Medium', 3: 'Hard' }

function TodoPanel() {
  const [chores, setChores]   = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm]       = useState({ name: '', dueDate: '', weight: 2 })
  const [saving, setSaving]   = useState(false)

  const points = chores.reduce((sum, c) => sum + (c.done ? (c.weight || 1) : 0), 0)

  const load = useCallback(async () => {
    try {
      const res  = await apiFetch(`${SCRIPTS.CHORES}?type=chores`)
      const data = await res.json()
      const filtered = toArr(data)
        .filter(c => isWho(c, 'tori'))
        .sort((a, b) => {
          const da = getDayDiff(a.dueDate), db = getDayDiff(b.dueDate)
          if (isNaN(da) && isNaN(db)) return 0
          if (isNaN(da)) return 1
          if (isNaN(db)) return -1
          return da - db
        })
      setChores(filtered)
    } catch (e) { console.error('tori chores', e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function toggle(id, done) {
    const updated = chores.map(c => c.id === id ? { ...c, done: !done } : c)
    setChores(updated)
    try {
      const fd = new FormData()
      fd.append('action', 'toggle')
      fd.append('type', 'chores')
      fd.append('idx', String(id))
      fd.append('done', String(!done))
      await apiFetch(SCRIPTS.CHORES, { method: 'POST', body: fd })
    } catch (e) { console.error('toggle', e); setChores(chores) }
  }

  async function addItem() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('action', 'add')
      fd.append('type', 'chores')
      fd.append('name', form.name.trim())
      fd.append('who', 'tori')
      fd.append('dueDate', form.dueDate)
      fd.append('weight', String(form.weight))
      await apiFetch(SCRIPTS.CHORES, { method: 'POST', body: fd })
      setForm({ name: '', dueDate: '', weight: 2 })
      setShowAdd(false)
      load()
    } catch (e) { console.error('add chore', e) }
    finally { setSaving(false) }
  }

  return (
    <>
      <Panel>
        <PanelHeader
          title="To Do"
          badge={points > 0 ? `🏆 ${points} pts` : null}
          actions={<button className="add-btn" onClick={() => setShowAdd(true)}>+ add</button>}
        />
        {loading
          ? <div className="chore-empty">Loading…</div>
          : chores.length === 0
            ? <div className="chore-empty">All done!</div>
            : <div className="chore-list">
                {chores.map((c, i) => {
                  const badge = c.dueDate ? choreBadgeCls(c.dueDate) : null
                  return (
                    <div key={c.id ?? i} className="chore-item" style={{ cursor: 'pointer' }}
                      onClick={() => toggle(c.id, !!c.done)}>
                      <span className={`chore-item-name${c.done ? ' done' : ''}`}>{c.name}</span>
                      <span className="chore-item-weight" title={WEIGHT_LABELS[c.weight || 1]}>
                        {'★'.repeat(c.weight || 1)}
                      </span>
                      {badge && (
                        <span className={`countdown-badge ${badge}`}>{formatDateShort(c.dueDate)}</span>
                      )}
                    </div>
                  )
                })}
              </div>
        }
      </Panel>

      {showAdd && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="overlay-box">
            <div className="overlay-title">Add To Do</div>
            <input className="overlay-input" placeholder="Task" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus
              onKeyDown={e => e.key === 'Enter' && addItem()} />
            <input className="overlay-input" type="date" value={form.dueDate}
              onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            <div className="weight-picker">
              {[1, 2, 3].map(w => (
                <button key={w} type="button"
                  className={`weight-btn${form.weight === w ? ' active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, weight: w }))}>
                  {WEIGHT_LABELS[w]}
                </button>
              ))}
            </div>
            <div className="overlay-actions">
              <button className="overlay-btn cancel" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="overlay-btn submit" onClick={addItem} disabled={saving || !form.name.trim()}>
                {saving ? 'Saving…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
