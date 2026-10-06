// ── Color-coded name tag ───────────────────────────────────────────────
// Shows who a task belongs to in that person's color (--person-* in
// tokens.css), capitalized — "tori" in the sheet shows as "Tori". Names
// it doesn't recognize still get a tag, in the shared "other" color.

const KNOWN = ['tori', 'nova', 'mom', 'dad']

export function personKey(name) {
  const k = String(name || '').trim().toLowerCase()
  return KNOWN.includes(k) ? k : 'other'
}

export function displayName(name) {
  return String(name || '').trim().replace(/\b\w/g, c => c.toUpperCase())
}

export default function PersonTag({ name }) {
  if (!String(name || '').trim()) return null
  return (
    <span className="person-tag" data-person={personKey(name)}>{displayName(name)}</span>
  )
}
