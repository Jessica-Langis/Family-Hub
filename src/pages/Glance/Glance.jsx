import { useState, useEffect, useCallback, useLayoutEffect, useRef, Component } from 'react'
import Panel, { PanelHeader } from '../../components/Panel/Panel'
import { SCRIPTS, apiFetch } from '../../api/scripts'
import { getNextUSHolidays } from '../Home/homeUtils'
import BulletinPanel from '../Home/panels/BulletinPanel'
import { cacheGet, cacheSet } from '../../utils/cache'
import './Glance.css'

// ── At a Glance — redesigned as 3 static zones instead of 5 stacked
// modules (clock/weather header via TopBar, this page's Events hero, and
// a compact Bulletin strip). No auto-rotation — this is a walk-by kiosk
// screen near the front door, so everything needs to be visible at once,
// just prioritized instead of all competing equally. The old 2-week
// calendar grid moved to And Stuff (that's "sit and plan" content, not
// "glance" content); holidays now fold into the same ranked list as real
// events instead of getting their own separate section.

const NWS_HEADERS = { 'User-Agent': 'FamilyHubApp (family-hub)' }
const GEO_TTL_MS  = 30 * 24 * 60 * 60 * 1000
const ICON_TTL_MS = 6 * 60 * 60 * 1000

// ── helpers ───────────────────────────────────────────────────
function evSummary(ev) {
  return typeof ev === 'string' ? ev : (ev.summary || ev.name || '')
}

function dateParts(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function toDateStr(di) {
  return di instanceof Date ? dateParts(di) : String(di)
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtFull(dateInput) {
  const str = toDateStr(dateInput)
  const d = new Date(str + 'T00:00:00')
  if (isNaN(d.getTime())) return ''
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2,'0')} ${d.getFullYear()}`
}

// Returns { days, hours, hasTime } — hours only available when a time is provided
function getCountdown(dateStr, timeStr) {
  const now        = new Date()
  const todayStart = new Date(); todayStart.setHours(0,0,0,0)
  const targetDay  = new Date(dateStr + 'T00:00:00')
  const days       = Math.round((targetDay - todayStart) / 86400000)

  if (timeStr) {
    const full = new Date(dateStr + ' ' + timeStr)
    if (!isNaN(full.getTime())) {
      const ms = full - now
      if (ms <= 0) return { days: 0, hours: 0, hasTime: true, past: true }
      const totalH = Math.floor(ms / 3600000)
      return { days: Math.floor(totalH / 24), hours: totalH % 24, hasTime: true }
    }
  }
  return { days: Math.max(0, days), hours: null, hasTime: false }
}

// Returns true if a timed event ended 2+ hours ago (triggers removal from the tile)
function isStale(dateStr, timeStr) {
  if (!timeStr) return false
  const t = new Date(dateStr + ' ' + timeStr)
  if (isNaN(t.getTime())) return false
  return (new Date() - t) >= 2 * 60 * 60 * 1000
}

// ── Weather icon (NWS api.weather.gov — no API key, same data as Google) ──
function nwsForecastToEmoji(shortForecast) {
  if (!shortForecast) return null
  const f = shortForecast.toLowerCase()
  if (f.includes('thunderstorm') || f.includes('thunder'))       return '⛈️'
  if (f.includes('blizzard') || f.includes('heavy snow'))        return '❄️'
  if (f.includes('snow shower') || f.includes('snow and'))       return '🌨️'
  if (f.includes('snow'))                                         return '🌨️'
  if (f.includes('freezing rain') || f.includes('sleet') || f.includes('wintry mix')) return '🌧️'
  if (f.includes('heavy rain') || f.includes('rain shower'))     return '🌧️'
  if (f.includes('showers') || f.includes('rain'))               return '🌧️'
  if (f.includes('drizzle'))                                      return '🌦️'
  if (f.includes('fog') || f.includes('haze') || f.includes('smoke')) return '🌫️'
  if (f.includes('windy') || f.includes('breezy'))               return '💨'
  if (f.includes('overcast') || f.includes('cloudy'))            return '☁️'
  if (f.includes('mostly cloudy') || f.includes('partly cloudy')) return '⛅'
  if (f.includes('mostly sunny') || f.includes('partly sunny'))  return '🌤️'
  if (f.includes('sunny') || f.includes('clear'))                return '☀️'
  return null
}

const _weatherCache = new Map()

function useWeatherIcon(location, dateStr) {
  const [icon, setIcon] = useState(null)

  useEffect(() => {
    if (!location || !dateStr) return
    const target  = new Date(dateStr + 'T00:00:00')
    const todayMs = (() => { const t = new Date(); t.setHours(0,0,0,0); return t })()
    const diff    = Math.round((target - todayMs) / 86400000)
    if (diff < 0 || diff > 7) return

    const key = `${location}|${dateStr}`
    if (_weatherCache.has(key)) { setIcon(_weatherCache.get(key)); return }

    const iconKey = `nws_icon_${key}`
    const cachedIcon = cacheGet(iconKey, ICON_TTL_MS)
    if (cachedIcon) { _weatherCache.set(key, cachedIcon); setIcon(cachedIcon); return }

    async function load() {
      try {
        const cityName  = location.split(',')[0].trim()
        const geoKey    = `geocode_${cityName.toLowerCase()}`
        let coords = cacheGet(geoKey, GEO_TTL_MS)
        if (!coords) {
          const geoRes  = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`
          )
          const geoData = await geoRes.json()
          if (!geoData.results?.length) return
          const { latitude, longitude } = geoData.results[0]
          coords = { latitude, longitude }
          cacheSet(geoKey, coords)
        }

        const pointsKey = `nws_points_${coords.latitude.toFixed(4)},${coords.longitude.toFixed(4)}`
        let forecastUrl = cacheGet(pointsKey, GEO_TTL_MS)
        if (!forecastUrl) {
          const pointsRes = await fetch(
            `https://api.weather.gov/points/${coords.latitude.toFixed(4)},${coords.longitude.toFixed(4)}`,
            { headers: NWS_HEADERS }
          )
          const pointsData = await pointsRes.json()
          forecastUrl = pointsData.properties?.forecast
          if (!forecastUrl) return
          cacheSet(pointsKey, forecastUrl)
        }

        const fxRes  = await fetch(forecastUrl, { headers: NWS_HEADERS })
        const fxData = await fxRes.json()
        const periods = fxData.properties?.periods
        if (!periods?.length) return

        const match = periods.find(p => {
          const pDate = p.startTime?.slice(0, 10)
          return pDate === dateStr && p.isDaytime !== false
        }) || periods.find(p => p.startTime?.slice(0, 10) === dateStr)

        if (!match) return
        const emoji = nwsForecastToEmoji(match.shortForecast)
        if (emoji) {
          _weatherCache.set(key, emoji)
          cacheSet(iconKey, emoji)
          setIcon(emoji)
        }
      } catch { /* silently fall back to pin icon */ }
    }
    load()
  }, [location, dateStr])

  return icon
}

