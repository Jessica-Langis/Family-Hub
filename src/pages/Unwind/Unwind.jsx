import { useState, useEffect, useCallback } from 'react'
import Panel, { PanelHeader } from '../../components/Panel/Panel'
import { SCRIPTS, apiFetch } from '../../api/scripts'
import { getDayDiff, formatDateShort } from '../Home/homeUtils'
import GroceryPanel  from '../Home/panels/GroceryPanel'
import './Unwind.css'

// ── Helpers (from Parentals) ──────────────────────────────────
function toArr(d) {
  if (Array.isArray(d)) return d
  if (d && Array.isArray(d.result)) return d.result
  if (d && Array.isArray(d.items))  return d.items
  if (d && Array.isArray(d.data))   return d.data
  return []
}

// Case/whitespace-insensitive "who" match — chores can have who="Tori",
// " nova ", etc. depending on where they were added from.
function whoIs(c, name) {
  return (c.who || '').trim().toLowerCase() === name
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

// ── To Do panel (family/shared chores — Tori & Nova have their own) ──
function TodoPanel() {
  const [chores, setChores]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editChore, setEditChore] = useState(null)
  const [form, setForm]           = useState({ name: '', who: '', frequency: '', dueDate: '' })
  const [saving, setSaving]       = useState(false)

  const load = useCallback(async () => {
    try {
      const res  = await apiFetch(`${SCRIPTS.CHORES}?type=chores`)
      const data = await res.json()
      const filtered = toArr(data)
        .filter(c => !whoIs(c, 'tori') && !whoIs(c, 'nova'))
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

// ── What's For Dinner panel (from Parentals) ──────────────────
function WhatForDinnerPanel() {
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

// ── Read / Watch list items ────────────────────────────────────
function FunItem({ item, titleKey, subKey, onDelete }) {
  const title = item[titleKey] || ''
  const sub   = subKey && item[subKey] ? item[subKey] : null
  const tag   = item.type || null

  return (
    <div className="fun-item">
      <div className="fun-item-dot" />
      <div className="fun-item-body">
        <span className="fun-item-title">{title}</span>
        {sub && <span className="fun-item-sub">{sub}</span>}
      </div>
      {tag && <span className="fun-item-tag">{tag}</span>}
      <button className="fun-delete" title="Remove" onClick={() => onDelete(item.id)}>×</button>
    </div>
  )
}

function FunList({ items, status, titleKey, subKey, onDelete }) {
  if (status === 'loading') return <div className="fun-empty">Loading…</div>
  if (status === 'error')   return <div className="fun-empty">Unavailable</div>
  if (!items.length)        return <div className="fun-empty">Nothing here yet</div>

  return (
    <div className="fun-list">
      {items.map(item => <FunItem key={item.id} item={item} titleKey={titleKey} subKey={subKey} onDelete={onDelete} />)}
    </div>
  )
}

// ── Add modal (Watch / Read only) ──────────────────────────────
const FORM_CONFIG = {
  movies: {
    title:  '🎬 Add to Watch List:',
    fields: [
      { id: 'title',     placeholder: 'e.g. Inception' },
      { id: 'mediaType', placeholder: 'Movie or Show' },
    ],
  },
  books: {
    title:  '📚 Add to Reading List:',
    fields: [
      { id: 'title',  placeholder: 'e.g. Atomic Habits' },
      { id: 'author', placeholder: 'e.g. James Clear' },
    ],
  },
}

function AddModal({ type, onClose, onAdded }) {
  const cfg = FORM_CONFIG[type]
  const [values, setValues] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (id, val) => setValues(v => ({ ...v, [id]: val }))

  async function handleSubmit() {
    if (!values[cfg.fields[0].id]?.trim()) return
    setSaving(true); setError('')
    try {
      const fd = new FormData()
      fd.append('action', 'add'); fd.append('type', type)
      cfg.fields.forEach(f => fd.append(f.id, values[f.id] || ''))
      if (type === 'movies' && !values.mediaType) fd.set('mediaType', 'Movie')
      await apiFetch(SCRIPTS.CHORES, { method: 'POST', body: fd })
      onAdded()
      onClose()
    } catch {
      setError('Failed to save — try again')
      setSaving(false)
    }
  }

  return (
    <div className="fun-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fun-overlay-box">
        <div className="fun-overlay-title">{cfg.title}</div>
        {cfg.fields.map(f => (
          <input
            key={f.id}
            className="fun-overlay-input"
            placeholder={f.placeholder}
            value={values[f.id] || ''}
            onChange={e => set(f.id, e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            autoFocus={cfg.fields[0].id === f.id}
          />
        ))}
        {error && <div className="fun-overlay-status">{error}</div>}
        <div className="fun-overlay-actions">
          <button className="fun-overlay-btn cancel" onClick={onClose}>Cancel</button>
          <button className="fun-overlay-btn submit" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Read / Watch panel ─────────────────────────────────────────
function ReadWatchPanel({ movies, books, status, onDelete, onAdd }) {
  const [tab, setTab] = useState('watch')
  const isWatch = tab === 'watch'

  return (
    <Panel>
      <PanelHeader
        title={<span style={{ color: 'var(--accent5)' }}>{isWatch ? 'Watch List' : 'Reading List'}</span>}
        actions={
          <button
            className="add-btn"
            onClick={() => onAdd(isWatch ? 'movies' : 'books')}
          >+</button>
        }
      />
      <div className="fun-toggle">
        <button className={`fun-toggle-btn ${isWatch ? 'active' : ''}`} onClick={() => setTab('watch')}>
          🎬 Watch
        </button>
        <button className={`fun-toggle-btn ${!isWatch ? 'active' : ''}`} onClick={() => setTab('read')}>
          📚 Read
        </button>
      </div>
      {isWatch
        ? <FunList items={movies} status={status.movies} titleKey="title" subKey="mediaType" onDelete={id => onDelete('movies', id)} />
        : <FunList items={books}  status={status.books}  titleKey="title" subKey="author"    onDelete={id => onDelete('books',  id)} />
      }
    </Panel>
  )
}

// ── Main page ─────────────────────────────────────────────────
const ALL_TYPES = ['movies', 'books']

export default function Unwind() {
  const [data, setData] = useState({ movies: [], books: [] })
  const [status, setStatus] = useState({ movies: 'loading', books: 'loading' })
  const [modal, setModal] = useState(null)

  const load = useCallback(async (type) => {
    setStatus(s => ({ ...s, [type]: 'loading' }))
    try {
      const res   = await apiFetch(SCRIPTS.CHORES + `?type=${type}`)
      const items = await res.json()
      setData(d => ({ ...d, [type]: items || [] }))
      setStatus(s => ({ ...s, [type]: 'ok' }))
    } catch {
      setStatus(s => ({ ...s, [type]: 'error' }))
    }
  }, [])

  useEffect(() => {
    ALL_TYPES.forEach(t => load(t))
  }, [load])

  async function handleDelete(type, id) {
    try {
      const fd = new FormData()
      fd.append('action', 'delete'); fd.append('type', type); fd.append('idx', id)
      await apiFetch(SCRIPTS.CHORES, { method: 'POST', body: fd })
      load(type)
    } catch { /* silent */ }
  }

  return (
    <div className="unwind-content">

      <div className="un-grocery"><GroceryPanel /></div>

      <div className="un-todo"><TodoPanel /></div>
      <div className="un-readwatch">
        <ReadWatchPanel
          movies={data.movies}
          books={data.books}
          status={status}
          onDelete={handleDelete}
          onAdd={setModal}
        />
      </div>
      <div className="un-dinner"><WhatForDinnerPanel /></div>

      {modal && (
        <AddModal
          type={modal}
          onClose={() => setModal(null)}
          onAdded={() => load(modal)}
        />
      )}
    </div>
  )
}
