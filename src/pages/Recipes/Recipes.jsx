import { useState, useEffect, useCallback, useMemo } from 'react'
import Panel, { PanelHeader } from '../../components/Panel/Panel'
import { SCRIPTS, apiFetch } from '../../api/scripts'
import breakfastIcon from '../../assets/recipe-icons/breakfast.png'
import lunchIcon     from '../../assets/recipe-icons/lunch.png'
import dinnerIcon    from '../../assets/recipe-icons/dinner.png'
import snackIcon     from '../../assets/recipe-icons/snack.png'
import dessertIcon   from '../../assets/recipe-icons/dessert.png'
import bakingIcon    from '../../assets/recipe-icons/baking.png'
import drinksIcon    from '../../assets/recipe-icons/drinks.png'
import './Recipes.css'
import Icon from '../../components/Icon/Icon'
import EmptyState from '../../components/EmptyState/EmptyState'

// Backed by the MealIdeas sheet tab (A=Name B=Category C=Main Ingredient
// D=Link). Column D holds either a URL to an online recipe or the full
// recipe text pasted into the cell — RecipeBody handles both.
// Category icons are Microsoft's Fluent Emoji 3D set (MIT licensed,
// github.com/microsoft/fluentui-emoji). `icon` shows in the chips, list
// and detail; `emoji` is the plain-text stand-in for the Add form's
// <select>, since <option> can't render images.
const img = (src) => <img className="rc-icon" src={src} alt="" />

const TYPES = [
  { value: 'Breakfast', icon: img(breakfastIcon), emoji: '🍳' },
  { value: 'Lunch',     icon: img(lunchIcon),     emoji: '🥪' },
  { value: 'Dinner',    icon: img(dinnerIcon),    emoji: '🥩' },
  { value: 'Snack',     icon: img(snackIcon),     emoji: '🍿' },
  { value: 'Dessert',   icon: img(dessertIcon),   emoji: '🥧' },
  { value: 'Baking',    icon: img(bakingIcon),    emoji: '🍞' },
  { value: 'Drinks',    icon: img(drinksIcon),    emoji: '🧋' },
]

const typeIcon = (category) =>
  TYPES.find(t => t.value.toLowerCase() === String(category).trim().toLowerCase())?.icon || '🍽️'

const isUrl = (s) => /^https?:\/\/\S+$/i.test(String(s).trim())

// ── Recipe text rendering ──────────────────────────────────────
// Free-form cell text: lines ending in ":" become section headings
// ("Ingredients:", "Steps:"), numbered lines become ordered steps, every
// other non-blank line becomes a bullet. Any URLs inside get linkified.
function linkify(text) {
  return String(text).split(/(https?:\/\/\S+)/g).map((part, i) =>
    isUrl(part)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
      : part
  )
}

function parseSections(text) {
  const sections = []
  let current = { heading: null, lines: [] }
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    if (/^[^.]{1,40}:$/.test(line)) {
      if (current.heading || current.lines.length) sections.push(current)
      current = { heading: line.slice(0, -1), lines: [] }
    } else {
      current.lines.push(line)
    }
  }
  if (current.heading || current.lines.length) sections.push(current)
  return sections
}

function RecipeBody({ link }) {
  const text = String(link || '').trim()
  if (!text) return <div className="rc-empty">No recipe details saved yet.</div>

  if (isUrl(text)) {
    return (
      <a className="rc-open-link" href={text} target="_blank" rel="noopener noreferrer">
        Open recipe ↗
      </a>
    )
  }

  return parseSections(text).map((sec, i) => {
    const numbered = sec.lines.length > 0 && sec.lines.every(l => /^\d+[.)]\s/.test(l))
    const ListTag = numbered ? 'ol' : 'ul'
    return (
      <div key={i} className="rc-section">
        {sec.heading && <div className="rc-section-heading">{sec.heading}</div>}
        <ListTag className={numbered ? 'rc-steps' : 'rc-ingredients'}>
          {sec.lines.map((l, j) => (
            <li key={j}>{linkify(numbered ? l.replace(/^\d+[.)]\s*/, '') : l.replace(/^[-•*]\s*/, ''))}</li>
          ))}
        </ListTag>
      </div>
    )
  })
}

