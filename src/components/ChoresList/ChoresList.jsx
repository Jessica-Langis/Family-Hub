import { useState, useEffect, useCallback } from 'react'
import Panel, { PanelHeader } from '../Panel/Panel'
import { SCRIPTS, apiFetch } from '../../api/scripts'
import { getDayDiff, formatDateShort } from '../../pages/Home/homeUtils'

// ── Shared chores CRUD panel ──────────────────────────────────────
// Used by Unwind (shared/family chores), Nova (Nova's chores), and — via
// its list-rendering pieces — mirrored by Tori's merged To Do/Reminders
// panel. Consolidates what used to be three near-identical copies of this
// same ~150-line component, one per page. That duplication is why the
// notes field silently failed to save for a while: the bug had to be
// fixed (or missed) three times instead of once.
//
// Props:
//   title                    panel header text
//   matchWho                 only show chores where who === this (case/space-insensitive)
//   excludeWho                array — hide chores whose who matches any of these
//   fixedWho                  if set, 'who' is hidden from the add form and always this value
//   whoInputMode              'fixed' | 'freeform' — freeform shows a free-text who input (Unwind)
//   showFrequency              show/collect a frequency field (Unwind only)
//   showWeight                 show the 1-3 difficulty/points picker (Tori/Nova)
//   showPoints                 show the points badge in the header (Tori/Nova)
//   showHideCompletedToggle    show the 👁 hide-completed toggle (Nova)
//   hideCompletedStorageKey    localStorage key for that toggle's state
//   onChange                   called after any successful add/update/toggle/delete —
//                               lets a sibling CompletedFeed know to refresh

export function isWho(c, name) {
  return (c.who || '').trim().toLowerCase() === String(name || '').trim().toLowerCase()
}

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

const WEIGHT_LABELS = { 1: 'Easy', 2: 'Medium', 3: 'Hard' }

