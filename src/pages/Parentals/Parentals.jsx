import { useState, useEffect, useCallback } from 'react'
import Panel, { PanelHeader } from '../../components/Panel/Panel'
import { SCRIPTS, apiFetch } from '../../api/scripts'
import { getDayDiff, formatDateShort } from '../Home/homeUtils'
import './Parentals.css'

// ── helpers ──────────────────────────────────────────────────
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

const MEAL_DAYS_LEFT  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday']
const MEAL_DAYS_RIGHT = ['Friday', 'Saturday', 'Sunday', 'Meal Prep']

const DAY_ABBR = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu',
  Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun', 'Meal Prep': 'Prep',
}

const FREQUENCY_OPTIONS = [
  { value: '',          label: 'No schedule (always show)' },
  { value: 'Daily',     label: 'Daily' },
  { value: 'Weekdays',  label: 'Weekdays (Mon–Fri)' },
  { value: 'Weekends',  label: 'Weekends (Sat–Sun)' },
  { value: 'Monday',    label: 'Every Monday' },
  { value: 'Tuesday',   label: 'Every Tuesday' },
  { value: 'Wednesday', label: 'Every Wednesday' },
  { value: 'Thursday',  label: 'Every Thursday' },
  { value: 'Friday',    label: 'Every Friday' },
  { value: 'Saturday',  label: 'Every Saturday' },
  { value: 'Sunday',    label: 'Every Sunday' },
]

// ── Parentals tab ─────────────────────────────────────────────
export default function Parentals() {
  return (
    <div className="parentals-grid">
      <div className="pa-todo"><TodoPanel /></div>
      <div className="pa-meals"><MealsPanel /></div>
      <div className="pa-agenda"><AgendaPanel /></div>
    </div>
  )
}

