import './BottomNav.css'

const TABS = [
  { id: 'home',   icon: '🏡',       label: 'Home'        },
  { id: 'unwind', icon: '🛋️',        label: 'Unwind'      },
  { id: 'tori',   icon: '🤼‍♀️',     label: 'Tori'        },
  { id: 'nova',   icon: '🚲',        label: 'Nova'        },
  { id: 'glance', icon: '👀',        label: 'At A Glance' },
]

export default function BottomNav({ activeTab, onTabChange }) {
  return (
    <nav className="bottom-nav">
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
          data-tab={tab.id}
          onClick={() => onTabChange(tab.id)}
        >
          <span className="nav-icon">{tab.icon}</span>
          <span className="nav-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
