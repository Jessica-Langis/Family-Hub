import { useState, useEffect, useRef, useCallback } from 'react'
import { SCRIPTS, apiFetch, getStoredSession, storeSession, clearStoredSession } from '../../api/scripts'
import './AuthGate.css'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

// Gates the whole app behind a real, backend-enforced Google Sign-In.
// The GAS script rejects any data request without a valid session token
// (see chores_gas_script.gs), so this isn't just a client-side UI lock —
// without signing in, no data loads at all, from any page.
export default function AuthGate({ children }) {
  const [session, setSession] = useState(() => getStoredSession())
  const [status, setStatus]   = useState('idle') // idle | verifying | denied | error
  const [deniedEmail, setDeniedEmail] = useState('')
  const buttonRef = useRef(null)

  const handleCredential = useCallback(async (response) => {
    setStatus('verifying')
    try {
      const fd = new FormData()
      fd.append('type', 'verify_token')
      fd.append('token', response.credential)
      const res  = await apiFetch(SCRIPTS.CHORES, { method: 'POST', body: fd })
      const data = await res.json()
      if (data.authorized && data.session) {
        const stored = storeSession({ token: data.session, expiresAt: data.expiresAt, email: data.email })
        setSession(stored)
        setStatus('idle')
      } else {
        setDeniedEmail(data.email || '')
        setStatus('denied')
      }
    } catch (err) {
      console.error('auth verify failed', err)
      setStatus('error')
    }
  }, [])

  // If any API call comes back "unauthorized" (session expired or revoked
  // mid-use), drop back to the sign-in screen instead of showing stale/empty data.
  useEffect(() => {
    function onAuthRequired() {
      clearStoredSession()
      setSession(null)
    }
    window.addEventListener('fh-auth-required', onAuthRequired)
    return () => window.removeEventListener('fh-auth-required', onAuthRequired)
  }, [])

  useEffect(() => {
    if (session) return
    if (!window.google?.accounts?.id) return
    if (!GOOGLE_CLIENT_ID) return

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredential,
      auto_select: true,
    })
    if (buttonRef.current) {
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'filled_black',
        size: 'large',
        type: 'standard',
      })
    }
    // Try a silent sign-in first — if this browser already has an active
    // Google session that previously consented, this resolves with no
    // click needed at all. That's what makes the 30-day session tolerable
    // for the At a Glance kiosk screen: worst case it's one silent prompt.
    window.google.accounts.id.prompt()
  }, [session, handleCredential])

  if (session) return children

  return (
    <div className="authgate-wrap">
      <div className="authgate-box">
        <div className="authgate-title">🏡 Family Hub</div>
        <div className="authgate-sub">Sign in with a family Google account to continue</div>

        {!GOOGLE_CLIENT_ID && (
          <div className="authgate-denied">
            Missing VITE_GOOGLE_CLIENT_ID — sign-in can't render until that's set.
          </div>
        )}
        {status === 'denied' && (
          <div className="authgate-denied">
            {deniedEmail || 'That account'} isn't on the family list. Ask Jessica to add it.
          </div>
        )}
        {status === 'error' && (
          <div className="authgate-denied">Something went wrong verifying sign-in — try again.</div>
        )}

        <div ref={buttonRef} className="authgate-btn" />
        {status === 'verifying' && <div className="authgate-status">Verifying…</div>}
      </div>
    </div>
  )
}