// ── To Do panel ───────────────────────────────────────────────
function TodoPanel() {
  const [chores, setChores]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editChore, setEditChore] = useState(null)
  const [form, setForm]         = useState({ name: '', who: '', frequency: '', dueDate: '' })
  const [saving, setSaving]     = useState(false)

  const load = useCallback(async () => {
    try {
      const res  = await apiFetch(`${SCRIPTS.CHORES}?type=chores`)
      const data = await res.json()
      const filtered = toArr(data)
        .filter(c => c.who !== 'tori' && c.who !== 'nova')
        .sort((a, b) => {
          const da = getDayDiff(a.dueDate), db = getDayDiff(b.dueDate)
          if (isNaN(da) && isNaN(db)) return 0
          if (isNaN(da)) return 1
          if (isNaN(db)) return -1
          return da - db
        })
      setChores(filtered)
    } catch (e) {
      console.error('chores load', e)
    } finally {
      setLoading(false)
    }
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
    } catch (e) {
      console.error('toggle chore', e)
      setChores(chores)
    }
  }

  function openAdd() {
    setEditChore(null)
    setForm({ name: '', who: '', frequency: '', dueDate: '' })
    setShowForm(true)
  }

  function openEdit(chore) {
    setEditChore({ ...chore })
    setForm({
      name:      chore.name      || '',
      who:       chore.who       || '',
      frequency: chore.frequency || '',
      dueDate:   chore.dueDate   || '',
    })
    setShowForm(true)
  }

  async function submitForm() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('type', 'chores')
      fd.append('name', form.name.trim())
      fd.append('who', form.who.trim())
      fd.append('frequency', form.frequency)
      fd.append('dueDate', form.dueDate)
      if (editChore !== null) {
        fd.append('action', 'update')
        fd.append('idx', String(editChore.id))
      } else {
        fd.append('action', 'add')
      }
      await apiFetch(SCRIPTS.CHORES, { method: 'POST', body: fd })
      setShowForm(false)
      load()
    } catch (e) {
      console.error('chore submit', e)
    } finally {
      setSaving(false)
    }
  }

  async function deleteChore(id) {
    const prev = chores
    setChores(c => c.filter(x => x.id !== id))
    try {
      const fd = new FormData()
      fd.append('action', 'delete')
      fd.append('type', 'chores')
      fd.append('idx', String(id))
      await apiFetch(SCRIPTS.CHORES, { method: 'POST', body: fd })
    } catch (e) {
      console.error('delete chore', e)
      setChores(prev)
    }
  }

  return (
    <>
      <Panel>
        <PanelHeader
          title="To Do"
          badge="family"
          actions={<button className="add-btn" onClick={openAdd}>+ add</button>}
        />
        {loading
          ? <div className="chore-empty">Loading…</div>
          : chores.length === 0
            ? <div className="chore-empty">All caught up!</div>
            : <div className="chore-list">
                {chores.map((c, i) => {
                  const badge = c.dueDate ? choreBadgeCls(c.dueDate) : null
                  return (
                    <div key={c.id ?? i} className="chore-item" style={{ cursor: 'pointer' }}
                      onClick={e => { if (!e.target.closest('.chore-edit-btn,.chore-delete-btn')) toggle(c.id, !!c.done) }}>
                      <span className={`chore-item-name${c.done ? ' done' : ''}`}>{c.name}</span>
                      {c.who && <span className="chore-item-who">{c.who}</span>}
                      {badge && (
                        <span className={`countdown-badge ${badge}`}>
                          {c.dueDate ? formatDateShort(c.dueDate) : ''}
                        </span>
                      )}
                      <button className="chore-edit-btn"   title="Edit"   onClick={() => openEdit(c)}>✏</button>
                      <button className="chore-delete-btn" title="Delete" onClick={() => deleteChore(c.id)}>×</button>
                    </div>
                  )
                })}
              </div>
        }
      </Panel>

      {showForm && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="overlay-box">
            <div className="overlay-title">{editChore ? 'Edit Chore' : 'Add Chore'}</div>
            <input
              className="overlay-input"
              placeholder="e.g. Vacuum living room"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && submitForm()}
              autoFocus
            />
            <input
              className="overlay-input"
              placeholder="Assigned to (optional)"
              value={form.who}
              onChange={e => setForm(f => ({ ...f, who: e.target.value }))}
            />
            <select
              className="overlay-input"
              value={form.frequency}
              onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
            >
              {FREQUENCY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <input
              className="overlay-input"
              type="date"
              value={form.dueDate}
              onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
            />
            <div className="overlay-actions">
              <button className="overlay-btn cancel" onClick={() => setShowForm(false)}>Cancel</button>
              <button
                className="overlay-btn submit"
                onClick={submitForm}
                disabled={saving || !form.name.trim()}
              >
                {saving ? 'Saving…' : editChore ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Meals panel ───────────────────────────────────────────────
function MealsPanel() {
  const [meals, setMeals]     = useState({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [draft, setDraft]     = useState('')

  useEffect(() => {
    apiFetch(SCRIPTS.MEAL)
      .then(r => r.json())
      .then(data => setMeals(data))
      .catch(e => console.error('meals load', e))
      .finally(() => setLoading(false))
  }, [])

  function startEdit(day) {
    setEditing(day)
    setDraft(meals[day] || '')
  }

  async function saveMeal(day, value) {
    const prev = meals
    setMeals(m => ({ ...m, [day]: value || '' }))
    setEditing(null)
    try {
      const fd = new FormData()
      fd.append('day', day)
      fd.append('meal', value || '__CLEAR__')
      await apiFetch(SCRIPTS.MEAL, { method: 'POST', body: fd })
    } catch (e) {
      console.error('save meal', e)
      setMeals(prev)
    }
  }

  function renderDay(day) {
    const val = meals[day] || ''
    if (editing === day) {
      return (
        <div key={day} className="meal-item editing">
          <span className="meal-item-day">{DAY_ABBR[day] ?? day}</span>
          <div className="meal-edit-row">
            <input
              className="meal-input"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter')  saveMeal(day, draft)
                if (e.key === 'Escape') setEditing(null)
              }}
              autoFocus
            />
            <button className="meal-save-btn"  onClick={() => saveMeal(day, draft)} title="Save">✓</button>
            <button className="meal-clear-btn" onClick={() => saveMeal(day, '')}    title="Clear">✕</button>
          </div>
        </div>
      )
    }
    return (
      <div key={day} className="meal-item">
        <span className="meal-item-day">{DAY_ABBR[day] ?? day}</span>
        <span className={`meal-item-name${!val ? ' empty' : ''}`}>
          {val || 'not set'}
        </span>
        <button
          className="meal-edit-icon"
          title={val ? 'Edit meal' : 'Set meal'}
          onClick={() => startEdit(day)}
        >✏</button>
        {val && (
          <button
            className="meal-clear-icon"
            onClick={() => saveMeal(day, '')}
            title="Clear"
          >×</button>
        )}
      </div>
    )
  }

  return (
    <Panel>
      <PanelHeader title="What's for Dinner" />
      {loading
        ? <div className="chore-empty">Loading…</div>
        : <div className="meal-grid-2col">
            <div>
              <div className="meal-col-label">Mon – Thu</div>
              {MEAL_DAYS_LEFT.map(renderDay)}
            </div>
            <div>
              <div className="meal-col-label">Fri – Prep</div>
              {MEAL_DAYS_RIGHT.map(renderDay)}
            </div>
          </div>
      }
    </Panel>
  )
}

// ── Agenda panel — custom upcoming events list ────────────────
function AgendaPanel() {
  const [days, setDays]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(false)
    try {
      const res  = await apiFetch(`${SCRIPTS.CHORES}?type=upcoming&days=30`)
      const data = await res.json()
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const filtered = (Array.isArray(data) ? data : [])
        .filter(d => d.events?.length > 0 && new Date(d.date + 'T00:00:00') >= today)
        .sort((a, b) => a.date.localeCompare(b.date))
      setDays(filtered)
    } catch (e) {
      console.error('agenda load', e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function evName(ev) {
    if (typeof ev === 'string') return ev
    return ev.summary || ev.name || ''
  }
  function evTime(ev) {
    if (typeof ev === 'string') return null
    if (ev.isAllDay || !ev.startTime) return null
    return ev.startTime + (ev.endTime ? '\u2013' + ev.endTime : '')
  }

  function fmtDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  return (
    <Panel>
      <PanelHeader
        title="Upcoming"
        actions={
          <button className="clear-btn" onClick={load} title="Refresh">↻</button>
        }
      />
      {loading
        ? <div className="countdown-empty">Loading…</div>
        : error
          ? <div className="countdown-empty">Unavailable</div>
          : days.length === 0
            ? <div className="countdown-empty">Nothing coming up!</div>
            : <div className="agenda-list">
                {days.map(day => {
                  const diff  = getDayDiff(day.date)
                  const cls   = diff === 0 ? 'today' : diff <= 3 ? 'soon' : 'upcoming'
                  const label = diff === 0 ? 'Today' : diff === 1 ? 'Tmrw' : `${diff}d`
                  return (
                    <div key={day.date} className="agenda-day-group">
                      <div className="agenda-date-row">
                        <span className="agenda-date-label">{fmtDate(day.date)}</span>
                        <span className={`countdown-badge ${cls}`}>{label}</span>
                      </div>
                      {day.events.map((ev, i) => {
                        const time = evTime(ev)
                        return (
                          <div key={i} className="agenda-event-item">
                            <span className="agenda-event-dot" />
                            <div className="agenda-event-body">
                              <div className="agenda-event-name">
                                <span className={`agenda-event-time-prefix${!time ? ' allday' : ''}`}>
                                  {time || 'All Day'}
                                </span>
                                {' '}{evName(ev)}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
      }
    </Panel>
  )
}
