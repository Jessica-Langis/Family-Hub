import WishlistPanel from '../../components/WishlistPanel/WishlistPanel'
import './Wishlists.css'

// ── Wishlists — everyone's list on one tab ────────────────────
// Replaced the separate Tori and Nova tabs (2026-10-28): the kids rarely
// opened their own pages, so the one thing on them worth keeping — the
// wishlist — moved here alongside new lists for Mom and Dad. Each tile
// is backed by its own sheet tab (see WISHLIST_SHEETS in the GAS script).
const PEOPLE = [
  { name: 'Mom',  type: 'mom_wishlist'  },
  { name: 'Dad',  type: 'dad_wishlist'  },
  { name: 'Tori', type: 'tori_wishlist' },
  { name: 'Nova', type: 'nova_wishlist' },
]

export default function Wishlists() {
  return (
    <div className="wishlists-content">
      {PEOPLE.map(p => (
        <div key={p.type} className="wishlists-cell">
          <WishlistPanel type={p.type} person={p.name} />
        </div>
      ))}
    </div>
  )
}
