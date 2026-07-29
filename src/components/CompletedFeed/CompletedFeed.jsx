import { useState, useEffect, useCallback } from 'react'
import Panel, { PanelHeader } from '../Panel/Panel'
import { SCRIPTS, apiFetch } from '../../api/scripts'
import { isWho } from '../ChoresList/ChoresList'

// ── Lightweight "recently completed" feed ──────────────────────────
// Purely additive — reads the same Chores sheet everything else does,
// filtered to done items with a CompletedAt stamp, newest first. Exists
// so finished chores don't just vanish the moment they're checked off;
// seeing your own completed list is part of what makes the points system
// motivating (per the design-session assessment).
//
// Self-sufficient: fetches on mount and whenever `refreshKey` changes,
// rather than needing tight coupling to ChoresList. Pass a bumped
// `refreshKey` from the parent page after a toggle for an instant
// refresh, or just let it pick up the change on next reload.

function parseCompletedAt(s) {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

function relativeTime(date) {
  const ms = Date.now() - date.getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1)   return 'just now'
  if (min < 60)  return `${min}m ago`
  const hrs = Math.floor(min / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'yesterday'
  if (days < 7)   return `${days}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function toArr(d) {
  if (Array.isArray(d)) return d
  if (d && Array.isArray(d.result)) return d.result
  if (d && Array.isArray(d.items))  return d.items
  if (d && Array.isArray(d.data))   return d.data
  return []
}

export default function CompletedFeed({ title = 'Recently Completed', matchWho = null, limit = 5, refreshKey }) {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res  = await apiFetch(`${SCRIPTS.CHORES}?type=chores`)
      const data = await res.json()
      let list = toArr(data).filter(c => c.done && c.completedAt)
      if (matchWho) list = list.filter(c => isWho(c, matchWho))
      list = list
        .map(c => ({ ...c, _completedDate: parseCompletedAt(c.completedAt) }))
        .filter(c => c._completedDate)
        .sort((a, b) => b._completedDate - a._completedDate)
        .slice(0, limit)
      setItems(list)
    } catch (e) {
      console.error('completed feed load', e)
    } finally {
      setLoading(false)
    }
  }, [matchWho, limit])

  useEffect(() => { load() }, [load, refreshKey])

  return (
    <Panel>
      <PanelHeader title={title} />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 14px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {loading
          ? <div className="chore-empty">Loading…</div>
          : items.length === 0
            ? <div className="chore-empty">Nothing completed yet — check something off!</div>
            : items.map((c, i) => (
                <div key={c.id ?? i} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0',
                  borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{ color: 'var(--accent6)', fontSize: '0.85rem', flexShrink: 0 }}>✓</span>
                  <span style={{
                    flex: 1, minWidth: 0, fontSize: '0.82rem', color: 'var(--text)',
                    textDecoration: 'line-through', opacity: 0.75,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{c.name}</span>
                  {c.weight > 0 && (
                    <span style={{ fontSize: '0.68rem', color: 'var(--accent)', flexShrink: 0 }}>+{c.weight || 1}pt</span>
                  )}
                  <span style={{ fontSize: '0.68rem', color: 'var(--muted)', flexShrink: 0 }}>
                    {relativeTime(c._completedDate)}
                  </span>
                </div>
              ))
        }
      </div>
    </Panel>
  )
}
