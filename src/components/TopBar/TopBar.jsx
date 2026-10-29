import { useClock }   from '../../hooks/useClock'
import { useWeather } from '../../hooks/useWeather'
import WeatherIcon    from '../WeatherIcon/WeatherIcon'
import './TopBar.css'

// compact: trims the weather strip to just today's condition and lays it
// out sideways in a shorter bar — used on At a Glance, where a full 5-day
// forecast is more detail than a walk-by wall screen needs (its 7-day
// strip has per-day weather) and the height is better spent on events.
// The 5-day view is still useful elsewhere, so it's opt-in per page.
export default function TopBar({ tab, compact = false }) {
  const { clock, date }      = useClock()
  const { days, loading }    = useWeather()
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  const visibleDays = days.slice(0, compact ? 1 : isMobile ? 3 : 5)

  return (
    <div className={`topbar${compact ? ' compact' : ''}`}>
      <div className="topbar-title" style={tab?.color ? { color: tab.color } : {}}>
        {tab?.icon && <img className="topbar-title-icon" src={tab.icon} alt="" />}
        <span>{tab?.label}</span>
      </div>

      <div className="clock-block">
        <div className="clock">{clock}</div>
        <div className="clock-date">{date}</div>
      </div>

      <div className="weather-block">
        {loading ? (
          <span className="weather-loading">Loading...</span>
        ) : visibleDays.length === 0 ? (
          <span className="weather-loading">Weather unavailable</span>
        ) : (
          visibleDays.map((d, i) => (
            <div className="weather-day" key={i}>
              <div className="day-name">{d.name}</div>
              <WeatherIcon emoji={d.icon} className="weather-icon" />
              <div className="weather-text">
                <div className="temp">{d.temp}</div>
                <div className="condition">{d.condition}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
