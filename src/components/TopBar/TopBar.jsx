import { useClock }   from '../../hooks/useClock'
import { useWeather } from '../../hooks/useWeather'
import WeatherIcon    from '../WeatherIcon/WeatherIcon'
import './TopBar.css'

// compact: trims the weather strip to just today's condition — used on
// At a Glance, where a full 5-day forecast is more detail than a walk-by
// wall screen needs (the 5-day view is still useful elsewhere, so it's
// opt-in per page rather than removed globally).
export default function TopBar({ tab, compact = false }) {
  const { clock, date }      = useClock()
  const { days, loading }    = useWeather()
  const visibleDays = compact ? days.slice(0, 1) : days

  return (
    <div className="topbar">
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
              <div className="temp">{d.temp}</div>
              <div className="condition">{d.condition}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
