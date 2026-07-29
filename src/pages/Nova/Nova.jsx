import { useState, Component } from 'react'
import WishlistPanel from '../../components/WishlistPanel/WishlistPanel'
import NextUpPanel from '../../components/NextUpPanel/NextUpPanel'
import CompletedFeed from '../../components/CompletedFeed/CompletedFeed'
import ChoresList from '../../components/ChoresList/ChoresList'
import { SCRIPTS } from '../../api/scripts'
import { NOVA_JOKES, pickDailyIndex } from '../../data/hypeContent'
import './Nova.css'

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

// ── Main tab ──────────────────────────────────────────────────
// Previously had two overlapping "what's coming up" tiles (a "Today" list
// from Nova's own events, plus a separate big-number "Countdown" hero from
// tagged calendar events) — now uses the same shared NextUpPanel Tori's
// page uses, which merges both sources into one ranked list. Chores moved
// to the shared ChoresList component too (was a near-duplicate of Tori's
// and Unwind's copies of the same ~150 lines).
export default function Nova() {
  const [refreshTick, setRefreshTick] = useState(0)
  return (
    <NovaErrorBoundary>
    <div className="nova-content">
      <JokePanel />
      <div className="na-nextup-col">
        <div className="na-cell na-nextup-cell"><NextUpPanel name="Nova" script={SCRIPTS.NOVA} /></div>
        <div className="na-cell na-completed-cell"><CompletedFeed matchWho="nova" refreshKey={refreshTick} /></div>
      </div>
      <div className="na-chores-col">
        <div className="na-cell na-chores-cell">
          <ChoresList
            title="Chores"
            matchWho="nova"
            fixedWho="nova"
            showFrequency={false}
            showWeight
            showPoints
            showHideCompletedToggle
            hideCompletedStorageKey="nova_chores_hide_completed"
            onChange={() => setRefreshTick(t => t + 1)}
          />
        </div>
        <div className="na-wishlist"><WishlistPanel type="nova_wishlist" /></div>
      </div>
    </div>
    </NovaErrorBoundary>
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
