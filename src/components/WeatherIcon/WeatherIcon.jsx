// ── Weather icon ───────────────────────────────────────────────────────
// useWeather reports each day's condition as an emoji (☀️ 🌧️ …); this
// draws the matching Fluent Emoji 3D image instead, so the weather matches
// the rest of the app's icons. Sized in em, like a glyph.
import thermometer  from '../../assets/weather-icons/thermometer.png'
import thunder      from '../../assets/weather-icons/thunder.png'
import snowflake    from '../../assets/weather-icons/snowflake.png'
import snow         from '../../assets/weather-icons/snow.png'
import rain         from '../../assets/weather-icons/rain.png'
import drizzle      from '../../assets/weather-icons/drizzle.png'
import fog          from '../../assets/weather-icons/fog.png'
import wind         from '../../assets/weather-icons/wind.png'
import partlyCloudy from '../../assets/weather-icons/partly_cloudy.png'
import cloudy       from '../../assets/weather-icons/cloudy.png'
import mostlySunny  from '../../assets/weather-icons/mostly_sunny.png'
import sunny        from '../../assets/weather-icons/sunny.png'

// Keyed by the emoji useWeather's nwsToIcon returns. The invisible
// emoji variation selector (U+FE0F) is stripped from both sides, since
// it's present on some and not others.
const strip = (e) => String(e || '').replace(/\uFE0F/g, '')
const RAW = {
  '🌡️': thermometer, '⛈️': thunder, '❄️': snowflake, '🌨️': snow,
  '🌧️': rain, '🌦️': drizzle, '🌫️': fog, '💨': wind,
  '⛅': partlyCloudy, '☁️': cloudy, '🌤️': mostlySunny, '☀️': sunny,
}
const IMAGES = Object.fromEntries(Object.entries(RAW).map(([k, v]) => [strip(k), v]))

export default function WeatherIcon({ emoji, className = '' }) {
  const src = IMAGES[strip(emoji)]
  if (!src) return <span className={className}>{emoji}</span>
  return <img className={`weather-img ${className}`} src={src} alt="" />
}
