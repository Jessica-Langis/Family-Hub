import { useState, useEffect } from 'react'
import Panel, { PanelHeader } from '../../../components/Panel/Panel'
import { SCRIPTS, apiFetch } from '../../../api/scripts'
import { formatDateShort } from '../homeUtils'

// Only these get a name badge on the tile — everyone else (parents, general
// family entries) shows up unlabeled. Confirmed with Jessica: she'll use this
// for the whole family, but only kid-tagged entries should call out a name.
const KID_NAMES = ['nova', 'tori']
function isKidName(name) {
  return KID_NAMES.includes(String(name || '').trim().toLowerCase())
}

function AddModal({ onClose, onAdded }) {
  const today = new Date().toISOString().slice(0,10)
  const [name,      setName]      = useState('')
  const [loc,       setLoc]       = useState('')
  const [startDate, setStartDate] = useState(today)
  const [endDate,   setEndDate]   = useState('')
  const [time,      setTime]      = useState('')
  const [phone,     setPhone]     = useState('')
  const [err,       setErr]       = useState('')
  const [saving,    setSaving]    = useState(false)

  async function submit() {
    if (!loc.trim()) { setErr('Location is required.'); return }
    setSaving(true); setErr('')
    try {
      const fd = new FormData()
      fd.append('action', 'add'); fd.append('type', 'whereami')
      fd.append('name', name.trim())
      fd.append('location', loc.trim())
      fd.append('date', startDate || '')
      fd.append('endDate', endDate || '')
      fd.append('time', time.trim())
      fd.append('phone', phone.trim())
      await apiFetch(SCRIPTS.CHORES, { method: 'POST', body: fd })
      onAdded(); onClose()
    } catch {
      setErr('Failed to save — try again')
      setSaving(false)
    }
  }

  return (
    <div className="fun-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fun-overlay-box">
        <div className="fun-overlay-title">📍 Where Am I?</div>
        <input
          className="fun-overlay-input"
          placeholder="Kid's name (optional — leave blank if not kid-specific)"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
        <input
          className="fun-overlay-input"
          placeholder="Where? (e.g. Jake's house, Office, Gym)"
          value={loc}
          onChange={e => setLoc(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="fun-overlay-input"
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            style={{ flex: 1 }}
          />
          <input
            className="fun-overlay-input"
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={e => setEndDate(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>
        <div style={{ fontSize: '0.68rem', color: 'var(--muted)', margin: '-4px 0 0 2px' }}>
          Leave the second date blank for a same-day entry — otherwise it's the day they're back.
        </div>
        <input
          className="fun-overlay-input"
          placeholder="Note (optional, e.g. Back by 6pm)"
          value={time}
          onChange={e => setTime(e.target.value)}
        />
        <input
          className="fun-overlay-input"
          placeholder="Phone (optional)"
          value={phone}
          onChange={e => setPhone(e.target.value)}
        />
        {err && <div className="fun-overlay-status" style={{ color: 'var(--accent3)' }}>{err}</div>}
        <div className="fun-overlay-actions">
          <button className="fun-overlay-btn cancel" onClick={onClose}>Cancel</button>
          <button className="fun-overlay-btn submit" onClick={submit} disabled={saving}>
            {saving ? '…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailModal({ item, onClose, onDelete }) {
  const showName   = isKidName(item.name)
  const isMultiDay = item.endDate && item.endDate !== item.date
  const dateLabel  = isMultiDay
    ? `${formatDateShort(item.date)} – ${formatDateShort(item.endDate)}`
    : formatDateShort(item.date)

  return (
    <div className="fun-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fun-overlay-box">
        <div className="fun-overlay-title">📍 {showName ? item.name : 'Details'}</div>
        <div className="whereami-detail-row">
          <span className="whereami-detail-label">Location</span>
          <span>{item.location}</span>
        </div>
        {dateLabel && (
          <div className="whereami-detail-row">
            <span className="whereami-detail-label">{isMultiDay ? 'Away' : 'Date'}</span>
            <span>{dateLabel}</span>
          </div>
        )}
        {item.time && (
          <div className="whereami-detail-row">
            <span className="whereami-detail-label">Note</span>
            <span>{item.time}</span>
          </div>
        )}
        {item.phone && (
          <div className="whereami-detail-row">
            <span className="whereami-detail-label">Phone</span>
            <span>{item.phone}</span>
          </div>
        )}
        <div className="fun-overlay-actions">
          <button className="fun-overlay-btn cancel" onClick={onClose}>Close</button>
          <button
            className="fun-overlay-btn submit"
            style={{ background: '#e07070' }}
            onClick={() => { onDelete(item.id); onClose() }}
          >Remove</button>
        </div>
      </div>
    </div>
  )
}

export default function WhereAmIPanel() {
  const [items,   setItems]   = useState([])
  const [status,  setStatus]  = useState('loading')
  const [showAdd, setShowAdd] = useState(false)
  const [detail,  setDetail]  = useState(null)

  async function load() {
    setStatus('loading')
    try {
      const res   = await apiFetch(SCRIPTS.CHORES + '?type=whereami')
      const data  = await res.json()
      const todayStr = new Date().toISOString().slice(0,10)
      const active = Array.isArray(data)
        ? data.filter(item => {
            const cutoff = item.endDate || item.date
            return !cutoff || cutoff >= todayStr
          })
        : []
      setItems(active)
      setStatus('ok')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => { load() }, [])

  async function deleteItem(id) {
    try {
      const fd = new FormData()
      fd.append('action', 'delete'); fd.append('type', 'whereami'); fd.append('idx', id)
      await apiFetch(SCRIPTS.CHORES, { method: 'POST', body: fd })
      load()
    } catch { /* silent */ }
  }

  return (
    <Panel className="hg-whereami">
      <PanelHeader
        title="📍 Where I'll Be:"
        actions={
          <button className="add-btn" onClick={() => setShowAdd(true)}>+</button>
        }
      />
      <div className="whereami-list">
        {status === 'loading' && <div className="whereami-empty">Loading…</div>}
        {status === 'error'   && <div className="whereami-empty">Unavailable</div>}
        {status === 'ok' && items.length === 0 && <div className="whereami-empty">No one checked in yet</div>}
        {status === 'ok' && items.map(item => {
          const showName   = isKidName(item.name)
          const isMultiDay = item.endDate && item.endDate !== item.date
          const dateLabel  = isMultiDay
            ? `${formatDateShort(item.date)}–${formatDateShort(item.endDate)}`
            : formatDateShort(item.date)
          return (
            <div
              key={item.id}
              className="whereami-item"
              style={{ cursor: 'pointer' }}
              onClick={() => setDetail(item)}
            >
              <div className="whereami-dot" />
              <div className="whereami-info">
                {showName && <div className="whereami-name">{item.name}</div>}
                <div className="whereami-loc">{item.location}</div>
              </div>
              {dateLabel && (
                <span className={`countdown-badge ${isMultiDay ? 'soon' : 'upcoming'}`}>{dateLabel}</span>
              )}
            </div>
          )
        })}
      </div>
      {showAdd && (
        <AddModal onClose={() => setShowAdd(false)} onAdded={load} />
      )}
      {detail && (
        <DetailModal item={detail} onClose={() => setDetail(null)} onDelete={deleteItem} />
      )}
    </Panel>
  )
}
