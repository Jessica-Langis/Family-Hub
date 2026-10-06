import useAutoFit from '../../hooks/useAutoFit'
import './Panel.css'

/** Wrapper card used by every section — scales its text to fit (useAutoFit) */
export default function Panel({ className = '', children, style }) {
  const ref = useAutoFit()
  return (
    <div ref={ref} className={`panel fit-scope ${className}`} style={style}>
      {children}
    </div>
  )
}

/** Standardised section header — title, optional badge, optional action buttons */
export function PanelHeader({ title, badge, actions }) {
  return (
    <div className="section-header">
      <div className="section-header-left">
        <span className="section-title">{title}</span>
        {badge && <span className="section-badge">{badge}</span>}
      </div>
      {actions && (
        <div className="section-header-actions">{actions}</div>
      )}
    </div>
  )
}
