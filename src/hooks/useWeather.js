import { useState, useEffect } from 'react'
import { WEATHER_CONFIG } from '../api/scripts'
import { cacheGet, cacheSet } from '../utils/cache'

const NWS_HEADERS = { 'User-Agent': 'FamilyHubApp (family-hub)' }
const DAY_LABELS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

// The NWS "points" lookup just resolves lat/lon → forecast office grid —
// for a fixed home location that answer never changes, so there's no
// reason to re-fetch it every single page load. Cache it for a month.
const POINTS_TTL_MS   = 30 * 24 * 60 * 60 * 1000
// The actual forecast does change — refresh at most every 30 min, but show
// the last cached forecast instantly instead of a loading spinner while
// the fresh one comes in (stale-while-revalidate).
const FORECAST_TTL_MS = 30 * 60 * 1000

// Always fetches the full week (At a Glance shows a forecast per day in
// its 7-day strip); the top bar trims to what it shows itself. "v2"
// because each day now carries its date — older cached entries didn't.
const FORECAST_DAYS = 7

function forecastCacheKey() {
  const { lat, lon } = WEATHER_CONFIG
  return `nws_forecast_v2_${lat},${lon}`
}

function nwsToIcon(shortForecast) {
  if (!shortForecast) return '🌡️'
  const f = shortForecast.toLowerCase()
  if (f.includes('thunderstorm') || f.includes('thunder'))              return '⛈️'
  if (f.includes('blizzard')     || f.includes('heavy snow'))           return '❄️'
  if (f.includes('snow shower')  || f.includes('snow and'))             return '🌨️'
  if (f.includes('snow'))                                                return '🌨️'
  if (f.includes('freezing')     || f.includes('sleet') || f.includes('wintry')) return '🌧️'
  if (f.includes('heavy rain')   || f.includes('rain shower'))          return '🌧️'
  if (f.includes('showers')      || f.includes('rain'))                 return '🌧️'
  if (f.includes('drizzle'))                                             return '🌦️'
  if (f.includes('fog')          || f.includes('haze') || f.includes('smoke')) return '🌫️'
  if (f.includes('windy')        || f.includes('breezy'))               return '💨'
  if (f.includes('mostly cloudy') || f.includes('partly cloudy'))       return '⛅'
  if (f.includes('overcast')     || f.includes('cloudy'))               return '☁️'
  if (f.includes('mostly sunny') || f.includes('partly sunny'))         return '🌤️'
  if (f.includes('sunny')        || f.includes('clear'))                return '☀️'
  return '🌡️'
}

// Local yyyy-mm-dd (toISOString would give the UTC date)
const localDate = d =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// One forecast request at a time for the whole app — the top bar and At a
// Glance's 7-day strip both use this hook, and on a cold cache they'd
// otherwise each hit NWS at the same moment.
let inflight = null

function getForecast() {
  const cached = cacheGet(forecastCacheKey(), FORECAST_TTL_MS)
  if (cached) return Promise.resolve(cached)
  if (!inflight) inflight = fetchForecast().finally(() => { inflight = null })
  return inflight
}

async function fetchForecast() {
  const forecastKey = forecastCacheKey()
  const { lat, lon } = WEATHER_CONFIG

  // Step 1 — resolve the NWS grid for this lat/lon. This never
  // changes for a fixed home location, so skip the round trip
  // entirely once we've resolved it once.
  const pointsKey = `nws_points_${lat},${lon}`
  let forecastUrl = cacheGet(pointsKey, POINTS_TTL_MS)
  if (!forecastUrl) {
    const pointsRes = await fetch(
      `https://api.weather.gov/points/${lat},${lon}`,
      { headers: NWS_HEADERS }
    )
    if (!pointsRes.ok) throw new Error(`NWS points ${pointsRes.status}`)
    const pointsData = await pointsRes.json()
    forecastUrl = pointsData.properties?.forecast
    if (!forecastUrl) throw new Error('No forecast URL from NWS')
    cacheSet(pointsKey, forecastUrl)
  }

  // Step 2 — fetch the daily forecast periods
  const fxRes  = await fetch(forecastUrl, { headers: NWS_HEADERS })
  if (!fxRes.ok) throw new Error(`NWS forecast ${fxRes.status}`)
  const fxData = await fxRes.json()
  const periods = fxData.properties?.periods
  if (!periods?.length) throw new Error('No forecast periods')

  // Build date → { high, low, icon, condition } from periods
  // NWS splits into daytime (high) and nighttime (low) half-day periods
  const byDate = new Map()
  for (const p of periods) {
    const dateStr = p.startTime.slice(0, 10)
    if (!byDate.has(dateStr)) byDate.set(dateStr, {})
    const entry = byDate.get(dateStr)
    if (p.isDaytime) {
      entry.high      = p.temperature
      entry.icon      = nwsToIcon(p.shortForecast)
      entry.condition = p.shortForecast
    } else {
      entry.low = p.temperature
      // If today's first period is overnight (afternoon already passed),
      // use night period for icon fallback
      if (entry.icon == null) {
        entry.icon      = nwsToIcon(p.shortForecast)
        entry.condition = p.shortForecast
      }
    }
  }

  const today    = new Date(); today.setHours(0, 0, 0, 0)

  const result = []
  for (let i = 0; result.length < FORECAST_DAYS && i < 8; i++) {
    const d       = new Date(today)
    d.setDate(d.getDate() + i)
    const dateStr = localDate(d)
    const entry   = byDate.get(dateStr)
    if (!entry) continue

    const hi   = entry.high != null ? `${entry.high}°` : '—'
    const lo   = entry.low  != null ? `${entry.low}°`  : '—'
    const temp = `${hi} / ${lo}`

    result.push({
      date:      dateStr,
      name:      i === 0 ? 'Today' : DAY_LABELS[d.getDay()],
      high:      entry.high ?? null,
      low:       entry.low  ?? null,
      icon:      entry.icon      ?? '🌡️',
      temp,
      condition: entry.condition ?? '',
    })
  }

  cacheSet(forecastKey, result)
  return result
}

export function useWeather() {
  const [days,    setDays]    = useState(() => cacheGet(forecastCacheKey()) || [])
  const [loading, setLoading] = useState(() => !cacheGet(forecastCacheKey()))
  const [error,   setError]   = useState(null)

  useEffect(() => {
    let alive = true
    const load = () => getForecast()
      .then(result => { if (alive) { setDays(result); setError(null) } })
      .catch(e => { if (alive) setError(e.message) })
      .finally(() => { if (alive) setLoading(false) })

    load()
    // A wall kiosk stays open for days: re-check every FORECAST_TTL so the
    // forecast (and which day is "Today") keeps up. Cheap when the cache
    // is still fresh — getForecast doesn't touch the network then.
    const id = setInterval(load, FORECAST_TTL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [])

  return { days, loading, error }
}
