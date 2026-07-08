import { useState, useEffect, useCallback, Component } from 'react'
import Panel, { PanelHeader } from '../../components/Panel/Panel'
import WishlistPanel from '../../components/WishlistPanel/WishlistPanel'
import { SCRIPTS, apiFetch } from '../../api/scripts'
import { getDayDiff, formatDateShort, parsePersonEvent } from '../Home/homeUtils'
import { NOVA_JOKES, pickDailyIndex } from '../../data/hypeContent'
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

// ── Main tab ──────────────────────────────────────────────────
export default function Nova() {
  return (
    <NovaErrorBoundary>
    <div className="nova-content">
      <JokePanel />
      <div className="na-cell"><TodayPanel /></div>
      <div className="na-countdown-col">
        <div className="na-cell countdown-cell"><CountdownPanel name="Nova" /></div>
        <div className="na-wishlist"><WishlistPanel type="nova_wishlist" /></div>
      </div>
    </div>
    </NovaErrorBoundary>
  )
}

// ── Countdown panel — next calendar event tagged "Nova - ..." ─
function CountdownPanel({ name }) {
  const [big, setBig]         = useState(null) // { title, date }
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch(`${SCRIPTS.CHORES}?type=upcoming&days=365`)
      .then(r => r.json())
      .then(data => {
        const found = toArr(data)
          .flatMap(d => (d.events || []).map(ev => ({ summary: ev.summary, date: d.date })))
          .map(ev => {
            const title = parsePersonEvent(ev.summary, name)
            return title ? { title, date: ev.date } : null
          })
          .filter(Boolean)
          .sort((a, b) => getDayDiff(a.date) - getDayDiff(b.date))[0]
        setBig(found || null)
      })
      .catch(e => console.error('countdown load', e))
      .finally(() => setLoading(false))
  }, [name])

  const diff = big ? getDayDiff(big.date) : null

  return (
    <Panel>
      <PanelHeader title="Countdown" />
      <div className="countdown-hero">
        {loading
          ? <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Loading…</span>
          : big
            ? <>
                <div className="countdown-hero-num">{diff === 0 ? '🎉' : diff}</div>
                {diff !== 0 && <div className="countdown-hero-unit">days until</div>}
                <div className="countdown-hero-title">{big.title}</div>
                <div className="countdown-hero-date">{formatDateShort(big.date)}</div>
              </>
            : <div className="next-up-empty">
                No calendar events tagged "{name} - ..." yet
              </div>
        }
      </div>
    </Panel>
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

// ── Today panel (Nova's chores + events, today + next 2 days) ─
const WEIGHT_LABELS = { 1: 'Easy', 2: 'Medium', 3: 'Hard' }

function TodayPanel() {
  const [chores, setChores]       = useState([])
  const [events, setEvents]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [showAdd, setShowAdd]     = useState(false)
  const [addMode, setAddMode]     = useState('chore') // 'chore' | 'event'
  const [editChore, setEditChore] = useState(null)
  const [choreForm, setChoreForm] = useState({ name: '', dueDate: '', weight: 2 })
  const [eventForm, setEventForm] = useState({ name: '', evtType: '', date: '' })
  const [saving, setSaving]       = useState(false)

  const loadChores = useCallback(async () => {
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
  }, [])

  const loadEvents = useCallback(async () => {
    try {
      const res  = await apiFetch(`${SCRIPTS.NOVA}?type=events`)
      const data = await res.json()
      setEvents(
        toArr(data)
          .filter(e => !e.date || getDayDiff(e.date) >= 0)
          .sort((a, b) => getDayDiff(a.date) - getDayDiff(b.date))
      )
    } catch (e) { console.error('nova events', e) }
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadChores(), loadEvents()]).finally(() => setLoading(false))
  }, [loadChores, loadEvents])

  const points = chores.reduce((sum, c) => sum + (c.done ? (c.weight || 1) : 0), 0)

  // Chores: overdue / no-date / due within the next 2 days stay visible.
  // Anything due further out waits until it's actually relevant.
  const choresToShow = chores.filter(c => {
    const d = getDayDiff(c.dueDate)
    return isNaN(d) || d <= 2
  })

  // Events: just the single next upcoming one, with a countdown.
  const nextEvent = events.find(e => e.date && !isNaN(getDayDiff(e.date))) || null

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

  async function addChore() {
    if (!choreForm.name.trim()) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('action', 'add')
      fd.append('type', 'chores')
      fd.append('name', choreForm.name.trim())
      fd.append('who', 'nova')
      fd.append('dueDate', choreForm.dueDate)
      fd.append('weight', String(choreForm.weight))
      await apiFetch(SCRIPTS.CHORES, { method: 'POST', body: fd })
      setChoreForm({ name: '', dueDate: '', weight: 2 })
      setShowAdd(false)
      loadChores()
    } catch (e) { console.error('add chore', e) }
    finally { setSaving(false) }
  }

  async function saveEdit() {
    if (!choreForm.name.trim()) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('action', 'edit')
      fd.append('type', 'chores')
      fd.append('idx', String(editChore.id))
      fd.append('name', choreForm.name.trim())
      fd.append('dueDate', choreForm.dueDate)
      fd.append('weight', String(choreForm.weight))
      await apiFetch(SCRIPTS.CHORES, { method: 'POST', body: fd })
      setEditChore(null)
      loadChores()
    } catch (e) { console.error('edit chore', e) }
    finally { setSaving(false) }
  }

  function openEdit(e, c) {
    e.stopPropagation()
    setChoreForm({ name: c.name ?? '', dueDate: c.dueDate ?? '', weight: c.weight || 2 })
    setEditChore(c)
  }

  async function addEvent() {
    if (!eventForm.name || !eventForm.date) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('action', 'add')
      fd.append('type', 'events')
      fd.append('name', eventForm.name)
      fd.append('evtType', eventForm.evtType)
      fd.append('date', eventForm.date)
      await apiFetch(SCRIPTS.NOVA, { method: 'POST', body: fd })
      setEventForm({ name: '', evtType: '', date: '' })
      setShowAdd(false)
      loadEvents()
    } catch (e) { console.error('add event', e) }
    finally { setSaving(false) }
  }

  return (
    <>
      <Panel>
        <PanelHeader
          title="Today"
          badge={points > 0 ? `🏆 ${points} pts` : null}
          actions={<button className="add-btn" onClick={() => setShowAdd(true)}>+ add</button>}
        />
        {loading
          ? <div className="chore-empty">Loading…</div>
          : <>
              <div className="today-subhead">Chores</div>
              {choresToShow.length === 0
                ? <div className="chore-empty">All done!</div>
                : <div className="chore-list">
                    {choresToShow.map((c, i) => {
                      const badge = c.dueDate ? choreBadgeCls(c.dueDate) : null
                      return (
                        <div key={c.id ?? i} className="chore-item" style={{ cursor: 'pointer' }}
                          onClick={() => toggle(c.id, !!c.done)}>
                          <span className={`chore-item-name${c.done ? ' done' : ''}`}>{c.name}</span>
                          <span className="chore-item-weight" title={WEIGHT_LABELS[c.weight || 1]}>
                            {'★'.repeat(c.weight || 1)}
                          </span>
                          {badge && <span className={`countdown-badge ${badge}`}>{formatDateShort(c.dueDate)}</span>}
                          <button className="reminder-edit" onClick={e => openEdit(e, c)} title="Edit">✎</button>
                        </div>
                      )
                    })}
                  </div>
              }

              <div className="today-subhead">Coming Up</div>
              {!nextEvent
                ? <div className="countdown-empty">No upcoming events.</div>
                : <div className="countdown-list">
                    <div className="countdown-item">
                      <span className="countdown-item-dot" style={{ background: 'var(--accent3)' }} />
                      <div className="countdown-item-body">
                        <div className="countdown-item-name">{nextEvent.name}</div>
                        <div className="countdown-item-sub">{nextEvent.type && `${nextEvent.type} · `}{formatDateShort(nextEvent.date)}</div>
                      </div>
                      <span className={`countdown-badge ${choreBadgeCls(nextEvent.date)}`}>
                        {(() => {
                          const d = getDayDiff(nextEvent.date)
                          return d === 0 ? 'TODAY' : `${d}d away`
                        })()}
                      </span>
                    </div>
                  </div>
              }
            </>
        }
      </Panel>

      {showAdd && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="overlay-box">
            <div className="overlay-title">Add To Today</div>
            <div className="weight-picker">
              <button type="button" className={`weight-btn${addMode === 'chore' ? ' active' : ''}`}
                onClick={() => setAddMode('chore')}>Chore</button>
              <button type="button" className={`weight-btn${addMode === 'event' ? ' active' : ''}`}
                onClick={() => setAddMode('event')}>Event</button>
            </div>

            {addMode === 'chore'
              ? <>
                  <input className="overlay-input" placeholder="Task" value={choreForm.name}
                    onChange={e => setChoreForm(f => ({ ...f, name: e.target.value }))} autoFocus
                    onKeyDown={e => e.key === 'Enter' && addChore()} />
                  <input className="overlay-input" type="date" value={choreForm.dueDate}
                    onChange={e => setChoreForm(f => ({ ...f, dueDate: e.target.value }))} />
                  <div className="weight-picker">
                    {[1, 2, 3].map(w => (
                      <button key={w} type="button"
                        className={`weight-btn${choreForm.weight === w ? ' active' : ''}`}
                        onClick={() => setChoreForm(f => ({ ...f, weight: w }))}>
                        {WEIGHT_LABELS[w]}
                      </button>
                    ))}
                  </div>
                  <div className="overlay-actions">
                    <button className="overlay-btn cancel" onClick={() => setShowAdd(false)}>Cancel</button>
                    <button className="overlay-btn submit" onClick={addChore} disabled={saving || !choreForm.name.trim()}>
                      {saving ? 'Saving…' : 'Add'}
                    </button>
                  </div>
                </>
              : <>
                  <input className="overlay-input" placeholder="Event name" value={eventForm.name}
                    onChange={e => setEventForm(f => ({ ...f, name: e.target.value }))} autoFocus />
                  <input className="overlay-input" placeholder="Type (optional)" value={eventForm.evtType}
                    onChange={e => setEventForm(f => ({ ...f, evtType: e.target.value }))} />
                  <input className="overlay-input" type="date" value={eventForm.date}
                    onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))} />
                  <div className="overlay-actions">
                    <button className="overlay-btn cancel" onClick={() => setShowAdd(false)}>Cancel</button>
                    <button className="overlay-btn submit" onClick={addEvent} disabled={saving || !eventForm.name || !eventForm.date}>
                      {saving ? 'Saving…' : 'Add'}
                    </button>
                  </div>
                </>
            }
          </div>
        </div>
      )}

      {editChore && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setEditChore(null)}>
          <div className="overlay-box">
            <div className="overlay-title">Edit To Do</div>
            <input className="overlay-input" placeholder="Task" value={choreForm.name}
              onChange={e => setChoreForm(f => ({ ...f, name: e.target.value }))} autoFocus
              onKeyDown={e => e.key === 'Enter' && saveEdit()} />
            <input className="overlay-input" type="date" value={choreForm.dueDate}
              onChange={e => setChoreForm(f => ({ ...f, dueDate: e.target.value }))} />
            <div className="weight-picker">
              {[1, 2, 3].map(w => (
                <button key={w} type="button"
                  className={`weight-btn${choreForm.weight === w ? ' active' : ''}`}
                  onClick={() => setChoreForm(f => ({ ...f, weight: w }))}>
                  {WEIGHT_LABELS[w]}
                </button>
              ))}
            </div>
            <div className="overlay-actions">
              <button className="overlay-btn cancel" onClick={() => setEditChore(null)}>Cancel</button>
              <button className="overlay-btn submit" onClick={saveEdit} disabled={saving || !choreForm.name.trim()}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
