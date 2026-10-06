import Icon from '../Icon/Icon'

// Friendly "nothing here" message for a tile — an icon over one short line
export default function EmptyState({ icon, children }) {
  return (
    <div className="empty-state">
      {icon && <Icon name={icon} />}
      <div>{children}</div>
    </div>
  )
}
