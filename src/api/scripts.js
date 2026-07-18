// ── Google Apps Script endpoints ──
// Real values come from build-time env vars (see .env.example) so the
// actual deployment URLs never land in the git repo. Vite inlines these
// into the built JS bundle at build time — that part is unavoidable for a
// client-only app calling GAS directly (anyone can still view-source the
// live site), but they're at least not sitting in source control / repo
// history for anyone browsing GitHub to find.
export const SCRIPTS = {
  GROCERY: import.meta.env.VITE_SCRIPT_GROCERY || '',
  CHORES:  import.meta.env.VITE_SCRIPT_CHORES  || '',
  MEAL:    import.meta.env.VITE_SCRIPT_MEAL    || '',
  TORI:    import.meta.env.VITE_SCRIPT_TORI    || '',
  NOVA:    import.meta.env.VITE_SCRIPT_NOVA    || '',
}

// ── Google Calendar ──
export const CALENDAR = {
  FAMILY_EMBED: import.meta.env.VITE_CALENDAR_EMBED_URL || '',
  FAMILY_ICS:   import.meta.env.VITE_CALENDAR_ICS_URL   || '',
}

// ── Weather config (Open-Meteo, no key required) ──
// Home lat/lon moved to env too — no reason the family's approximate
// physical location needs to sit in a public repo.
export const WEATHER_CONFIG = {
  lat:      Number(import.meta.env.VITE_WEATHER_LAT) || 0,
  lon:      Number(import.meta.env.VITE_WEATHER_LON) || 0,
  timezone: import.meta.env.VITE_WEATHER_TZ || 'America/Los_Angeles',
}

if (import.meta.env.DEV) {
  const missing = Object.entries(SCRIPTS).filter(([, v]) => !v).map(([k]) => `VITE_SCRIPT_${k}`)
  if (!WEATHER_CONFIG.lat || !WEATHER_CONFIG.lon) missing.push('VITE_WEATHER_LAT/VITE_WEATHER_LON')
  if (missing.length) {
    console.warn(`[scripts.js] Missing env vars: ${missing.join(', ')} — copy .env.example to .env and fill in real values.`)
  }
}

// ── Auth session (Google Sign-In gate) ──
// The GAS backend now rejects any request without a valid ?session= token
// (see chores_gas_script.gs's checkSession/createSession). The session is
// issued once by verify_token and lasts 30 days — long enough that the
// At a Glance kiosk screen only needs a fresh sign-in monthly, not hourly.
const SESSION_KEY = 'fh_session'

export function getStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.token || !parsed?.expiresAt) return null
    if (new Date(parsed.expiresAt) <= new Date()) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function storeSession({ token, expiresAt, email }) {
  const value = { token, expiresAt, email }
  localStorage.setItem(SESSION_KEY, JSON.stringify(value))
  return value
}

export function clearStoredSession() {
  localStorage.removeItem(SESSION_KEY)
}

// ── Shared fetch wrapper ──
// GAS web apps occasionally hang instead of erroring — without a timeout a
// stuck request just leaves the UI spinning forever with no way to recover.
// 20s is generous (GAS cold starts can be slow) but guarantees callers
// eventually get an error they can show/retry instead of an endless spinner.
const DEFAULT_TIMEOUT_MS = 20000

export async function apiFetch(url, options = {}) {
  // Auto-attach the session token to every request so individual call
  // sites throughout the app don't each need to remember to do it.
  const session = getStoredSession()
  let finalUrl = url
  const finalOptions = { ...options }
  if (session) {
    if (finalOptions.body instanceof FormData) {
      finalOptions.body.append('session', session.token)
    } else {
      const sep = finalUrl.includes('?') ? '&' : '?'
      finalUrl = `${finalUrl}${sep}session=${encodeURIComponent(session.token)}`
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), finalOptions.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  try {
    const res = await fetch(finalUrl, { ...finalOptions, signal: finalOptions.signal ?? controller.signal })
    if (!res.ok) throw new Error(`API error ${res.status}: ${finalUrl}`)
    // GAS always answers HTTP 200 even when our own auth gate rejects a
    // request, so peek at the body for that case and force a re-login
    // rather than letting callers silently render empty data.
    res.clone().json().then(body => {
      if (body && body.authRequired) {
        clearStoredSession()
        window.dispatchEvent(new CustomEvent('fh-auth-required'))
      }
    }).catch(() => { /* not JSON, or already consumed — ignore */ })
    return res
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`Request timed out: ${finalUrl}`)
    throw e
  } finally {
    clearTimeout(timer)
  }
}
