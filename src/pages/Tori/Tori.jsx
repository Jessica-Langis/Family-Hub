import { useState, useEffect, useCallback, Component } from 'react'
import Panel, { PanelHeader } from '../../components/Panel/Panel'
import WishlistPanel from '../../components/WishlistPanel/WishlistPanel'
import NextUpPanel from '../../components/NextUpPanel/NextUpPanel'
import CompletedFeed from '../../components/CompletedFeed/CompletedFeed'
import { SCRIPTS, apiFetch } from '../../api/scripts'
import { getDayDiff, formatDateShort, formatReminderDate } from '../Home/homeUtils'

// ── Normalize API response → array ───────────────────────────
function toArr(d) {
  if (Array.isArray(d)) return d
  if (d && Array.isArray(d.result)) return d.result
  if (d && Array.isArray(d.items))  return d.items
  if (d && Array.isArray(d.data))   return d.data
  return []
}

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

const WEIGHT_LABELS = { 1: 'Easy', 2: 'Medium', 3: 'Hard' }

// ── Main tab ──────────────────────────────────────────────────
export default function Tori() {
  const [refreshTick, setRefreshTick] = useState(0)
  return (
    <ToriErrorBoundary>
      <div className="tori-content">
        <div className="ta-nextup-col">
          <div className="ta-nextup"><NextUpPanel name="Tori" script={SCRIPTS.TORI} /></div>
          <div className="ta-completed"><CompletedFeed matchWho="tori" refreshKey={refreshTick} /></div>
        </div>
        <div className="ta-todo-col">
          <div className="ta-todo"><TodoPanel onChange={() => setRefreshTick(t => t + 1)} /></div>
          <div className="ta-wishlist"><WishlistPanel type="tori_wishlist" /></div>
        </div>
      </div>
    </ToriErrorBoundary>
  )
}

