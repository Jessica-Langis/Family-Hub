import { useState, useEffect } from 'react'
import Panel, { PanelHeader } from '../../../components/Panel/Panel'
import { SCRIPTS, apiFetch } from '../../../api/scripts'

const BULLETIN_FONTS = ['dancing','caveat','pacifico','satisfy','kalam','patrick']
function bulletinFont(row) {
  return BULLETIN_FONTS[Math.abs(row || 0) % BULLETIN_FONTS.length]
}

const NOTE_COLORS = ['amber','rose','teal','blue','lavender']

function BulletinNote({ item, isDinner, onDelete, onOpen }) {
  const color = isDinner ? 'teal' : (item.color || 'amber')
  const font  = isDinner ? 'dancing' : bulletinFont(item.row)

  let dateStr = ''
  if (item.date) {
    const d = new Date(item.date)
    if (!isNaN(d.getTime())) {
      dateStr = `${d.getMonth()+1}/${d.getDate()}`
    }
  }

  return (
    <div
      className="bulletin-item"
      data-color={color}
      data-font={font}
      onClick={() => onOpen && onOpen({ item, isDinner })}
      style={{ cursor: onOpen ? 'pointer' : undefined }}
    >
      {!isDinner && onDelete && (
        <button className="bulletin-delete" onClick={e => { e.stopPropagation(); onDelete(item.row) }}>×</button>
      )}
      <div className="bulletin-inner">
        <div className={`bulletin-who${isDinner ? ' bulletin-dinner-who' : ''}`}>
          {isDinner ? "Tonight's Dinner" : (item.who || 'Someone')}
        </div>
        <div className={`bulletin-text${isDinner && !item.text ? ' empty-dinner' : ''}`}>
          {isDinner ? (item.text || 'Nothing planned yet') : (item.text || '')}
        </div>
        {dateStr && <div className="bulletin-date">{dateStr}</div>}
      </div>
    </div>
  )
}