export default function ChoresList({
  title = 'To Do',
  matchWho = null,
  excludeWho = null,
  fixedWho = null,
  whoInputMode = fixedWho ? 'fixed' : 'freeform',
  showFrequency = false,
  frequencyOptions = null, // if provided, renders a <select> instead of free text
  showWeight = true,
  showPoints = true,
  showHideCompletedToggle = false,
  hideCompletedStorageKey = 'chores_hide_completed',
  namePlaceholder = 'Task',
  whoPlaceholder = 'Who? (e.g. Mom, Dad, Everyone)',
  whoLabel = 'Who',
  onChange,
}) {
  const [chores, setChores]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [showAdd, setShowAdd]     = useState(false)
  const [editChore, setEditChore] = useState(null)
  const [detail, setDetail]       = useState(null)
  const [form, setForm] = useState({ name: '', who: fixedWho || '', frequency: '', dueDate: '', weight: 2, notes: '' })
  const [saving, setSaving] = useState(false)
  const [hideCompleted, setHideCompleted] = useState(
    () => showHideCompletedToggle && localStorage.getItem(hideCompletedStorageKey) !== 'false'
  )

  function toggleHideCompleted() {
    setHideCompleted(h => {
      const next = !h
      localStorage.setItem(hideCompletedStorageKey, String(next))
      return next
    })
  }

  const points = showPoints ? chores.reduce((sum, c) => sum + (c.done ? (c.weight || 1) : 0), 0) : 0
  const visibleChores = (showHideCompletedToggle && hideCompleted) ? chores.filter(c => !c.done) : chores

  // Depend on a joined string, not the array reference itself — a caller
  // passing an inline array literal (e.g. excludeWho={['tori','nova']})
  // would otherwise get a new reference every render, making this
  // useCallback (and the effect below) refire and refetch on every
  // unrelated re-render of the parent page.
  const excludeWhoKey = excludeWho ? excludeWho.join(',') : ''

  const load = useCallback(async () => {
    try {
      const res  = await apiFetch(`${SCRIPTS.CHORES}?type=chores`)
      const data = await res.json()
      let filtered = toArr(data)
      if (matchWho)   filtered = filtered.filter(c => isWho(c, matchWho))
      if (excludeWho) filtered = filtered.filter(c => !excludeWho.some(name => isWho(c, name)))
      filtered = filtered.sort((a, b) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchWho, excludeWhoKey])

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
      onChange?.()
    } catch (e) {
      console.error('toggle chore', e)
      setChores(chores)
    }
  }

  function openAdd() {
    setEditChore(null)
    setForm({ name: '', who: fixedWho || '', frequency: '', dueDate: '', weight: 2, notes: '' })
    setShowAdd(true)
  }

  function openEdit(chore) {
    setDetail(null)
    setEditChore({ ...chore })
    setForm({
      name:      chore.name      || '',
      who:       chore.who       || fixedWho || '',
      frequency: chore.frequency || '',
      dueDate:   chore.dueDate   || '',
      weight:    chore.weight    || 2,
      notes:     chore.notes     || '',
    })
    setShowAdd(true)
  }

  async function submitForm() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('type', 'chores')
      fd.append('name', form.name.trim())
      fd.append('who', (fixedWho || form.who || '').trim())
      if (showFrequency) fd.append('frequency', form.frequency)
      fd.append('dueDate', form.dueDate)
      if (showWeight) fd.append('weight', String(form.weight))
      fd.append('notes', form.notes.trim())
      if (editChore !== null) {
        fd.append('action', 'update')
        fd.append('idx', String(editChore.id))
      } else {
        fd.append('action', 'add')
      }
      await apiFetch(SCRIPTS.CHORES, { method: 'POST', body: fd })
      setShowAdd(false)
      load()
      onChange?.()
    } catch (e) {
      console.error('chore submit', e)
    } finally {
      setSaving(false)
    }
  }

  async function deleteChore(id) {
    const prev = chores
    setChores(c => c.filter(x => x.id !== id))
    setDetail(d => (d?.id === id ? null : d))
    try {
      const fd = new FormData()
      fd.append('action', 'delete')
      fd.append('type', 'chores')
      fd.append('idx', String(id))
      await apiFetch(SCRIPTS.CHORES, { method: 'POST', body: fd })
      onChange?.()
    } catch (e) {
      console.error('delete chore', e)
      setChores(prev)
    }
  }

  return (
    <>
      <Panel>
        <PanelHeader
          title={title}
          badge={showPoints && points > 0 ? `🏆 ${points} pts` : null}
          actions={
            <>
              {showHideCompletedToggle && (
                <button
                  className={`add-btn${hideCompleted ? ' active' : ''}`}
                  onClick={toggleHideCompleted}
                  title={hideCompleted ? 'Completed chores are hidden — click to show them' : 'Hide completed chores'}
                >👁</button>
              )}
              <button className="add-btn" onClick={openAdd}>+ add</button>
            </>
          }
        />
        {loading
          ? <div className="chore-empty">Loading…</div>
          : visibleChores.length === 0
            ? <div className="chore-empty">All done!</div>
            : <div className="chore-list">
                {visibleChores.map((c, i) => {
                  const badge = c.dueDate ? choreBadgeCls(c.dueDate) : null
                  return (
                    <div key={c.id ?? i} className="chore-item" style={{ cursor: 'pointer' }}
                      onClick={e => { if (!e.target.closest('.chore-item-actions')) setDetail(c) }}>
                      <span className={`chore-item-name${c.done ? ' done' : ''}`}>{c.name}</span>
                      {whoInputMode === 'freeform' && c.who && (
                        <span className="chore-item-who">{c.who}</span>
                      )}
                      {showWeight && (
                        <span className="chore-item-weight" title={WEIGHT_LABELS[c.weight || 1]}>
                          {'★'.repeat(c.weight || 1)}
                        </span>
                      )}
                      {badge && (
                        <span className={`countdown-badge ${badge}`}>{formatDateShort(c.dueDate)}</span>
                      )}
                      <div className="chore-item-actions">
                        <button
                          className={`chore-check-btn${c.done ? ' done' : ''}`}
                          title={c.done ? 'Mark not done' : 'Mark done'}
                          onClick={() => toggle(c.id, !!c.done)}
                        >✓</button>
                        <button className="chore-edit-btn"   title="Edit"   onClick={() => openEdit(c)}>✏</button>
                        <button className="chore-delete-btn" title="Delete" onClick={() => deleteChore(c.id)}>×</button>
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
              <span className="detail-label">Status</span>
              <span className="detail-value">{detail.done ? 'Done ✓' : 'Not done'}</span>
            </div>
            {whoInputMode === 'freeform' && detail.who && (
              <div className="detail-row">
                <span className="detail-label">{whoLabel}</span>
                <span className="detail-value">{detail.who}</span>
              </div>
            )}
            {showFrequency && detail.frequency && (
              <div className="detail-row">
                <span className="detail-label">Frequency</span>
                <span className="detail-value">
                  {frequencyOptions?.find(o => o.value === detail.frequency)?.label || detail.frequency}
                </span>
              </div>
            )}
            {showWeight && (
              <div className="detail-row">
                <span className="detail-label">Difficulty</span>
                <span className="detail-value">{WEIGHT_LABELS[detail.weight || 1]}</span>
              </div>
            )}
            {detail.dueDate && (
              <div className="detail-row">
                <span className="detail-label">Due</span>
                <span className="detail-value">{formatDateShort(detail.dueDate)}</span>
              </div>
            )}
            <div className="detail-row">
              <span className="detail-label">Notes</span>
              <span className="detail-value detail-notes">{detail.notes || <em style={{ color: 'var(--muted)' }}>No notes</em>}</span>
            </div>
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
            <div className="overlay-title">{editChore ? 'Edit To Do' : 'Add To Do'}</div>
            <input className="overlay-input" placeholder={namePlaceholder} value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus
              onKeyDown={e => e.key === 'Enter' && submitForm()} />
            {whoInputMode === 'freeform' && (
              <input className="overlay-input" placeholder={whoPlaceholder} value={form.who}
                onChange={e => setForm(f => ({ ...f, who: e.target.value }))} />
            )}
            {showFrequency && (
              frequencyOptions ? (
                <select className="overlay-input" value={form.frequency}
                  onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                  {frequencyOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input className="overlay-input" placeholder="Frequency (e.g. Weekly)" value={form.frequency}
                  onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))} />
              )
            )}
            <input className="overlay-input" type="date" value={form.dueDate}
              onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            {showWeight && (
              <div className="weight-picker">
                {[1, 2, 3].map(w => (
                  <button key={w} type="button"
                    className={`weight-btn${form.weight === w ? ' active' : ''}`}
                    onClick={() => setForm(f => ({ ...f, weight: w }))}>
                    {WEIGHT_LABELS[w]}
                  </button>
                ))}
              </div>
            )}
            <textarea
              className="overlay-input"
              placeholder="Notes (optional)"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              style={{ resize: 'none' }}
            />
            <div className="overlay-actions">
              <button className="overlay-btn cancel" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="overlay-btn submit" onClick={submitForm} disabled={saving || !form.name.trim()}>
                {saving ? 'Saving…' : editChore ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
