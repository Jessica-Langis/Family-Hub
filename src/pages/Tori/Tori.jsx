import { useState, useEffect, useCallback, Component } from 'react'
import Panel, { PanelHeader } from '../../components/Panel/Panel'
import { SCRIPTS, apiFetch } from '../../api/scripts'
import { getDayDiff, formatDateShort, formatReminderDate } from '../Home/homeUtils'
import { TORI_HYPE, pickDailyIndex } from '../../data/hypeContent'
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
  const [events, setEvents]     = useState([])
  const [evtLoading, setEvtLoading] = useState(true)

  const loadEvents = useCallback(async () => {
    try {
      const res  = await apiFetch(`${SCRIPTS.TORI}?type=events`)
      const data = await res.json()
      setEvents(toArr(data))
    } catch (e) {
      console.error('tori events', e)
    } finally {
      setEvtLoading(false)
    }
  }, [])

  useEffect(() => { loadEvents() }, [loadEvents])

  return (
    <ToriErrorBoundary>
      <div className="tori-content">
        <div className="ta-thisweek"><ThisWeekPanel /></div>
        <div className="ta-pb"><PBsPanel /></div>
        <div className="ta-hype"><HypePanel /></div>
        <div className="ta-nextup"><NextUpPanel events={events} loading={evtLoading} onRefresh={loadEvents} /></div>
        <div className="ta-reminders"><RemindersPanel /></div>
        <div className="ta-schedule"><SchedulePanel /></div>
        <div className="ta-todo"><TodoPanel /></div>
        <div className="ta-events"><EventsPanel events={events} loading={evtLoading} onRefresh={loadEvents} /></div>
      </div>
    </ToriErrorBoundary>
  )
}

// ── This Week panel ───────────────────────────────────────────
function ThisWeekPanel() {
  const [current, setCurrent] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState('')
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    apiFetch(`${SCRIPTS.CHORES}?type=tori_this_week`)
      .then(r => r.json())
      .then(d => setCurrent(d?.current || ''))
      .catch(e => console.error('this week load', e))
  }, [])

  async function save() {
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('type', 'tori_this_week')
      fd.append('action', 'set')
      fd.append('value', draft)
      fd.append('previous', current)
      await apiFetch(SCRIPTS.CHORES, { method: 'POST', body: fd })
      setCurrent(draft)
      setEditing(false)
    } catch (e) {
      console.error('this week save', e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel>
      <PanelHeader
        title="This Week"
        actions={!editing && (
          <button className="add-btn" onClick={() => { setDraft(current); setEditing(true) }}>edit</button>
        )}
      />
      <div className="this-week-panel">
        {editing
          ? <div className="this-week-edit-wrap">
              <textarea
                className="this-week-textarea"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="What's the focus this week?"
              />
              <div className="this-week-actions">
                <button className="this-week-cancel-btn" onClick={() => setEditing(false)}>Cancel</button>
                <button className="this-week-save-btn" onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          : <div className={`this-week-goal${!current ? ' placeholder' : ''}`}>
              {current || 'No goal set yet — tap edit to add one.'}
            </div>
        }
      </div>
    </Panel>
  )
}

