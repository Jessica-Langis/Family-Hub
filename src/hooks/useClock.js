import { useState, useEffect } from 'react'

const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatTime(now) {
  const h    = now.getHours()
  const mins = now.getMinutes().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12  = (h % 12) || 12
  return {
    clock: `${h12}:${mins} ${ampm}`,
    date:  `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`,
  }
}

export function useClock() {
  const [time, setTime] = useState(() => formatTime(new Date()))

  useEffect(() => {
    // The display only shows hours:minutes, so there's no need to re-render
    // every second (that's 60x more work than the UI needs). Instead, tick
    // once now and then align to the start of each following minute.
    let id
    function scheduleNext() {
      const now = new Date()
      const msToNextMinute = 60000 - (now.getSeconds() * 1000 + now.getMilliseconds())
      id = setTimeout(() => {
        setTime(formatTime(new Date()))
        scheduleNext()
      }, msToNextMinute)
    }
    scheduleNext()
    return () => clearTimeout(id)
  }, [])

  return time
}
