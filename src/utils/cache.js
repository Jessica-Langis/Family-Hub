// ── Tiny localStorage cache with TTL ──────────────────────────
// Used to avoid re-hitting slow/rate-limited external APIs (NWS,
// Open-Meteo geocoding) on every page load. Not for GAS data — those
// stay live since they're the family's actual editable content.

const PREFIX = 'fh_cache_'

/**
 * Read a cached value. Returns undefined if missing, unreadable, or
 * older than maxAgeMs (when maxAgeMs is provided).
 */
export function cacheGet(key, maxAgeMs) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return undefined
    const { value, ts } = JSON.parse(raw)
    if (maxAgeMs != null && Date.now() - ts > maxAgeMs) return undefined
    return value
  } catch {
    return undefined
  }
}

export function cacheSet(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ value, ts: Date.now() }))
  } catch {
    /* storage full or unavailable — just skip caching */
  }
}
