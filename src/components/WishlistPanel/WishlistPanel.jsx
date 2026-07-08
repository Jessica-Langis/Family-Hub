import { useState, useEffect, useCallback } from 'react'
import Panel, { PanelHeader } from '../Panel/Panel'
import { SCRIPTS, apiFetch } from '../../api/scripts'
import './WishlistPanel.css'

// ── Normalize API response → array ───────────────────────────
function toArr(d) {
  if (Array.isArray(d)) return d
  if (d && Array.isArray(d.result)) return d.result
  if (d && Array.isArray(d.items))  return d.items
  if (d && Array.isArray(d.data))   return d.data
  return []
}

// ── Wishlist tile — open-ended list, backed by tori_wishlist / ─
// nova_wishlist types on the shared CHORES script (ToriWishlist /
// NovaWishlist sheet tabs). Full add / edit / delete.
export default function WishlistPanel({ type }) {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addVal, setAddVal]   = useState('')
  const [editItem, setEditItem] = useState(null) // { id, text } | null
  const [editVal, setEditVal] = useState('')
  const [saving, setSaving]   = useState(false)

  const load = useCallback(async () => {
    try {
      const res  = await apiFetch(`${SCRIPTS.CHORES}?type=${type}`)
      const data = await res.json()
      setItems(toArr(data))
    } catch (e) { console.error('wishlist load', e) }
    finally { setLoading(false) }
  }, [type])

  useEffect(() => { load() }, [load])

  async function addItem() {
    const trimmed = addVal.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('action', 'add')
      fd.append('type', type)
      fd.append('text', trimmed)
      await apiFetch(SCRIPTS.CHORES, { method: 'POST', body: fd })
      setAddVal('')
      setShowAdd(false)
      load()
    } catch (e) { console.error('wishlist add', e) }
    finally { setSaving(false) }
  }

  function openEdit(item) {
    setEditVal(item.text)
    setEditItem(item)
  }

  async function saveEdit() {
    const trimmed = editVal.trim()
    if (!trimmed || !editItem) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('action', 'update')
      fd.append('type', type)
      fd.append('idx', String(editItem.id))
      fd.append('text', trimmed)
      await apiFetch(SCRIPTS.CHORES, { method: 'POST', body: fd })
      setEditItem(null)
      load()
    } catch (e) { console.error('wishlist edit', e) }
    finally { setSaving(false) }
  }

  async function deleteItem(id) {
    setItems(items => items.filter(i => i.id !== id))
    try {
      const fd = new FormData()
      fd.append('action', 'delete')
      fd.append('type', type)
      fd.append('idx', String(id))
      await apiFetch(SCRIPTS.CHORES, { method: 'POST', body: fd })
    } catch (e) { console.error('wishlist delete', e); load() }
  }

  return (
    <>
      <Panel className="wishlist-panel">
        <PanelHeader
          title="Wishlist"
          actions={<button className="add-btn" onClick={() => setShowAdd(true)}>+ add</button>}
        />

        {loading
          ? <div className="reminder-empty">Loading…</div>
          : items.length === 0
            ? <div className="reminder-empty">Nothing on the list yet</div>
            : <div className="reminder-list">
                {items.map(item => (
                  <div key={item.id} className="reminder-item">
                    <span className="reminder-dot" />
                    <span className="reminder-text">{item.text}</span>
                    <button className="reminder-edit" onClick={() => openEdit(item)} title="Edit">✎</button>
                    <button className="reminder-delete" onClick={() => deleteItem(item.id)} title="Remove">×</button>
                  </div>
                ))}
              </div>
        }
      </Panel>

      {showAdd && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="overlay-box">
            <div className="overlay-title">Add to Wishlist</div>
            <input
              className="overlay-input"
              placeholder="What do you want?"
              value={addVal}
              autoFocus
              onChange={e => setAddVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addItem()}
            />
            <div className="overlay-actions">
              <button className="overlay-btn cancel" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="overlay-btn submit" onClick={addItem} disabled={saving || !addVal.trim()}>
                {saving ? 'Saving…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editItem && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setEditItem(null)}>
          <div className="overlay-box">
            <div className="overlay-title">Edit Wishlist Item</div>
            <input
              className="overlay-input"
              value={editVal}
              autoFocus
              onChange={e => setEditVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveEdit()}
            />
            <div className="overlay-actions">
              <button className="overlay-btn cancel" onClick={() => setEditItem(null)}>Cancel</button>
              <button className="overlay-btn submit" onClick={saveEdit} disabled={saving || !editVal.trim()}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
