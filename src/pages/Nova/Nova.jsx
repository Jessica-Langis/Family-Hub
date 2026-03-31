import { useState, useEffect, useCallback, Component } from 'react'
import Panel, { PanelHeader } from '../../components/Panel/Panel'
import { SCRIPTS, apiFetch } from '../../api/scripts'
import { getDayDiff, formatDateShort, formatReminderDate } from '../Home/homeUtils'
import { NOVA_HYPE, NOVA_JOKES, NOVA_FACTS, NOVA_COOL_FACTS, pickDailyIndex } from '../../data/hypeContent'
import './Nova.css'

// ── Normalize API response → array ───────────────────────────
function toArr(d) {
  if (Array.isArray(d)) return d
  if (d && Array.isArray(d.result)) return d.result
  if (d && Array.isArray(d.items))  return d.items
  if (d && Array.isArray(d.data))   return d.data
  return []
}

// ── Error boundary ────────────────────────────────────────────
class NovaErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '20px', color: 'var(--muted)', fontSize: '0.85rem' }}>
          <div style={{ color: '#e07070', marginBottom: 8 }}>⚠ Nova page crashed</div>
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

const TODAY_DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

// ── Main tab ──────────────────────────────────────────────────
export default function Nova() {
  const [meal, setMeal] = useState(null)
  const [mealLoading, setMealLoading] = useState(true)

  useEffect(() => {
    apiFetch(SCRIPTS.MEAL)
      .then(r => r.json())
      .then(data => {
        const dayName = TODAY_DAYS[new Date().getDay()]
        setMeal(data?.[dayName] || '')
      })
      .catch(e => console.error('meal load', e))
      .finally(() => setMealLoading(false))
  }, [])

  return (
    <NovaErrorBoundary>
    <div className="nova-content">
      {/* Row 1: This Week + Hype */}
      <div className="nova-row-1">
        <ThisWeekPanel />
        <HypePanel />
      </div>

      {/* Row 2: Joke | Fun Fact | Did You Know | Tonight's Dinner */}
      <div className="nova-row-2">
        <JokePanel />
        <FactPanel />
        <CoolFactPanel />
        <DinnerPanel meal={meal} loading={mealLoading} />
      </div>

      {/* Row 3: Events | Reminders | Chores | Homework */}
      <div className="nova-row-3">
        <div className="na-cell"><EventsPanel /></div>
        <div className="na-cell"><RemindersPanel /></div>
        <div className="na-cell"><ChoresPanel /></div>
        <div className="na-cell"><HomeworkPanel /></div>
      </div>
    </div>
    </NovaErrorBoundary>
  )
}

// ── This Week panel ───────────────────────────────────────────
function ThisWeekPanel() {
  const [current, setCurrent] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState('')
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    apiFetch(`${SCRIPTS.CHORES}?type=nova_this_week`)
      .then(r => r.json())
      .then(d => setCurrent(d?.current || ''))
      .catch(e => console.error('nova this week', e))
  }, [])

  async function save() {
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('type', 'nova_this_week')
      fd.append('action', 'set')
      fd.append('value', draft)
      fd.append('previous', current)
      await apiFetch(SCRIPTS.CHORES, { method: 'POST', body: fd })
      setCurrent(draft)
      setEditing(false)
    } catch (e) { console.error('nova this week save', e) }
    finally { setSaving(false) }
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
              <textarea className="this-week-textarea" value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="What's Nova's focus this week?" />
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

// ── Hype tile ─────────────────────────────────────────────────
function HypePanel() {
  const [idx, setIdx] = useState(() => pickDailyIndex(NOVA_HYPE, 1))
  const raw   = NOVA_HYPE[idx]
  const dash  = raw.lastIndexOf(' — ')
  const quote = dash !== -1 ? raw.slice(0, dash) : raw
  const src   = dash !== -1 ? raw.slice(dash + 3) : ''

  return (
    <div className="nova-hype-panel">
      <div className="nova-hype-quote">"{quote}"</div>
      {src && <div className="nova-hype-source">— {src}</div>}
      <button
        className="nova-hype-refresh"
        title="New quote"
        onClick={() => setIdx(i => (i + 1) % NOVA_HYPE.length)}
      >↻</button>
    </div>
  )
}

// ── Joke tile ─────────────────────────────────────────────────
function JokePanel() {
  const [idx, setIdx] = useState(() => pickDailyIndex(NOVA_JOKES, 2))
  return (
    <div className="fun-fact-panel tile-joke">
      <div className="fun-fact-header">
        <span className="fun-fact-label">Joke of the Day</span>
        <button className="fact-shuffle-btn" title="New joke"
          onClick={() => setIdx(i => (i + 1) % NOVA_JOKES.length)}>↻</button>
      </div>
      <div className="fun-fact-text">{NOVA_JOKES[idx]}</div>
    </div>
  )
}

