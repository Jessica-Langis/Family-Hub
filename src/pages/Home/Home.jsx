import { Component } from 'react'
import TodayPanel    from './panels/TodayPanel'
import ComingUpPanel from './panels/ComingUpPanel'
import GroceryPanel  from './panels/GroceryPanel'
import BulletinPanel from './panels/BulletinPanel'
import CalendarPanel from './panels/CalendarPanel'
import WhereAmIPanel from './panels/WhereAmIPanel'
import './Home.css'

class HomeErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--muted)' }}>
          <div style={{ fontSize: '1rem', color: '#e07070', marginBottom: 8 }}>Something went wrong loading the home page.</div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', wordBreak: 'break-all',
            color: 'var(--muted)', marginBottom: 20, maxWidth: 500, margin: '0 auto 20px' }}>
            {this.state.error?.message}
          </div>
          <button
            style={{ padding: '6px 18px', background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 8, color: 'var(--text)', cursor: 'pointer', fontSize: '0.85rem' }}
            onClick={() => this.setState({ error: null })}
          >Retry</button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function Home() {
  return (
    <HomeErrorBoundary>
      <div className="home-content">
        <TodayPanel />
        <ComingUpPanel />
        <GroceryPanel />
        <BulletinPanel />
        <CalendarPanel />
        <WhereAmIPanel />
      </div>
    </HomeErrorBoundary>
  )
}
