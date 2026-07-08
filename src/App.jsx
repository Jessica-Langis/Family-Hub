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
  const Page = PAGES[activeTab]

  return (
    <>
      <TopBar title={TAB_TITLES[activeTab]} titleColor={TAB_COLORS[activeTab]} />
      <main className="main-content">
        <Page />
      </main>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </>
  )
}
