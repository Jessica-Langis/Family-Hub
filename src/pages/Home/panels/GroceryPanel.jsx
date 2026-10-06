import { useState, useEffect, useRef } from 'react'
import Panel, { PanelHeader } from '../../../components/Panel/Panel'
import { SCRIPTS, apiFetch } from '../../../api/scripts'
import Icon from '../../../components/Icon/Icon'
import EmptyState from '../../../components/EmptyState/EmptyState'

// Bought state lives in localStorage so it persists across refreshes
function getBought() {
  try { return JSON.parse(localStorage.getItem('grocery_bought') || '[]') } catch { return [] }
}
function setBought(arr) {
  localStorage.setItem('grocery_bought', JSON.stringify(arr))
}

export default function GroceryPanel() {
  const [items,   setItems]   = useState([])
  const [bought,  setBoughtS] = useState(getBought)
  const [status,  setStatus]  = useState('loading')
  const [qaVal,   setQaVal]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const qaRef = useRef(null)

  async function load() {
    setStatus('loading')
    try {
      const res  = await apiFetch(SCRIPTS.GROCERY)
      const data = await res.json()
      const list = Array.isArray(data) ? data
        : (data?.items || data?.result || data?.data || [])
      setItems(list)
      setStatus('ok')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => { load() }, [])

  // Auto-clear when all bought
  useEffect(() => {
    if (items.length > 0 && items.every(i => bought.includes(i))) {
      clearBought()
    }
  }, [bought, items])

  function toggle(item) {
    const next = bought.includes(item)
      ? bought.filter(b => b !== item)
      : [...bought, item]
    setBought(next)
    setBoughtS(next)
  }

  async function clearBought() {
    const toClear = [...bought]
    setBought([]); setBoughtS([])
    for (const item of toClear) {
      try {
        const fd = new FormData()
        fd.append('action', 'delete'); fd.append('item', item)
        await apiFetch(SCRIPTS.GROCERY, { method: 'POST', body: fd })
      } catch { /* silent */ }
    }
    load()
  }

  async function quickAdd(e) {
    if (e.key !== 'Enter') return
    const item = qaVal.trim()
    if (!item) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('item', item)
      await apiFetch(SCRIPTS.GROCERY, { method: 'POST', body: fd })
      setQaVal('')
      load()
    } catch { /* silent */ }
    finally { setSaving(false); qaRef.current?.focus() }
  }

  async function deleteItem(item) {
    const next = bought.filter(b => b !== item)
    setBought(next); setBoughtS(next)
    try {
      const fd = new FormData()
      fd.append('action', 'delete'); fd.append('item', item)
      await apiFetch(SCRIPTS.GROCERY, { method: 'POST', body: fd })
      load()
    } catch { /* silent */ }
  }

  const sorted = [...items].sort((a, b) => {
    const ab = bought.includes(a), bb = bought.includes(b)
    if (ab !== bb) return ab ? 1 : -1
    return a.localeCompare(b)
  })

  return (
    <Panel className="hg-grocery">
      <PanelHeader
        title="Grocery List"
        actions={
          <>
            <button className="clear-btn" onClick={clearBought}>Clear Bought</button>
            {/* no full-form for now — quick-add covers most cases */}
          </>
        }
      />

      <div className="quick-add-wrap">
        <input
          ref={qaRef}
          className="quick-add-input"
          placeholder="Quick add"
          autoComplete="off"
          value={qaVal}
          onChange={e => setQaVal(e.target.value)}
          onKeyDown={quickAdd}
          disabled={saving}
        />
        <span className={`quick-add-spinner${saving ? ' active' : ''}`}><Icon name="spinner" /></span>
      </div>

      <div className="grocery-grid" id="grocery-list">
        {status === 'loading' && <div className="grocery-item" style={{ gridColumn: '1/-1', color: 'var(--muted)' }}>Loading…</div>}
        {status === 'error'   && <div className="grocery-item" style={{ gridColumn: '1/-1', color: 'var(--muted)' }}>Unavailable</div>}
        {status === 'ok' && sorted.length === 0 && (
          <div style={{ gridColumn: '1 / -1', display: 'flex' }}>
            <EmptyState icon="basket">The list is empty — type above to add something</EmptyState>
          </div>
        )}
        {status === 'ok' && sorted.map(item => (
          <div
            key={item}
            className={`grocery-item${bought.includes(item) ? ' bought' : ''}`}
            onClick={() => toggle(item)}
          >
            <span className="grocery-text">{item}</span>
            <button
              className="grocery-delete"
              title="Remove" aria-label="Remove"
              onClick={e => { e.stopPropagation(); deleteItem(item) }}
            ><Icon name="x" /></button>
          </div>
        ))}
      </div>
    </Panel>
  )
}
