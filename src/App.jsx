import { useState } from 'react'
import TopBar    from './components/TopBar/TopBar'
import BottomNav from './components/BottomNav/BottomNav'
import Unwind    from './pages/Unwind/Unwind'
import Tori      from './pages/Tori/Tori'
import Nova      from './pages/Nova/Nova'
import Glance    from './pages/Glance/Glance'

const PAGES = {
  glance: Glance,
  unwind: Unwind,
  tori:   Tori,
  nova:   Nova,
}

const TAB_TITLES = {
  glance: 'At A Glance',
  unwind: '🛋️ And Stuff',
  tori:   'Tori',
  nova:   'Nova',
}

const TAB_COLORS = {
  glance: 'var(--accent6)',
  unwind: 'var(--accent5)',
  tori:   'var(--accent4)',
  nova:   'var(--accent3)',
}

export default function App() {
  const [activeTab, setActiveTab] = useState('glance')
  // Track every tab that's been opened at least once so we can keep it
  // mounted (hidden via CSS) instead of unmounting it. Switching tabs would
  // otherwise re-run every data fetch from scratch against the (slow) GAS
  // endpoints each time — this way a tab only ever loads its data once per
  // session, and revisiting it is instant.
  const [visited, setVisited] = useState(() => new Set(['glance']))

  function handleTabChange(tab) {
    setActiveTab(tab)
    if (!visited.has(tab)) {
      setVisited(prev => new Set(prev).add(tab))
    }
  }

  return (
    <>
      <TopBar title={TAB_TITLES[activeTab]} titleColor={TAB_COLORS[activeTab]} />
      <main className="main-content">
        {Object.keys(PAGES).map(key => {
          if (!visited.has(key)) return null
          const Page = PAGES[key]
          return (
            <div key={key} className={`page-slot${key === activeTab ? ' active' : ''}`}>
              <Page />
            </div>
          )
        })}
      </main>
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </>
  )
}