// ── Merged To Do panel — combines Tori's weighted/points chores with her
// plain freeform reminders into one list. These were two redundant tiles
// (confirmed with Jessica); rather than migrating Reminders' data into the
// Chores sheet (real data-loss risk for a "just tidy this up" ask), both
// backends stay intact and this panel merges them client-side into one
// sorted view with a single Add flow (a Task/Reminder toggle switches which
// fields show — reminders have no difficulty/points, since they never did).
function TodoPanel({ onChange }) {
  const [chores, setChores]       = useState([])
  const [reminders, setReminders] = useState([])
  const [loading, setLoading]     = useState(true)
  const [showAdd, setShowAdd]     = useState(false)
  const [editItem, setEditItem]   = useState(null) // { kind, id, ... } | null
  const [detail, setDetail]       = useState(null)
  const [form, setForm] = useState({ kind: 'chore', name: '', dueDate: '', weight: 2, notes: '' })
  const [saving, setSaving]       = useState(false)

  const points = chores.reduce((sum, c) => sum + (c.done ? (c.weight || 1) : 0), 0)

  const loadChores = useCallback(async () => {
    try {
      const res  = await apiFetch(`${SCRIPTS.CHORES}?type=chores`)
      const data = await res.json()
      setChores(toArr(data).filter(c => isWho(c, 'tori')))
    } catch (e) { console.error('tori chores', e) }
  }, [])

  const loadReminders = useCallback(async () => {
    try {
      const res  = await apiFetch(`${SCRIPTS.TORI}?type=reminders`)
      const data = await res.json()
      setReminders(toArr(data))
    } catch (e) { console.error('tori reminders', e) }
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadChores(), loadReminders()]).finally(() => setLoading(false))
  }, [loadChores, loadReminders])

  // Merge into one shape: { kind, id, name, dueDate, weight, notes, done }
  const merged = [
    ...chores.map(c => ({ kind: 'chore', id: c.id, name: c.name, dueDate: c.dueDate, weight: c.weight, notes: c.notes, done: !!c.done })),
    ...reminders.map(r => ({ kind: 'reminder', id: r.id, name: r.text, dueDate: r.date, weight: null, notes: null, done: false })),
  ].sort((a, b) => {
    const da = getDayDiff(a.dueDate), db = getDayDiff(b.dueDate)
    if (isNaN(da) && isNaN(db)) return 0
    if (isNaN(da)) return 1
    if (isNaN(db)) return -1
    return da - db
  })

  async function toggleChore(id, done) {
    setChores(cs => cs.map(c => c.id === id ? { ...c, done: !done } : c))
    try {
      const fd = new FormData()
      fd.append('action', 'toggle'); fd.append('type', 'chores')
      fd.append('idx', String(id)); fd.append('done', String(!done))
      await apiFetch(SCRIPTS.CHORES, { method: 'POST', body: fd })
      onChange?.()
    } catch (e) { console.error('toggle chore', e); loadChores() }
  }

  function openAdd() {
    setEditItem(null)
    setForm({ kind: 'chore', name: '', dueDate: '', weight: 2, notes: '' })
    setShowAdd(true)
  }

  function openEdit(item) {
    setDetail(null)
    setEditItem(item)
    setForm({
      kind:    item.kind,
      name:    item.name    || '',
      dueDate: item.dueDate || '',
      weight:  item.weight  || 2,
      notes:   item.notes   || '',
    })
    setShowAdd(true)
  }

  async function submitForm() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (form.kind === 'chore') {
        const fd = new FormData()
        fd.append('type', 'chores')
        fd.append('name', form.name.trim())
        fd.append('who', 'tori')
        fd.append('dueDate', form.dueDate)
        fd.append('weight', String(form.weight))
        fd.append('notes', form.notes.trim())
        if (editItem?.kind === 'chore') {
          fd.append('action', 'update'); fd.append('idx', String(editItem.id))
        } else {
          fd.append('action', 'add')
        }
        await apiFetch(SCRIPTS.CHORES, { method: 'POST', body: fd })
        loadChores()
      } else {
        const fd = new FormData()
        fd.append('type', 'reminders')
        fd.append('text', form.name.trim())
        fd.append('date', form.dueDate)
        if (editItem?.kind === 'reminder') {
          fd.append('action', 'update'); fd.append('idx', String(editItem.id))
        } else {
          fd.append('action', 'add')
        }
        await apiFetch(SCRIPTS.TORI, { method: 'POST', body: fd })
        loadReminders()
      }
      setShowAdd(false)
      onChange?.()
    } catch (e) { console.error('todo submit', e) }
    finally { setSaving(false) }
  }

  async function deleteItem(item) {
    setDetail(null)
    try {
      const fd = new FormData()
      if (item.kind === 'chore') {
        fd.append('action', 'delete'); fd.append('type', 'chores'); fd.append('idx', String(item.id))
        await apiFetch(SCRIPTS.CHORES, { method: 'POST', body: fd })
        setChores(cs => cs.filter(c => c.id !== item.id))
      } else {
        fd.append('action', 'delete'); fd.append('type', 'reminders'); fd.append('idx', String(item.id))
        await apiFetch(SCRIPTS.TORI, { method: 'POST', body: fd })
        setReminders(rs => rs.filter(r => r.id !== item.id))
      }
      onChange?.()
    } catch (e) { console.error('delete item', e) }
  }

  return (
    <>
      <Panel>
        <PanelHeader
          title="To Do"
          badge={points > 0 ? `🏆 ${points} pts` : null}
          actions={<button className="add-btn" onClick={openAdd}>+ add</button>}
        />
        {loading
          ? <div className="chore-empty">Loading…</div>
          : merged.length === 0
            ? <div className="chore-empty">All done!</div>
            : <div className="chore-list">
                {merged.map((item, i) => {
                  const badge = item.dueDate ? choreBadgeCls(item.dueDate) : null
                  return (
                    <div key={`${item.kind}-${item.id ?? i}`} className="chore-item" style={{ cursor: 'pointer' }}
                      onClick={e => { if (!e.target.closest('.chore-item-actions')) setDetail(item) }}>
                      <span className={`chore-item-name${item.done ? ' done' : ''}`}>{item.name}</span>
                      {item.kind === 'chore'
                        ? <span className="chore-item-weight" title={WEIGHT_LABELS[item.weight || 1]}>
                            {'★'.repeat(item.weight || 1)}
                          </span>
                        : <span className="chore-item-weight" title="Reminder">🔔</span>
                      }
                      {badge && (
                        <span className={`countdown-badge ${badge}`}>
                          {item.kind === 'reminder' ? formatReminderDate(item.dueDate) : formatDateShort(item.dueDate)}
                        </span>
                      )}
                      <div className="chore-item-actions">
                        {item.kind === 'chore' && (
                          <button
                            className={`chore-check-btn${item.done ? ' done' : ''}`}
                            title={item.done ? 'Mark not done' : 'Mark done'}
                            onClick={() => toggleChore(item.id, item.done)}
                          >✓</button>
                        )}
                        <button className="chore-edit-btn"   title="Edit"   onClick={() => openEdit(item)}>✏</button>
                        <button className="chore-delete-btn" title="Delete" onClick={() => deleteItem(item)}>×</button>
                      </div>
                    </div>
                  )
                })}
              </div>
        }
      </Panel>

      {detail && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setDetail(null)}>
          <div className="overlay-box">
            <button className="overlay-close" onClick={() => setDetail(null)}>✕</button>
            <div className="overlay-title">{detail.name}</div>
            <div className="detail-row">
              <span className="detail-label">Type</span>
              <span className="detail-value">{detail.kind === 'chore' ? 'Task' : 'Reminder'}</span>
            </div>
            {detail.kind === 'chore' && (
              <>
                <div className="detail-row">
                  <span className="detail-label">Status</span>
                  <span className="detail-value">{detail.done ? 'Done ✓' : 'Not done'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Difficulty</span>
                  <span className="detail-value">{WEIGHT_LABELS[detail.weight || 1]}</span>
                </div>
              </>
            )}
            {detail.dueDate && (
              <div className="detail-row">
                <span className="detail-label">Due</span>
                <span className="detail-value">{formatDateShort(detail.dueDate)}</span>
              </div>
            )}
            {detail.kind === 'chore' && (
              <div className="detail-row">
                <span className="detail-label">Notes</span>
                <span className="detail-value detail-notes">{detail.notes || <em style={{ color: 'var(--muted)' }}>No notes</em>}</span>
              </div>
            )}
            <div className="overlay-actions">
              <button className="overlay-btn cancel" onClick={() => setDetail(null)}>Close</button>
              <button className="overlay-btn submit" onClick={() => openEdit(detail)}>Edit</button>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="overlay-box">
            <div className="overlay-title">{editItem ? 'Edit' : 'Add'} To Do</div>
            {!editItem && (
              <div className="weight-picker">
                <button type="button" className={`weight-btn${form.kind === 'chore' ? ' active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, kind: 'chore' }))}>Task</button>
                <button type="button" className={`weight-btn${form.kind === 'reminder' ? ' active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, kind: 'reminder' }))}>Reminder</button>
              </div>
            )}
            <input className="overlay-input" placeholder={form.kind === 'chore' ? 'Task' : 'What to remember?'} value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus
              onKeyDown={e => e.key === 'Enter' && submitForm()} />
            <input className="overlay-input" type="date" value={form.dueDate}
              onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            {form.kind === 'chore' && (
              <>
                <div className="weight-picker">
                  {[1, 2, 3].map(w => (
                    <button key={w} type="button"
                      className={`weight-btn${form.weight === w ? ' active' : ''}`}
                      onClick={() => setForm(f => ({ ...f, weight: w }))}>
                      {WEIGHT_LABELS[w]}
                    </button>
                  ))}
                </div>
                <textarea
                  className="overlay-input"
                  placeholder="Notes (optional)"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  style={{ resize: 'none' }}
                />
              </>
            )}
            <div className="overlay-actions">
              <button className="overlay-btn cancel" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="overlay-btn submit" onClick={submitForm} disabled={saving || !form.name.trim()}>
                {saving ? 'Saving…' : editItem ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
