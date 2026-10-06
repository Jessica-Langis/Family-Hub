import { useState, useEffect, useCallback } from 'react'
import Panel, { PanelHeader } from '../../components/Panel/Panel'
import { SCRIPTS, apiFetch } from '../../api/scripts'
import GroceryPanel        from '../Home/panels/GroceryPanel'
import ChoresList          from '../../components/ChoresList/ChoresList'
import UpcomingEventsList  from '../../components/UpcomingEventsList/UpcomingEventsList'
import './Unwind.css'
import Icon from '../../components/Icon/Icon'
import EmptyState from '../../components/EmptyState/EmptyState'

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
      <button className="fun-delete" title="Remove" aria-label="Remove" onClick={() => onDelete(item.id)}><Icon name="x" /></button>
    </div>
  )
}

function FunList({ items, status, titleKey, subKey, onDelete, emptyIcon, emptyText }) {
  if (status === 'loading') return <div className="fun-empty">Loading…</div>
  if (status === 'error')   return <div className="fun-empty">Unavailable</div>
  if (!items.length)        return <EmptyState icon={emptyIcon}>{emptyText}</EmptyState>

  return (
    <div className="fun-list">
      {items.map(item => <FunItem key={item.id} item={item} titleKey={titleKey} subKey={subKey} onDelete={onDelete} />)}
    </div>
  )
}

// ── Add modal (Watch / Read only) ──────────────────────────────
const FORM_CONFIG = {
  movies: {
    title:  <><Icon name="film" size="1em" /> Add to Watch List</>,
    fields: [
      { id: 'title',     placeholder: 'e.g. Inception' },
      { id: 'mediaType', placeholder: 'Movie or Show' },
    ],
  },
  books: {
    title:  <><Icon name="book" size="1em" /> Add to Reading List</>,
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
          <>
            {/* In the header rather than its own row — this tile is only a
                third of the column tall, so every row of height counts */}
            <div className="fun-toggle">
              <button className={`fun-toggle-btn ${isWatch ? 'active' : ''}`} onClick={() => setTab('watch')}>
                <Icon name="film" size="1em" /> Watch
              </button>
              <button className={`fun-toggle-btn ${!isWatch ? 'active' : ''}`} onClick={() => setTab('read')}>
                <Icon name="book" size="1em" /> Read
              </button>
            </div>
            <button
              className="add-btn"
              aria-label={isWatch ? 'Add to watch list' : 'Add to reading list'}
              onClick={() => onAdd(isWatch ? 'movies' : 'books')}
            ><Icon name="plus" size="1em" /></button>
          </>
        }
      />
      {isWatch
        ? <FunList items={movies} status={status.movies} titleKey="title" subKey="mediaType" onDelete={id => onDelete('movies', id)}
            emptyIcon="film" emptyText="Nothing to watch yet — tap + to add a show or movie" />
        : <FunList items={books}  status={status.books}  titleKey="title" subKey="author"    onDelete={id => onDelete('books',  id)}
            emptyIcon="book" emptyText="No books yet — tap + to add one" />
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

      <div className="un-todo">
        <ChoresList
          title="To Do"
          whoInputMode="freeform"
          namePlaceholder="e.g. Vacuum living room"
          whoPlaceholder="Assigned to (optional)"
          whoLabel="Assigned"
          showFrequency
          frequencyOptions={FREQUENCY_OPTIONS}
          showWeight={false}
          showPoints={false}
          showHideCompletedToggle
          hideCompletedStorageKey="family_chores_hide_completed"
        />
      </div>
      <div className="un-readwatch">
        <ReadWatchPanel
          movies={data.movies}
          books={data.books}
          status={status}
          onDelete={handleDelete}
          onAdd={setModal}
        />
      </div>
      <div className="un-events"><UpcomingEventsList /></div>

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