// ── Fun Fact tile ─────────────────────────────────────────────
function FactPanel() {
  const [idx, setIdx] = useState(() => pickDailyIndex(NOVA_FACTS, 3))
  return (
    <div className="fun-fact-panel tile-fact">
      <div className="fun-fact-header">
        <span className="fun-fact-label">Fun Fact</span>
        <button className="fact-shuffle-btn" title="New fact"
          onClick={() => setIdx(i => (i + 1) % NOVA_FACTS.length)}>↻</button>
      </div>
      <div className="fun-fact-text">{NOVA_FACTS[idx]}</div>
    </div>
  )
}

// ── Cool Fact tile ────────────────────────────────────────────
function CoolFactPanel() {
  const [idx, setIdx] = useState(() => pickDailyIndex(NOVA_COOL_FACTS, 4))
  return (
    <div className="fun-fact-panel tile-cool">
      <div className="fun-fact-header">
        <span className="fun-fact-label">Did You Know</span>
        <button className="fact-shuffle-btn" title="New fact"
          onClick={() => setIdx(i => (i + 1) % NOVA_COOL_FACTS.length)}>↻</button>
      </div>
      <div className="fun-fact-text">{NOVA_COOL_FACTS[idx]}</div>
    </div>
  )
}

// ── Tonight's Dinner tile ─────────────────────────────────────
function DinnerPanel({ meal, loading }) {
  return (
    <div className="nova-today-panel">
      <span className="nova-today-label">Tonight's Dinner</span>
      {loading
        ? <div className="nova-today-meal empty">Loading…</div>
        : <div className={`nova-today-meal${!meal ? ' empty' : ''}`}>
            {meal || 'Not set yet'}
          </div>
      }
    </div>
  )
}

