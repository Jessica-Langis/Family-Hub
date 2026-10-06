import { TABS } from '../../tabs'
import './BottomNav.css'

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
          <img className="nav-icon" src={tab.icon} alt="" />
          <span className="nav-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
