import { useState, useEffect, useCallback } from 'react'
import Panel, { PanelHeader } from '../Panel/Panel'
import Icon from '../Icon/Icon'
import FitList from '../FitList/FitList'
import PersonTag from '../PersonTag/PersonTag'
import EmptyState from '../EmptyState/EmptyState'
import { SCRIPTS, apiFetch, toArr } from '../../api/scripts'
import { getDayDiff, formatDateShort } from '../../utils/calendar'

// ── To Do panel (And Stuff) ───────────────────────────────────────
// The family's shared to-do list, backed by the Chores sheet: add, edit,
// check off and delete, with a repeat schedule and a toggle that hides
// finished items.
//
// Props:
//   title                    panel header text
//   namePlaceholder          add form: placeholder for the task name
//   whoPlaceholder           add form: placeholder for who it's assigned to
//   whoLabel                 details popup: label for the assigned person
//   frequencyOptions         [{ value, label }] for the repeat-schedule picker
//   hideCompletedStorageKey  localStorage key for the Show done / Hide done toggle

function choreBadgeCls(dateStr) {
  const diff = getDayDiff(dateStr)
  if (isNaN(diff)) return 'upcoming'
  if (diff < 0)    return 'past'
  if (diff === 0)  return 'today'
  if (diff <= 7)   return 'soon'
  return 'upcoming'
}

export default function ChoresList({
  title = 'To Do',
  frequencyOptions = [],
  hideCompletedStorageKey = 'chores_hide_completed',
  namePlaceholder = 'Task',
  whoPlaceholder = 'Who? (e.g. Mom, Dad, Everyone)',
  whoLabel = 'Who',
}) {
  const [chores, setChores]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [showAdd, setShowAdd]     = useState(false)
  const [editChore, setEditChore] = useState(null)
  const [detail, setDetail]       = useState(null)
  const [form, setForm] = useState({ name: '', who: '', frequency: '', dueDate: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [hideCompleted, setHideCompleted] = useState(
    () => localStorage.getItem(hideCompletedStorageKey) !== 'false'
  )

  function toggleHideCompleted() {
    setHideCompleted(h => {
      const next = !h
      localStorage.setItem(hideCompletedStorageKey, String(next))
      return next
    })
  }

  const doneCount = chores.filter(c => c.done).length
  const visibleChores = hideCompleted ? chores.filter(c => !c.done) : chores

  const load = useCallback(async () => {
    try {
      const res  = await apiFetch(`${SCRIPTS.CHORES}?type=chores`)
      const data = await res.json()
      const sorted = toArr(data).sort((a, b) => {
        const da = getDayDiff(a.dueDate), db = getDayDiff(b.dueDate)
        if (isNaN(da) && isNaN(db)) return 0
        if (isNaN(da)) return 1
        if (isNaN(db)) return -1
        return da - db
      })
      setChores(sorted)
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
    setForm({ name: '', who: '', frequency: '', dueDate: '', notes: '' })
    setShowAdd(true)
  }

  function openEdit(chore) {
    setDetail(null)
    setEditChore({ ...chore })
    setForm({
      name:      chore.name      || '',
      who:       chore.who       || '',
      frequency: chore.frequency || '',
      dueDate:   chore.dueDate   || '',
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
      fd.append('who', form.who.trim())
      fd.append('frequency', form.frequency)
      fd.append('dueDate', form.dueDate)
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
          actions={
            <>
              <button
                className="add-btn"
                onClick={toggleHideCompleted}
                title={hideCompleted ? 'Completed tasks are hidden — click to show them' : 'Hide completed tasks'}
              >{hideCompleted ? `Show done${doneCount ? ` (${doneCount})` : ''}` : 'Hide done'}</button>
              <button className="add-btn" onClick={openAdd}><Icon name="plus" size="1em" /> Add</button>
            </>
          }
        />
        {loading
          ? <div className="chore-empty">Loading…</div>
          : visibleChores.length === 0
            ? (chores.length === 0
                ? <EmptyState icon="calendar">No tasks yet — tap Add to start one</EmptyState>
                : <EmptyState icon="party">All done — nice work!</EmptyState>)
            : <FitList className="chore-list" title={title}>
                {visibleChores.map((c, i) => {
                  const badge = c.dueDate ? choreBadgeCls(c.dueDate) : null
                  return (
                    <div key={c.id ?? i} className="chore-item" style={{ cursor: 'pointer' }}
                      onClick={e => { if (!e.target.closest('.chore-item-actions')) setDetail(c) }}>
                      <span className={`chore-item-name${c.done ? ' done' : ''}`}>{c.name}</span>
                      <PersonTag name={c.who} />
                      {badge && (
                        <span className={`countdown-badge ${badge}`}>{formatDateShort(c.dueDate)}</span>
                      )}
                      {/* Edit and Delete live in the details pop-up (tap the row) */}
                      <div className="chore-item-actions">
                        <button
                          className={`chore-check-btn${c.done ? ' done' : ''}`}
                          title={c.done ? 'Mark not done' : 'Mark done'}
                          aria-label={c.done ? 'Mark not done' : 'Mark done'}
                          onClick={() => toggle(c.id, !!c.done)}
                        ><Icon name="check" /></button>
                      </div>
                    </div>
                  )
                })}
              </FitList>
        }
      </Panel>

      {detail && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setDetail(null)}>
          <div className="overlay-box">
            <button className="overlay-close" aria-label="Close" onClick={() => setDetail(null)}><Icon name="x" /></button>
            <div className="overlay-title">{detail.name}</div>
            <div className="detail-row">
              <span className="detail-label">Status</span>
              <span className="detail-value">{detail.done ? <><Icon name="check" size="1em" /> Done</> : 'Not done'}</span>
            </div>
            {detail.who && (
              <div className="detail-row">
                <span className="detail-label">{whoLabel}</span>
                <span className="detail-value"><PersonTag name={detail.who} /></span>
              </div>
            )}
            {detail.frequency && (
              <div className="detail-row">
                <span className="detail-label">Frequency</span>
                <span className="detail-value">
                  {frequencyOptions.find(o => o.value === detail.frequency)?.label || detail.frequency}
                </span>
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
              <button className="overlay-btn danger" onClick={() => deleteChore(detail.id)}><Icon name="trash" size="1em" /> Delete</button>
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
            <input className="overlay-input" placeholder={whoPlaceholder} value={form.who}
              onChange={e => setForm(f => ({ ...f, who: e.target.value }))} />
            <select className="overlay-input" value={form.frequency}
              onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
              {frequencyOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <input className="overlay-input" type="date" value={form.dueDate}
              onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
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