// ── Add / edit modal ───────────────────────────────────────────
// Pass `recipe` to edit an existing row; omit it to add a new one.
function RecipeModal({ recipe, onClose, onSaved }) {
  const editing = !!recipe
  const [values, setValues] = useState(() => ({
    name:       String(recipe?.name       ?? ''),
    category:   String(recipe?.category   || 'Dinner'),
    ingredient: String(recipe?.ingredient ?? ''),
    link:       String(recipe?.link       ?? ''),
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (id, val) => setValues(v => ({ ...v, [id]: val }))

  // A recipe saved under a category that's no longer in TYPES (or typed
  // straight into the sheet) still shows as an option, so editing it
  // doesn't silently switch it to the first category in the list.
  const categoryOptions = TYPES.some(t => t.value === values.category)
    ? TYPES
    : [...TYPES, { value: values.category, emoji: '🍽️' }]

  async function handleSubmit() {
    if (!values.name.trim()) return
    setSaving(true); setError('')
    try {
      const fd = new FormData()
      fd.append('action', editing ? 'update' : 'add'); fd.append('type', 'mealideas')
      if (editing) fd.append('idx', String(recipe.id))
      Object.entries(values).forEach(([k, v]) => fd.append(k, v.trim()))
      await apiFetch(SCRIPTS.CHORES, { method: 'POST', body: fd })
      onSaved()
      onClose()
    } catch {
      setError('Failed to save — try again')
      setSaving(false)
    }
  }

  return (
    <div className="rc-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rc-overlay-box">
        <div className="rc-overlay-title">{editing ? '✏️ Edit Recipe' : '🍳 Add a Recipe'}</div>
        <input
          className="rc-input"
          placeholder="Title, e.g. Apple Crisp"
          value={values.name}
          onChange={e => set('name', e.target.value)}
          autoFocus
        />
        <div className="rc-overlay-row">
          <select className="rc-input" value={values.category} onChange={e => set('category', e.target.value)}>
            {categoryOptions.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.value}</option>)}
          </select>
          <input
            className="rc-input"
            placeholder="Main ingredient, e.g. Apples"
            value={values.ingredient}
            onChange={e => set('ingredient', e.target.value)}
          />
        </div>
        <textarea
          className="rc-input rc-textarea"
          placeholder={'Paste a recipe link, or type it out:\n\nIngredients:\n6 apples\n...\n\nSteps:\n1. ...'}
          value={values.link}
          onChange={e => set('link', e.target.value)}
        />
        {error && <div className="rc-overlay-status">{error}</div>}
        <div className="rc-overlay-actions">
          <button className="rc-btn cancel" onClick={onClose}>Cancel</button>
          <button className="rc-btn submit" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function Recipes() {
  const [recipes, setRecipes]       = useState([])
  const [status, setStatus]         = useState('loading')
  const [query, setQuery]           = useState('')
  const [type, setType]             = useState('')
  const [ingredient, setIngredient] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [adding, setAdding]         = useState(false)
  const [editing, setEditing]       = useState(null)

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const res  = await apiFetch(`${SCRIPTS.CHORES}?type=mealideas`)
      const data = await res.json()
      setRecipes(Array.isArray(data) ? data : [])
      setStatus('ok')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Ingredient dropdown is built from whatever's actually in the sheet,
  // so it never offers a choice that matches nothing.
  const ingredients = useMemo(() => {
    const seen = new Map()
    recipes.forEach(r => {
      const v = String(r.ingredient || '').trim()
      if (v && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v)
    })
    return [...seen.values()].sort((a, b) => a.localeCompare(b))
  }, [recipes])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return recipes
      .filter(r => !q || String(r.name).toLowerCase().includes(q))
      .filter(r => !type || String(r.category).trim().toLowerCase() === type.toLowerCase())
      .filter(r => !ingredient || String(r.ingredient).trim().toLowerCase() === ingredient.toLowerCase())
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
  }, [recipes, query, type, ingredient])

  const selected = recipes.find(r => r.id === selectedId) || null
  const hasFilters = query || type || ingredient

  async function handleDelete(recipe) {
    if (!window.confirm(`Remove "${recipe.name}" from recipes?`)) return
    try {
      const fd = new FormData()
      fd.append('action', 'delete'); fd.append('type', 'mealideas'); fd.append('idx', recipe.id)
      await apiFetch(SCRIPTS.CHORES, { method: 'POST', body: fd })
      setSelectedId(null)
      load()
    } catch { /* silent, matches other lists */ }
  }

  return (
    <div className={`recipes-content${selected ? ' has-selection' : ''}`}>
      <div className="rc-browse">
        <Panel>
          <PanelHeader
            title="Find a Recipe"
            badge={status === 'ok' ? `${filtered.length} of ${recipes.length}` : null}
            actions={<button className="add-btn" aria-label="Add a recipe" onClick={() => setAdding(true)}><Icon name="plus" size="1em" /> Add</button>}
          />

          <div className="rc-filters">
            <input
              className="rc-input rc-search"
              type="search"
              placeholder="🔍 Search by title…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <div className="rc-chips">
              <button className={`rc-chip${!type ? ' active' : ''}`} onClick={() => setType('')}>All</button>
              {TYPES.map(t => (
                <button
                  key={t.value}
                  className={`rc-chip${type === t.value ? ' active' : ''}`}
                  onClick={() => setType(type === t.value ? '' : t.value)}
                >
                  {t.icon} {t.value}
                </button>
              ))}
            </div>
            <div className="rc-filter-row">
              <select className="rc-input" value={ingredient} onChange={e => setIngredient(e.target.value)}>
                <option value="">Any main ingredient</option>
                {ingredients.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
              {hasFilters && (
                <button className="rc-clear" onClick={() => { setQuery(''); setType(''); setIngredient('') }}>
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="rc-list">
            {status === 'loading' && <div className="rc-empty">Loading…</div>}
            {status === 'error'   && <div className="rc-empty">Unavailable</div>}
            {status === 'ok' && !filtered.length && (
              recipes.length
                ? <div className="rc-empty">No recipes match those filters</div>
                : <EmptyState icon="note">No recipes yet — tap Add to save one</EmptyState>
            )}
            {status === 'ok' && filtered.map(r => (
              <button
                key={r.id}
                className={`rc-item${r.id === selectedId ? ' active' : ''}`}
                onClick={() => setSelectedId(r.id)}
              >
                <span className="rc-item-icon">{typeIcon(r.category)}</span>
                <span className="rc-item-body">
                  <span className="rc-item-title">{r.name}</span>
                  <span className="rc-item-sub">
                    {[r.category, r.ingredient].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <div className="rc-detail">
        <Panel>
          {selected ? (
            <>
              <PanelHeader
                title={<span className="rc-detail-title">{selected.name}</span>}
                actions={
                  <>
                    <button className="add-btn rc-back" onClick={() => setSelectedId(null)}><Icon name="back" size="1em" /> Back</button>
                    <button className="add-btn" title="Edit recipe" onClick={() => setEditing(selected)}><Icon name="pencil" size="1em" /> Edit</button>
                    <button className="add-btn rc-delete" title="Remove recipe" aria-label="Remove recipe" onClick={() => handleDelete(selected)}><Icon name="trash" size="1em" /></button>
                  </>
                }
              />
              <div className="rc-detail-body">
                <div className="rc-tags">
                  {selected.category   && <span className="rc-tag">{typeIcon(selected.category)} {selected.category}</span>}
                  {selected.ingredient && <span className="rc-tag">🥕 {selected.ingredient}</span>}
                </div>
                <RecipeBody link={selected.link} />
              </div>
            </>
          ) : (
            <div className="rc-placeholder">
              <div className="rc-placeholder-icon">🍳</div>
              <div>Pick a recipe to see it here</div>
            </div>
          )}
        </Panel>
      </div>

      {adding  && <RecipeModal onClose={() => setAdding(false)} onSaved={load} />}
      {editing && <RecipeModal recipe={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  )
}
