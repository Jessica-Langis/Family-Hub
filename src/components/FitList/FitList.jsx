import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from '../Icon/Icon'
import './FitList.css'

// ── A list that never scrolls ─────────────────────────────────────────
// Renders its children as rows. When the tile around it (a Panel or any
// other useAutoFit tile) can't fit everything even at the smallest
// readable text, useAutoFit hides rows from the end and this shows a
// "+N more" button in their place. Tapping it opens every row in a popup,
// built from the same children, so rows work there exactly as in the tile
// (check off a chore, open an event, delete an item).
//
// Props:
//   className   — the list's own class (its layout styles apply in the
//                 popup too)
//   title       — popup heading
//   extra       — rows not rendered at all (a fixed cap upstream), added
//                 to the "+N more" count
//   allChildren — rows for the popup when they differ from `children`
//                 (used with `extra`); defaults to children
//   onMore      — replaces the built-in popup (e.g. Bulletin's own)
//   closeOnPick — close the popup when a row is tapped (e.g. a recipe,
//                 which opens beside the list rather than on top)
//   moreLabel   — n => button text
export default function FitList({
  className = '', title = 'All', children, extra = 0, allChildren, onMore,
  closeOnPick = false, moreLabel = n => `+${n} more`, as: Tag = 'div', ...rest
}) {
  const ref = useRef(null)
  const [hidden, setHidden] = useState(0)
  const [open, setOpen] = useState(false)

  // Layout effect, not a plain effect: the tile can fit (and announce a
  // trim) before a plain effect would have attached the listener. The
  // count already on the DOM covers a trim that landed even earlier.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const onTrim = e => setHidden(e.detail)
    el.addEventListener('fittrim', onTrim)
    setHidden(el.querySelectorAll(':scope > [data-fit-hidden]').length)
    return () => el.removeEventListener('fittrim', onTrim)
  }, [])

  const more = hidden + extra
  const showAll = () => (onMore ? onMore() : setOpen(true))

  return (
    <>
      <Tag ref={ref} className={className} data-fit-list="" {...rest}>
        {children}
        {/* Always in the DOM so useAutoFit can measure it; shown by
            useAutoFit (data-shown) when it trims, or here for `extra` */}
        <button
          type="button"
          className="fit-more"
          data-fit-more=""
          data-extra={extra > 0 ? '' : undefined}
          onClick={showAll}
        >
          {moreLabel(more)}
        </button>
      </Tag>
      {open && createPortal(
        <div className="overlay fit-list-overlay" onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div className="overlay-box fit-list-box">
            <button className="overlay-close" aria-label="Close" onClick={() => setOpen(false)}><Icon name="x" /></button>
            <div className="overlay-title">{title}</div>
            <div
              className={`${className} fit-list-all`}
              onClick={closeOnPick ? e => { if (e.target !== e.currentTarget) setOpen(false) } : undefined}
            >
              {allChildren ?? children}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
