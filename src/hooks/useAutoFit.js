import { useLayoutEffect, useRef } from 'react'

// ── Fit a tile's text to its box ──────────────────────────────────────
// Pages give every tile a fixed share of the screen (no page scroll).
// This hook finds the largest --fit (≤ 1) at which the tile's content
// fits without scrolling or clipping, and sets it on the tile. The type
// tokens in tokens.css multiply by --fit inside any `.fit-scope`.
//
// It never shrinks text below a readability floor (MIN_*_PX). A tile that
// still doesn't fit at the floor keeps the floor size and scrolls — the
// one case where a tile is allowed to scroll.
//
// Phones are skipped: there the page stacks tiles and scrolls instead,
// so text always stays full size.
//
// Usage: const ref = useAutoFit(); <div ref={ref} className="my-tile fit-scope">
// (put `fit-scope` in the JSX class list — React would drop a class that
// was only added from here the next time it re-renders the className)

const MIN_MD_PX = 13     // body text never below this
const MIN_XS_PX = 11     // labels / badges never below this
const SEARCH_STEPS = 7   // binary-search passes (~0.2% precision)
const PHONE_QUERY = '(max-width: 640px)'
// Pop-ups render inside some tiles but are fixed to the viewport, so
// their contents never count toward the tile's fit
const OVERLAY_SELECTOR = '.overlay, .fun-overlay, .rc-overlay'

// Measures a base token in px (it's a viewport-based clamp, so it has to
// be resolved by the browser rather than parsed).
function tokenPx(token) {
  const probe = document.createElement('span')
  probe.style.cssText = `position:absolute;visibility:hidden;font-size:var(${token})`
  document.body.appendChild(probe)
  const px = parseFloat(getComputedStyle(probe).fontSize)
  probe.remove()
  return px
}

function minFit() {
  const md = tokenPx('--fs-md-base')
  const xs = tokenPx('--fs-xs-base')
  return Math.min(1, Math.max(MIN_MD_PX / md, MIN_XS_PX / xs))
}

function fitTile(el) {
  if (!el.isConnected || el.clientHeight === 0) return  // hidden tab
  const setFit = (v) => el.style.setProperty('--fit', String(v))

  setFit(1)
  if (window.matchMedia(PHONE_QUERY).matches) return

  // Anything inside that scrolls or clips can overflow without the tile
  // itself growing, so those get checked too.
  const clippers = [...el.querySelectorAll('*')].filter(d =>
    getComputedStyle(d).overflowY !== 'visible' && !d.closest(OVERLAY_SELECTOR))
  const overflows = () =>
    el.scrollHeight > el.clientHeight + 1 ||
    clippers.some(c => c.scrollHeight > c.clientHeight + 1)

  // Measure with scrollbars hidden. Otherwise a list that overflows grows
  // a scrollbar, which narrows it, which wraps more text, which keeps it
  // overflowing — so the answer would depend on which side of the fit
  // point the search came from.
  const scrollers = clippers.filter(c => getComputedStyle(c).overflowY !== 'hidden')
  const saved = scrollers.map(c => c.style.overflowY)
  scrollers.forEach(c => { c.style.overflowY = 'hidden' })

  try {
    if (!overflows()) return

    let lo = minFit(), hi = 1
    setFit(lo)
    if (overflows()) return  // doesn't fit even at the floor — scroll

    for (let i = 0; i < SEARCH_STEPS; i++) {
      const mid = (lo + hi) / 2
      setFit(mid)
      if (overflows()) hi = mid
      else lo = mid
    }
    setFit(lo)
  } finally {
    scrollers.forEach((c, i) => { c.style.overflowY = saved[i] })
  }
}

export default function useAutoFit() {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    let raf = 0
    let lastW = -1, lastH = -1
    const run = () => {
      fitTile(el)
      lastW = el.clientWidth
      lastH = el.clientHeight
    }
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(run)
    }

    // Resizes: window, grid changes, tab becoming visible. Our own --fit
    // change can resize a content-sized tile; skip when the size is what
    // the last fit produced, so it can't loop.
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== lastW || el.clientHeight !== lastH) schedule()
    })
    // Content: rows added/removed, text edited, lists swapped
    const mo = new MutationObserver(schedule)
    ro.observe(el)
    mo.observe(el, { childList: true, subtree: true, characterData: true })
    // Images (recipe icons) change height when they load; load doesn't
    // bubble, so listen in the capture phase
    el.addEventListener('load', schedule, true)
    window.addEventListener('resize', schedule)
    document.fonts?.ready.then(schedule)
    schedule()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      mo.disconnect()
      el.removeEventListener('load', schedule, true)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  return ref
}