// ── Events panel ──────────────────────────────────────────────
function EventsPanel() {
  const [events, setEvents]   = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm]       = useState({ name: '', evtType: '', date: '' })
  const [saving, setSaving]   = useState(false)

  const load = useCallback(async () => {
    try {
      const res  = await apiFetch(`${SCRIPTS.NOVA}?type=events`)
      const data = await res.json()
      setEvents(toArr(data).sort((a, b) => getDayDiff(a.date) - getDayDiff(b.date)))
    } catch (e) { console.error('nova events', e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

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
      await apiFetch(SCRIPTS.NOVA, { method: 'POST', body: fd })
      setForm({ name: '', evtType: '', date: '' })
      setShowAdd(false)
      load()
    } catch (e) { console.error('add event', e) }
    finally { setSaving(false) }
  }

  return (
    <>
      <Panel>
        <PanelHeader
          title="Events"
          actions={<button className="add-btn" onClick={() => setShowAdd(true)}>+ add</button>}
        />
        {loading
          ? <div className="countdown-empty">Loading…</div>
          : events.length === 0
            ? <div className="countdown-empty">No events yet.</div>
            : <div className="countdown-list">
                {events.map((e, i) => {
                  const diff  = getDayDiff(e.date)
                  const cls   = isNaN(diff) ? 'upcoming' : diff < 0 ? 'past' : diff === 0 ? 'today' : diff <= 7 ? 'soon' : 'upcoming'
                  const label = isNaN(diff) ? '' : diff < 0 ? `${Math.abs(diff)}d ago` : diff === 0 ? 'TODAY' : `${diff}d`
                  return (
                    <div key={e.id ?? i} className="countdown-item">
                      <span className="countdown-item-dot" style={{ background: 'var(--accent3)' }} />
                      <div className="countdown-item-body">
                        <div className="countdown-item-name">{e.name}</div>
                        <div className="countdown-item-sub">{e.type && `${e.type} · `}{formatDateShort(e.date)}</div>
                      </div>
                      <span className={`countdown-badge ${cls}`}>{label}</span>
                    </div>
                  )
                })}
              </div>
        }
      </Panel>

      {showAdd && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="overlay-box">
            <div className="overlay-title">Add Event</div>
            <input className="overlay-input" placeholder="Event name" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <input className="overlay-input" placeholder="Type (optional)" value={form.evtType}
              onChange={e => setForm(f => ({ ...f, evtType: e.target.value }))} />
            <input className="overlay-input" type="date" value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
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
      const res  = await apiFetch(`${SCRIPTS.NOVA}?type=reminders`)
      const data = await res.json()
      setReminders(toArr(data))
    } catch (e) { console.error('nova reminders', e) }
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
      await apiFetch(SCRIPTS.NOVA, { method: 'POST', body: fd })
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
      await apiFetch(SCRIPTS.NOVA, { method: 'POST', body: fd })
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
            ? <div className="reminder-empty">Nothing to remember!</div>
            : <div className="reminder-list">
                {reminders.map((r, i) => (
                  <div key={r.id ?? i} className="reminder-item">
                    <span className="reminder-dot" style={{ background: 'var(--accent3)' }} />
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

// ── To Do panel (Nova's chores) ───────────────────────────────
function ChoresPanel() {
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
        .filter(c => c.who === 'nova')
        .sort((a, b) => {
          const da = getDayDiff(a.dueDate), db = getDayDiff(b.dueDate)
          if (isNaN(da) && isNaN(db)) return 0
          if (isNaN(da)) return 1
          if (isNaN(db)) return -1
          return da - db
        })
      setChores(filtered)
    } catch (e) { console.error('nova chores', e) }
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
      fd.append('who', 'nova')
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
                      {badge && <span className={`countdown-badge ${badge}`}>{formatDateShort(c.dueDate)}</span>}
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

// ── Homework panel ────────────────────────────────────────────
function HomeworkPanel() {
  const [hw, setHw]           = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm]       = useState({ task: '', subject: '', due: '' })
  const [saving, setSaving]   = useState(false)

  const load = useCallback(async () => {
    try {
      const res  = await apiFetch(`${SCRIPTS.NOVA}?type=homework`)
      const data = await res.json()
      setHw(toArr(data))
    } catch (e) { console.error('homework load', e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function addHW() {
    if (!form.task) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('action', 'add')
      fd.append('type', 'homework')
      fd.append('task', form.task)
      fd.append('subject', form.subject)
      fd.append('due', form.due)
      await apiFetch(SCRIPTS.NOVA, { method: 'POST', body: fd })
      setForm({ task: '', subject: '', due: '' })
      setShowAdd(false)
      load()
    } catch (e) { console.error('add hw', e) }
    finally { setSaving(false) }
  }

  async function toggleHW(id, done) {
    setHw(h => h.map(x => x.id === id ? { ...x, done: !done } : x))
    try {
      const fd = new FormData()
      fd.append('action', 'toggle')
      fd.append('type', 'homework')
      fd.append('idx', id)
      fd.append('done', String(!done))
      await apiFetch(SCRIPTS.NOVA, { method: 'POST', body: fd })
    } catch (e) { console.error('toggle hw', e); load() }
  }

  async function deleteHW(id) {
    setHw(h => h.filter(x => x.id !== id))
    try {
      const fd = new FormData()
      fd.append('action', 'delete')
      fd.append('type', 'homework')
      fd.append('idx', id)
      await apiFetch(SCRIPTS.NOVA, { method: 'POST', body: fd })
    } catch (e) { console.error('delete hw', e); load() }
  }

  return (
    <>
      <Panel>
        <PanelHeader
          title="Homework"
          actions={<button className="add-btn" onClick={() => setShowAdd(true)}>+ add</button>}
        />
        {loading
          ? <div className="hw-empty">Loading…</div>
          : hw.length === 0
            ? <div className="hw-empty">Nothing due!</div>
            : <div className="homework-list">
                {hw.map((h, i) => (
                  <div key={h.id ?? i} className="hw-item" style={{ cursor: 'pointer' }}
                    onClick={e => { if (!e.target.closest('.hw-delete')) toggleHW(h.id, !!h.done) }}>
                    <div className="hw-item-body">
                      <div className={`hw-item-task${h.done ? ' done' : ''}`}>{h.task}</div>
                      <div className="hw-item-sub">
                        {h.subject && `${h.subject}`}
                        {h.subject && h.due && ' · '}
                        {h.due && formatDateShort(h.due)}
                      </div>
                    </div>
                    <button className="hw-delete" onClick={() => deleteHW(h.id)}>×</button>
                  </div>
                ))}
              </div>
        }
      </Panel>

      {showAdd && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="overlay-box">
            <div className="overlay-title">Add Homework</div>
            <input className="overlay-input" placeholder="Assignment" value={form.task}
              onChange={e => setForm(f => ({ ...f, task: e.target.value }))} autoFocus />
            <input className="overlay-input" placeholder="Subject (optional)" value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
            <input className="overlay-input" type="date" value={form.due}
              onChange={e => setForm(f => ({ ...f, due: e.target.value }))} />
            <div className="overlay-actions">
              <button className="overlay-btn cancel" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="overlay-btn submit" onClick={addHW} disabled={saving || !form.task}>
                {saving ? 'Saving…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