// ── Error Boundary ────────────────────────────────────────────
class GlanceErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--muted)' }}>
          <div style={{ color: '#e07070', marginBottom: 8 }}>⚠ Something went wrong</div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', wordBreak: 'break-all',
            marginBottom: 20 }}>{this.state.error?.message}</div>
          <button
            style={{ padding: '6px 18px', background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 8, color: 'var(--text)', cursor: 'pointer', fontSize: '0.85rem' }}
            onClick={() => this.setState({ error: null })}
          >Retry</button>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Main page ─────────────────────────────────────────────────
export default function Glance() {
  const [calDays, setCalDays] = useState([])

  const loadAll = useCallback(async () => {
    try {
      const data = await apiFetch(SCRIPTS.CHORES + '?type=upcoming&days=60').then(r => r.json())
      setCalDays(Array.isArray(data) ? data : [])
    } catch (e) { console.error('glance calendar load', e) }
  }, [])

  useEffect(() => {
    loadAll()
    const id = setInterval(loadAll, 60 * 60 * 1000)
    return () => clearInterval(id)
  }, [loadAll])

  return (
    <GlanceErrorBoundary>
      <div className="glance-content">
        <div className="glance-col-events">
          <EventsPanel calDays={calDays} />
        </div>
        <div className="glance-col-bulletin">
          <BulletinPanel
            compact
            bodyClassName="bulletin-strip-compact"
            limit={3}
            style={{ height: '100%' }}
          />
        </div>
      </div>
    </GlanceErrorBoundary>
  )
}

// ── Auto-sizing title — binary-searches for largest fitting font ──
function AutoSizeTitle({ text, color }) {
  const ref = useRef(null)

  const measure = useCallback(() => {
    const el = ref.current
    if (!el || el.clientWidth === 0) return

    const block  = el.closest('.glance-ev-block')
    const cell   = el.closest('.glance-split-half')
    let heightCapRem = 2.0
    if (block && cell) {
      const siblingsH = Array.from(block.children)
        .filter(c => c !== el)
        .reduce((sum, c) => sum + c.getBoundingClientRect().height, 0)
      const available = cell.clientHeight - siblingsH
      const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      heightCapRem = Math.max(0.6, (available / 1.15 / rootPx) * 0.85)
    }

    let lo = 0.4, hi = Math.min(2.4, heightCapRem)
    if (hi <= lo) hi = lo + 0.1
    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) / 2
      el.style.fontSize = `${mid}rem`
      if (el.scrollWidth <= el.clientWidth) lo = mid
      else hi = mid
    }
    el.style.fontSize = `${(lo * 0.95).toFixed(3)}rem`
  }, [])

  useLayoutEffect(() => {
    measure()
  }, [text, measure])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const target = el.closest('.glance-split-half') || el
    const ro = new ResizeObserver(() => measure())
    ro.observe(target)
    return () => ro.disconnect()
  }, [measure])

  return <div ref={ref} className="glance-ev-title" style={{ color }}>{text}</div>
}

