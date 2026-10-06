// ── App tabs — one list for the bottom nav and the top bar title ──────
// Icons are Microsoft's Fluent Emoji 3D set (MIT licensed,
// github.com/microsoft/fluentui-emoji), the same style as the recipe icons.
import glanceIcon  from './assets/nav-icons/glance.png'
import unwindIcon  from './assets/nav-icons/unwind.png'
import recipesIcon from './assets/nav-icons/recipes.png'
import toriIcon    from './assets/nav-icons/tori.png'
import novaIcon    from './assets/nav-icons/nova.png'

export const TABS = [
  { id: 'glance',  label: 'At A Glance', icon: glanceIcon,  color: 'var(--accent6)' },
  { id: 'unwind',  label: 'And Stuff',   icon: unwindIcon,  color: 'var(--accent5)' },
  { id: 'recipes', label: 'Recipes',     icon: recipesIcon, color: 'var(--accent)'  },
  { id: 'tori',    label: 'Tori',        icon: toriIcon,    color: 'var(--accent4)' },
  { id: 'nova',    label: 'Nova',        icon: novaIcon,    color: 'var(--accent3)' },
]

export const tabById = (id) => TABS.find(t => t.id === id)