// ── Personal Bests panel ──────────────────────────────────────
function PBsPanel() {
  const [pbs, setPbs]         = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm]       = useState({ category: '', value: '', notes: '' })
  const [saving, setSaving]   = useState(false)

  const load = useCallback(async () => {
    try {
      const res  = await apiFetch(`${SCRIPTS.TORI}?type=pbs`)
      const data = await res.json()
      setPbs(toArr(data))
    } catch (e) { console.error('pbs load', e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function addPB() {
    if (!form.category || !form.value) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('action', 'add')
      fd.append('type', 'pbs')
      fd.append('category', form.category)
      fd.append('value', form.value)
      fd.append('notes', form.notes)
      await apiFetch(SCRIPTS.TORI, { method: 'POST', body: fd })
      setForm({ category: '', value: '', notes: '' })
      setShowAdd(false)
      load()
    } catch (e) { console.error('add pb', e) }
    finally { setSaving(false) }
  }

  async function deletePB(id) {
    setPbs(p => p.filter(x => x.id !== id))
    try {
      const fd = new FormData()
      fd.append('action', 'delete')
      fd.append('type', 'pbs')
      fd.append('idx', id)
      await apiFetch(SCRIPTS.TORI, { method: 'POST', body: fd })
    } catch (e) { console.error('delete pb', e); load() }
  }

  return (
    <>
      <Panel>
        <PanelHeader
          title="Personal Bests"
          actions={<button className="add-btn" onClick={() => setShowAdd(true)}>+ add</button>}
        />
        {loading
          ? <div className="pb-empty">Loading…</div>
          : pbs.length === 0
            ? <div className="pb-empty">No PRs yet — time to set some!</div>
            : <div className="pb-list">
                {pbs.map((pb, i) => (
                  <div key={pb.id ?? i} className="pb-item">
                    <span className="pb-item-cat">{pb.category}</span>
                    <span className="pb-item-val">{pb.value}</span>
                    {pb.notes && <span className="pb-item-notes">{pb.notes}</span>}
                    <button className="pb-delete" onClick={() => deletePB(pb.id)}>×</button>
                  </div>
                ))}
              </div>
        }
      </Panel>

      {showAdd && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="overlay-box">
            <div className="overlay-title">Add Personal Best</div>
            <input className="overlay-input" placeholder="Category (e.g. 100 Back)" value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
            <input className="overlay-input" placeholder="Value (e.g. 1:02.3)" value={form.value}
              onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
            <input className="overlay-input" placeholder="Notes (optional)" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            <div className="overlay-actions">
              <button className="overlay-btn cancel" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="overlay-btn submit" onClick={addPB} disabled={saving || !form.category || !form.value}>
                {saving ? 'Saving…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Hype panel ────────────────────────────────────────────────
function HypePanel() {
  const [idx, setIdx] = useState(() => pickDailyIndex(TORI_HYPE))
  const raw   = TORI_HYPE[idx]
  const dash  = raw.lastIndexOf(' — ')
  const quote = dash !== -1 ? raw.slice(0, dash) : raw
  const src   = dash !== -1 ? raw.slice(dash + 3) : ''

  return (
    <div className="hype-panel">
      <div className="hype-quote">"{quote}"</div>
      {src && <div className="hype-source">— {src}</div>}
      <button
        className="hype-refresh-btn"
        title="New quote"
        onClick={() => setIdx(i => (i + 1) % TORI_HYPE.length)}
      >↻</button>
    </div>
  )
}

// ── Next Up panel ─────────────────────────────────────────────
function NextUpPanel({ events, loading, onRefresh }) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm]       = useState({ name: '', evtType: '', date: '', location: '' })
  const [saving, setSaving]   = useState(false)

  const upcoming = toArr(events)
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
      onRefresh()
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

// ── Schedule panel ────────────────────────────────────────────
function SchedulePanel() {
  const [schedule, setSchedule] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)
  const [form, setForm]         = useState({ day: '', class: '', time: '' })
  const [saving, setSaving]     = useState(false)

  const load = useCallback(async () => {
    try {
      const res  = await apiFetch(`${SCRIPTS.TORI}?type=schedule`)
      const data = await res.json()
      setSchedule(toArr(data))
    } catch (e) { console.error('schedule load', e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function addSchedule() {
    if (!form.day || !form.class) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('action', 'add')
      fd.append('type', 'schedule')
      fd.append('day', form.day)
      fd.append('class', form.class)
      fd.append('time', form.time)
      await apiFetch(SCRIPTS.TORI, { method: 'POST', body: fd })
      setForm({ day: '', class: '', time: '' })
      setShowAdd(false)
      load()
    } catch (e) { console.error('add schedule', e) }
    finally { setSaving(false) }
  }

  async function deleteSchedule(id) {
    setSchedule(s => s.filter(x => x.id !== id))
    try {
      const fd = new FormData()
      fd.append('action', 'delete')
      fd.append('type', 'schedule')
      fd.append('idx', id)
      await apiFetch(SCRIPTS.TORI, { method: 'POST', body: fd })
    } catch (e) { console.error('delete schedule', e); load() }
  }

  const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

  return (
    <>
      <Panel>
        <PanelHeader
          title="Schedule"
          actions={<button className="add-btn" onClick={() => setShowAdd(true)}>+ add</button>}
        />
        {loading
          ? <div className="schedule-empty">Loading…</div>
          : schedule.length === 0
            ? <div className="schedule-empty">No schedule entries yet.</div>
            : <div className="schedule-list">
                {schedule.map((s, i) => (
                  <div key={s.id ?? i} className="schedule-item">
                    <span className="schedule-item-day">{s.day}</span>
                    <span className="schedule-item-class">{s.class}</span>
                    {s.time && <span className="schedule-item-time">{s.time}</span>}
                    <button className="schedule-delete" onClick={() => deleteSchedule(s.id)}>×</button>
                  </div>
                ))}
              </div>
        }
      </Panel>

      {showAdd && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="overlay-box">
            <div className="overlay-title">Add Schedule Entry</div>
            <select className="overlay-select" value={form.day}
              onChange={e => setForm(f => ({ ...f, day: e.target.value }))}>
              <option value="">Select day…</option>
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <input className="overlay-input" placeholder="Class / activity" value={form.class}
              onChange={e => setForm(f => ({ ...f, class: e.target.value }))} />
            <input className="overlay-input" placeholder="Time (optional, e.g. 4:30 PM)" value={form.time}
              onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
            <div className="overlay-actions">
              <button className="overlay-btn cancel" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="overlay-btn submit" onClick={addSchedule} disabled={saving || !form.day || !form.class}>
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
function TodoPanel() {
  const [chores, setChores]   = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm]       = useState({ name: '', dueDate: '' })
  const [saving, setSaving]   = useState(false)

  const load = useCallback(async () => {
    try {
      const res  = await apiFetch(`${SCRIPTS.CHORES}?type=chores`)
      const data = await res.json()
      const filtered = toArr(data)
        .filter(c => c.who === 'tori')
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
      await apiFetch(SCRIPTS.CHORES, { method: 'POST', body: fd })
      setForm({ name: '', dueDate: '' })
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

// ── Events panel (countdown list) ────────────────────────────
function EventsPanel({ events, loading, onRefresh }) {
  const sorted = [...toArr(events)]
    .filter(e => getDayDiff(e.date) >= 0)
    .sort((a, b) => getDayDiff(a.date) - getDayDiff(b.date))

  return (
    <Panel>
      <PanelHeader title="Events" badge={sorted.length > 0 ? `${sorted.length}` : null} />
      {loading
        ? <div className="countdown-empty">Loading…</div>
        : sorted.length === 0
          ? <div className="countdown-empty">No events added yet.</div>
          : <div className="countdown-list">
              {sorted.map((e, i) => {
                const diff = getDayDiff(e.date)
                const cls  = isNaN(diff) ? 'upcoming' : diff < 0 ? 'past' : diff === 0 ? 'today' : diff <= 7 ? 'soon' : 'upcoming'
                const label = isNaN(diff) ? '' : diff < 0 ? `${Math.abs(diff)}d ago` : diff === 0 ? 'TODAY' : `${diff}d`
                return (
                  <div key={e.id ?? i} className="countdown-item">
                    <span className="countdown-item-dot" />
                    <div className="countdown-item-body">
                      <div className="countdown-item-name">{e.name}</div>
                      <div className="countdown-item-sub">
                        {e.type && `${e.type} · `}{formatDateShort(e.date)}
                        {e.location && ` · ${e.location}`}
                      </div>
                    </div>
                    <span className={`countdown-badge ${cls}`}>{label}</span>
                  </div>
                )
              })}
            </div>
      }
    </Panel>
  )
}