// ── 4-row event block ─────────────────────────────────────────
function EventBlock({ name, dateStr, timeStr, location, accentColor }) {
  const ds          = toDateStr(dateStr)
  const cd          = getCountdown(ds, timeStr)
  const weatherIcon = useWeatherIcon(location, ds)

  return (
    <div className="glance-ev-block">
      <AutoSizeTitle text={name} color={accentColor} />
      <div className="glance-ev-block-date">
        {fmtFull(dateStr)}{timeStr ? ` · ${timeStr}` : ''}
      </div>
      {location && (
        <div className="glance-ev-block-loc">
          {weatherIcon ?? '📍'} {location}
        </div>
      )}
      {!cd.past && (
        <div className="glance-ev-block-countdown">
          {cd.hasTime && cd.days === 0
            ? <span className="glance-ev-cd-days" style={{ color: accentColor }}>
                {cd.hours === 0 ? 'NOW' : `${cd.hours}h`}
              </span>
            : <>
                <span className="glance-ev-cd-days" style={{ color: accentColor }}>
                  {cd.days === 0 ? 'TODAY' : `${cd.days} ${cd.days === 1 ? 'day' : 'days'}`}
                </span>
                {cd.hasTime && cd.days > 0 && cd.hours != null && (
                  <span className="glance-ev-cd-hours" style={{ color: accentColor, opacity: 0.65 }}>{cd.hours}h</span>
                )}
              </>
          }
        </div>
      )}
    </div>
  )
}

// ── Calendar cell — handles 1, 2, or 3+ events on the same day ─
function CalCell({ day, accentColor, secondary }) {
  const cls = `glance-split-half${secondary ? ' glance-split-secondary' : ''}`
  if (!day?.events?.length) {
    return <div className={cls}><span className="next-up-empty">Nothing else on the horizon</span></div>
  }
  const evts   = day.events
  const getTime     = ev => (ev.isAllDay === false && ev.startTime) ? ev.startTime : null
  const getLocation = ev => (typeof ev === 'string' ? null : (ev.location || null))
  const ev1    = evts[0]
  const ev2    = evts[1] ?? null
  const rest   = evts.slice(2)
  return (
    <div className={cls}>
      <EventBlock name={evSummary(ev1)} dateStr={day.date} timeStr={getTime(ev1)} location={getLocation(ev1)} accentColor={accentColor} />
      {ev2 && <>
        <div className="glance-ev-inner-divider" />
        <EventBlock name={evSummary(ev2)} dateStr={day.date} timeStr={getTime(ev2)} location={getLocation(ev2)} accentColor={accentColor} />
      </>}
      {rest.length > 0 && <>
        <div className="glance-ev-inner-divider" />
        <div className="glance-ev-rest">
          {rest.map((ev, i) => <div key={i} className="glance-ev-rest-item">· {evSummary(ev)}</div>)}
        </div>
      </>}
    </div>
  )
}

// ── Events panel — merges real calendar events and holidays into ONE
// list, but real events always win the two slots first; a holiday only
// fills a slot if there's nothing else to show there. Holidays no longer
// get a guaranteed separate section, but they also can't crowd out real
// events just by happening to fall sooner on the calendar — a holiday
// 5 days out no longer bumps a real event 3 weeks out off the screen.
function EventsPanel({ calDays }) {
  const today    = new Date(); today.setHours(0,0,0,0)
  const todayStr = dateParts(today)

  const calWithEvents = calDays
    .filter(d => d.date >= todayStr && d.events?.length > 0)
    .map(d => ({
      ...d,
      accentColor: 'var(--accent6)',
      events: d.events.filter(ev => {
        const t = ev.isAllDay === false && ev.startTime ? ev.startTime : null
        return !isStale(d.date, t)
      })
    }))
    .filter(d => d.events.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date))

  const holidayEntries = getNextUSHolidays(3)
    .map(h => ({
      date: dateParts(h.date),
      accentColor: 'var(--accent2)',
      events: [{ summary: h.name }],
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const merged = calWithEvents.slice(0, 2)
  if (merged.length < 2) merged.push(...holidayEntries.slice(0, 2 - merged.length))
  merged.sort((a, b) => a.date.localeCompare(b.date))

  return (
    <Panel className="glance-events-panel">
      <PanelHeader title={<span style={{ color: 'var(--accent6)' }}>What's Happening</span>} />
      <div className="glance-events-body">
        <div className="glance-card-row">
          <CalCell day={merged[0] ?? null} accentColor={merged[0]?.accentColor ?? 'var(--accent6)'} />
          <div className="glance-split-divider" />
          <CalCell day={merged[1] ?? null} accentColor={merged[1]?.accentColor ?? 'var(--accent6)'} secondary />
        </div>
      </div>
    </Panel>
  )
}