// ── Note detail popup (matches the calendar day-detail modal style) ──
// Also the only place a note can be deleted. Delete lives here rather than
// as an × on each row because At a Glance is a walk-by kiosk screen — an
// always-visible delete target invites accidental taps. Opening the note
// first makes removal deliberate, and it works in both compact and card
// modes instead of only the card one.
function BulletinNoteModal({ item, isDinner, onClose, onDelete }) {
  const [confirming, setConfirming] = useState(false)

  let dateStr = ''
  if (item.date) {
    const d = new Date(item.date)
    dateStr = !isNaN(d.getTime())
      ? d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      : String(item.date)
  }
  const who  = isDinner ? "Tonight's Dinner" : (item.who || 'Someone')
  const text = isDinner ? (item.text || 'Nothing planned yet') : (item.text || '')

  // "Tonight's Dinner" is synthesised from the meal planner, not a row on
  // the Bulletin sheet — there's nothing to delete, so don't offer it.
  const canDelete = !isDinner && onDelete && item.row != null

  return (
    <div className="fun-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fun-overlay-box" style={{ maxWidth: 380 }}>
        <button onClick={onClose} style={{ position:'absolute', top:14, right:16, background:'none', border:'none', color:'var(--muted)', fontSize:'1.1rem', cursor:'pointer' }}>✕</button>
        <div style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--accent5)', marginBottom:6, fontWeight:700 }}>
          📌 {isDinner ? "Tonight's Dinner" : 'Bulletin Note'}
        </div>
        <div style={{ fontSize:'1.05rem', fontWeight:700, color:'var(--text)', marginBottom:12 }}>{who}</div>
        <div style={{ fontSize:'0.9rem', color:'var(--text)', lineHeight:1.55, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{text}</div>
        {dateStr && <div style={{ fontSize:'0.72rem', color:'var(--muted)', marginTop:16 }}>{dateStr}</div>}

        {canDelete && (
          <div className="fun-overlay-actions">
            {confirming ? (
              <>
                <button className="fun-overlay-btn cancel" onClick={() => setConfirming(false)}>Keep</button>
                <button
                  className="fun-overlay-btn submit"
                  style={{ background: '#e07070' }}
                  onClick={() => { onDelete(item.row); onClose() }}
                >Delete for good</button>
              </>
            ) : (
              <button
                className="fun-overlay-btn cancel"
                style={{ color: '#e07070' }}
                onClick={() => setConfirming(true)}
              >Delete note</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function AddNoteModal({ onClose, onAdded }) {
  const [who,     setWho]     = useState('')
  const [text,    setText]    = useState('')
  const [color,   setColor]   = useState('amber')
  const [saving,  setSaving]  = useState(false)

  async function submit() {
    if (!text.trim()) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('type', 'bulletin'); fd.append('action', 'add')
      fd.append('who', who.trim() || 'Someone')
      fd.append('text', text.trim())
      fd.append('color', color)
      fd.append('date', new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
      await apiFetch(SCRIPTS.CHORES, { method: 'POST', body: fd })
      onAdded(); onClose()
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="fun-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fun-overlay-box">
        <div className="fun-overlay-title">📌 Post to Bulletin</div>
        <input className="fun-overlay-input" placeholder="Who? (e.g. Mom)" value={who} onChange={e => setWho(e.target.value)} />
        <textarea
          className="fun-overlay-input"
          placeholder="What's the note?"
          value={text}
          onChange={e => setText(e.target.value)}
          rows={3}
          autoFocus
          style={{ resize: 'none' }}
        />
        <div style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
          {NOTE_COLORS.map(c => (
            <button
              key={c}
              title={c}
              className={`note-color-swatch${color === c ? ' selected' : ''}`}
              data-color={c}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <div className="fun-overlay-actions">
          <button className="fun-overlay-btn cancel" onClick={onClose}>Cancel</button>
          <button className="fun-overlay-btn submit" onClick={submit} disabled={saving}>
            {saving ? '…' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Compact single-line row — used on At a Glance where the bulletin board
// is now a condensed strip (top few items + "N more") instead of a full
// card grid, since a wall of 5-wide sticky notes was the single biggest
// driver of "cluttered" in the At a Glance redesign.
function BulletinLine({ item, isDinner, onOpen }) {
  const who = isDinner ? "Tonight's Dinner" : (item.who || 'Someone')
  const text = isDinner ? (item.text || 'Nothing planned yet') : (item.text || '')
  return (
    <div className="bulletin-line" onClick={() => onOpen({ item, isDinner })}>
      <span className={`bulletin-line-who${isDinner ? ' dinner' : ''}`}>{who}</span>
      <span className="bulletin-line-text">{text}</span>
    </div>
  )
}

function AllNotesModal({ dinner, bulletins, onClose, onOpenNote }) {
  return (
    <div className="fun-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fun-overlay-box" style={{ maxWidth: 380 }}>
        <button onClick={onClose} style={{ position:'absolute', top:14, right:16, background:'none', border:'none', color:'var(--muted)', fontSize:'1.1rem', cursor:'pointer' }}>✕</button>
        <div style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--accent5)', marginBottom:12, fontWeight:700 }}>📌 All Notes</div>
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:4 }}>
          <BulletinLine item={{ text: dinner }} isDinner onOpen={onOpenNote} />
          {bulletins.map((b, i) => <BulletinLine key={i} item={b} onOpen={onOpenNote} />)}
        </div>
      </div>
    </div>
  )
}

export default function BulletinPanel({ bodyClassName, limit = 4, style, compact = false }) {
  const [bulletins, setBulletins] = useState([])
  const [dinner,    setDinner]    = useState(null)
  const [showAdd,   setShowAdd]   = useState(false)
  const [opened,    setOpened]    = useState(null) // { item, isDinner } | null
  const [showAll,   setShowAll]   = useState(false)

  async function load() {
    try {
      const [bRes, mRes] = await Promise.all([
        apiFetch(SCRIPTS.CHORES + '?type=bulletin'),
        apiFetch(SCRIPTS.MEAL),
      ])
      const items = await bRes.json()
      const meals = await mRes.json()
      setBulletins(Array.isArray(items) ? items : [])
      const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
      setDinner(meals[dayNames[new Date().getDay()]] || null)
    } catch { /* silent */ }
  }

  useEffect(() => { load() }, [])

  async function deleteNote(id) {
    try {
      const fd = new FormData()
      fd.append('type', 'bulletin'); fd.append('action', 'delete'); fd.append('id', id)
      await apiFetch(SCRIPTS.CHORES, { method: 'POST', body: fd })
      load()
    } catch { /* silent */ }
  }

  return (
    <Panel className="hg-bulletin" style={{ overflow: 'hidden', ...style }}>
      <PanelHeader
        title="Bulletin Board"
        actions={
          <button className="add-btn" onClick={() => setShowAdd(true)}>+ Post</button>
        }
      />
      {compact ? (
        <div className={bodyClassName || 'bulletin-strip-compact'}>
          <BulletinLine item={{ text: dinner }} isDinner onOpen={setOpened} />
          {bulletins.slice(0, limit).map((b, i) => (
            <BulletinLine key={i} item={b} onOpen={setOpened} />
          ))}
          {bulletins.length === 0 && (
            <div style={{ color: 'var(--muted)', fontSize: '0.82rem', padding: '4px 0' }}>
              Nothing posted yet — be the first!
            </div>
          )}
          {bulletins.length > limit && (
            <div className="bulletin-more-row" onClick={() => setShowAll(true)}>
              +{bulletins.length - limit} more — tap to see all
            </div>
          )}
        </div>
      ) : (
        <div className={bodyClassName || 'home-bulletin-strip corkboard-body'}>
          {/* Tonight's dinner always first */}
          <BulletinNote item={{ text: dinner }} isDinner onOpen={setOpened} />
          {bulletins.slice(0, limit).map((b, i) => (
            <BulletinNote key={i} item={b} onDelete={deleteNote} onOpen={setOpened} />
          ))}
          {bulletins.length === 0 && (
            <div style={{ color: 'var(--muted)', fontSize: '0.82rem', padding: '4px 0' }}>
              Nothing posted yet — be the first!
            </div>
          )}
        </div>
      )}
      {showAdd && (
        <AddNoteModal onClose={() => setShowAdd(false)} onAdded={load} />
      )}
      {showAll && (
        <AllNotesModal
          dinner={dinner}
          bulletins={bulletins}
          onClose={() => setShowAll(false)}
          onOpenNote={(o) => { setShowAll(false); setOpened(o) }}
        />
      )}
      {opened && (
        <BulletinNoteModal
          item={opened.item}
          isDinner={opened.isDinner}
          onClose={() => setOpened(null)}
          onDelete={deleteNote}
        />
      )}
    </Panel>
  )
}
