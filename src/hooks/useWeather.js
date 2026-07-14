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

function forecastCacheKey() {
  const { lat, lon } = WEATHER_CONFIG
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  const count    = isMobile ? 3 : 5
  return `nws_forecast_${lat},${lon}_${count}`
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

export function useWeather() {
  const [days,    setDays]    = useState(() => cacheGet(forecastCacheKey()) || [])
  const [loading, setLoading] = useState(() => !cacheGet(forecastCacheKey()))
  const [error,   setError]   = useState(null)

  useEffect(() => {
    async function load() {
      // Fresh cached forecast? Skip the network entirely.
      const forecastKey = forecastCacheKey()
      const cached = cacheGet(forecastKey, FORECAST_TTL_MS)
      if (cached) {
        setDays(cached)
        setLoading(false)
        return
      }

      try {
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

        const isMobile = window.innerWidth <= 768
        const count    = isMobile ? 3 : 5
        const today    = new Date(); today.setHours(0, 0, 0, 0)

        const result = []
        for (let i = 0; result.length < count && i < 8; i++) {
          const d       = new Date(today)
          d.setDate(d.getDate() + i)
          const dateStr = d.toISOString().slice(0, 10)
          const entry   = byDate.get(dateStr)
          if (!entry) continue

          const hi   = entry.high != null ? `${entry.high}°` : '—'
          const lo   = entry.low  != null ? `${entry.low}°`  : '—'
          const temp = `${hi} / ${lo}`

          result.push({
            name:      i === 0 ? 'Today' : DAY_LABELS[d.getDay()],
            icon:      entry.icon      ?? '🌡️',
            temp,
            condition: entry.condition ?? '',
          })
        }

        setDays(result)
        cacheSet(forecastKey, result)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  return { days, loading, error }
}
