// ── Local-only mock backend (VITE_SKIP_AUTH dev mode) ────────────────
// Stands in for every Google Apps Script endpoint the app normally talks
// to (chores, bulletin, movies/books, wishlists, Tori/Nova events &
// reminders, meals, grocery, and the calendar's "upcoming" feed), so
// layout/framework work can happen fully offline with data that looks
// real instead of empty panels. Everything below lives in memory only —
// it resets on every page reload and never touches a real spreadsheet,
// calendar, or network. Wired in from apiFetch() in scripts.js, which is
// the only caller; nothing else should import this directly.

function pad2(n) { return String(n).padStart(2, '0') }

function daysFromToday(offset) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function shortDate(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
}

function hoursAgo(h) {
  const d = new Date()
  d.setHours(d.getHours() - h)
  return d.toISOString()
}

function nextIdFor(store, key = 'id') {
  return store.reduce((max, item) => Math.max(max, item[key] || 0), 0) + 1
}

// ── Seed data ──────────────────────────────────────────────────────

let choresStore = [
  { id: 1, name: 'Take out recycling',       who: '',     frequency: 'Weekly',   dueDate: daysFromToday(0),  done: false, weight: 1, notes: '', completedAt: '' },
  { id: 2, name: 'Vacuum living room',       who: '',     frequency: '',         dueDate: daysFromToday(2),  done: false, weight: 2, notes: '', completedAt: '' },
  { id: 3, name: 'Clean fish tank',          who: 'dad',  frequency: 'Monthly',  dueDate: daysFromToday(5),  done: false, weight: 2, notes: 'Filter needs replacing too', completedAt: '' },
  { id: 4, name: 'Feed the cat',             who: 'tori', frequency: 'Daily',    dueDate: daysFromToday(0),  done: true,  weight: 1, notes: '', completedAt: hoursAgo(2) },
  { id: 5, name: 'Clean room',               who: 'tori', frequency: '',         dueDate: daysFromToday(-1), done: false, weight: 2, notes: '', completedAt: '' },
  { id: 6, name: 'Homework check-in',        who: 'tori', frequency: 'Weekdays', dueDate: daysFromToday(1),  done: false, weight: 1, notes: '', completedAt: '' },
  { id: 7, name: 'Unload dishwasher',        who: 'nova', frequency: 'Daily',    dueDate: daysFromToday(0),  done: true,  weight: 1, notes: '', completedAt: hoursAgo(5) },
  { id: 8, name: 'Practice piano',           who: 'nova', frequency: '',         dueDate: daysFromToday(3),  done: false, weight: 2, notes: '30 minutes', completedAt: '' },
  { id: 9, name: 'Pack backpack for school', who: 'nova', frequency: 'Weekdays', dueDate: daysFromToday(0),  done: false, weight: 1, notes: '', completedAt: '' },
]

let bulletinStore = [
  { row: 4, text: 'Car pool swap — I have pickup Thursday',                who: 'Dad', date: shortDate(0),  color: 'blue'  },
  { row: 3, text: 'Grandma is visiting this weekend 🎉',                    who: 'Mom', date: shortDate(-3), color: 'teal'  },
  { row: 2, text: "Don't forget the permission slip for the field trip",   who: 'Dad', date: shortDate(-1), color: 'rose'  },
  { row: 1, text: 'Picture day is the 14th — wear something nice!',        who: 'Mom', date: shortDate(2),  color: 'amber' },
]

let moviesStore = [
  { id: 1, title: 'Spirited Away', type: 'Movie', status: '' },
  { id: 2, title: 'Ted Lasso',     type: 'Show',  status: '' },
  { id: 3, title: 'The Bear',      type: 'Show',  status: '' },
]

let booksStore = [
  { id: 1, title: 'Atomic Habits', author: 'James Clear',  category: '' },
  { id: 2, title: 'Percy Jackson', author: 'Rick Riordan', category: '' },
]

let toriWishlistStore = [
  { id: 1, text: 'Nintendo Switch game — Mario Kart' },
  { id: 2, text: 'New soccer cleats' },
]

let novaWishlistStore = [
  { id: 1, text: 'Lego space set' },
  { id: 2, text: 'Art supplies' },
]

let toriEventsStore = [
  { id: 1, name: 'Regional Wrestling Qualifier', type: 'Tournament', date: daysFromToday(9), location: 'Central High School' },
]

let toriRemindersStore = [
  { id: 1, text: 'Turn in permission slip', date: daysFromToday(2) },
  { id: 2, text: 'Return library books',    date: daysFromToday(6) },
]

let novaEventsStore = [
  { id: 1, name: 'Spring Piano Recital', type: 'Recital', date: daysFromToday(12), location: 'Community Center' },
]

let novaRemindersStore = [
  { id: 1, text: 'Bring show-and-tell item', date: daysFromToday(1) },
]

const mealStore = {
  Sunday:    'Roast chicken & veggies',
  Monday:    'Tacos',
  Tuesday:   'Spaghetti & meatballs',
  Wednesday: 'Stir fry',
  Thursday:  'Leftovers',
  Friday:    'Homemade pizza',
  Saturday:  'Grilled burgers',
}

let groceryStore = ['Milk', 'Eggs', 'Bread', 'Bananas', 'Chicken breast', 'Coffee', 'Paper towels']

// Calendar events, expressed as an offset in days from today so the whole
// window always looks freshly populated no matter when this runs.
const CAL_TEMPLATES = [
  { offset: 0,  summary: 'Garbage to street',                isAllDay: true  },
  { offset: 0,  summary: 'Tori - Dentist Appointment',        isAllDay: false, startTime: '3:30 PM',  endTime: '4:15 PM',  location: 'Family Dental' },
  { offset: 1,  summary: 'Nova - Soccer Practice',            isAllDay: false, startTime: '5:00 PM',  endTime: '6:00 PM',  location: 'Lincoln Park' },
  { offset: 2,  summary: 'Family Movie Night',                isAllDay: true  },
  { offset: 4,  summary: 'Tori - Wrestling Meet',             isAllDay: false, startTime: '6:00 PM',  endTime: '8:30 PM',  location: 'Central High School' },
  { offset: 7,  summary: 'Nova - Piano Recital',               isAllDay: false, startTime: '4:00 PM',  endTime: '5:00 PM',  location: 'Community Center' },
  { offset: 9,  summary: 'Tori - Regional Qualifier',          isAllDay: false, startTime: '9:00 AM',  endTime: '2:00 PM',  location: 'Central High School' },
  { offset: 10, summary: "Dinner at Grandma's",                isAllDay: true  },
  { offset: 14, summary: 'Parent-Teacher Conferences',         isAllDay: true  },
  { offset: 21, summary: 'Nova - Basketball Tournament',       isAllDay: false, startTime: '10:00 AM', endTime: '4:00 PM',  location: 'Rec Center' },
  { offset: 35, summary: 'Family Trip to the Lake',            isAllDay: true  },
  { offset: 50, summary: 'Tori - Districts',                   isAllDay: false, startTime: '5:30 PM',  endTime: '8:00 PM',  location: 'Central High School' },
]

function buildUpcoming(numDays) {
  const days = []
  for (let i = 0; i < numDays; i++) {
    const events = CAL_TEMPLATES.filter(t => t.offset === i).map(t => ({
      summary:   t.summary,
      location:  t.location || '',
      startTime: t.startTime || null,
      endTime:   t.endTime || null,
      isAllDay:  t.isAllDay,
    }))
    days.push({ date: daysFromToday(i), events })
  }
  return days
}

// ── GET router ───────────────────────────────────────────────────────
function handleGet(base, params) {
  const type = params.get('type') || ''

  if (base === 'mock://chores') {
    if (type === 'chores')        return [...choresStore]
    if (type === 'bulletin')      return [...bulletinStore]
    if (type === 'movies')        return [...moviesStore]
    if (type === 'books')         return [...booksStore]
    if (type === 'tori_wishlist') return [...toriWishlistStore]
    if (type === 'nova_wishlist') return [...novaWishlistStore]
    if (type === 'upcoming')      return buildUpcoming(parseInt(params.get('days') || '31', 10))
    return { error: 'unknown mock type: ' + type }
  }

  if (base === 'mock://tori') {
    if (type === 'events')    return [...toriEventsStore]
    if (type === 'reminders') return [...toriRemindersStore]
    return { error: 'unknown mock type: ' + type }
  }

  if (base === 'mock://nova') {
    if (type === 'events')    return [...novaEventsStore]
    if (type === 'reminders') return [...novaRemindersStore]
    return { error: 'unknown mock type: ' + type }
  }

  if (base === 'mock://meal')    return { ...mealStore }
  if (base === 'mock://grocery') return [...groceryStore]

  return { error: 'unknown mock endpoint: ' + base }
}

// ── POST router ──────────────────────────────────────────────────────
function handlePost(base, fields) {
  const type   = fields.type   || ''
  const action = fields.action || ''

  if (base === 'mock://chores') {
    if (type === 'chores') {
      if (action === 'add') {
        choresStore.push({
          id: nextIdFor(choresStore), name: fields.name || '', who: fields.who || '',
          frequency: fields.frequency || '', dueDate: fields.dueDate || '',
          done: false, weight: Number(fields.weight) || 1, notes: fields.notes || '', completedAt: '',
        })
        return { status: 'ok' }
      }
      if (action === 'update') {
        const c = choresStore.find(c => c.id === Number(fields.idx))
        if (c) {
          c.name      = fields.name ?? c.name
          c.who       = fields.who ?? c.who
          c.frequency = fields.frequency ?? c.frequency
          c.dueDate   = fields.dueDate ?? c.dueDate
          c.weight    = fields.weight !== undefined ? (Number(fields.weight) || 1) : c.weight
          c.notes     = fields.notes ?? c.notes
        }
        return { status: 'ok' }
      }
      if (action === 'toggle') {
        const c = choresStore.find(c => c.id === Number(fields.idx))
        if (c) {
          c.done = fields.done === 'true'
          c.completedAt = c.done ? new Date().toISOString() : ''
        }
        return { status: 'ok' }
      }
      if (action === 'delete') {
        choresStore = choresStore.filter(c => c.id !== Number(fields.idx))
        return { status: 'ok' }
      }
    }

    if (type === 'bulletin') {
      if (action === 'add') {
        bulletinStore.unshift({
          row: nextIdFor(bulletinStore, 'row'),
          text: fields.text || '', who: fields.who || 'Someone',
          date: fields.date || shortDate(0), color: fields.color || 'amber',
        })
        return { status: 'ok' }
      }
      if (action === 'delete') {
        const targetRow = Number(fields.id ?? fields.row)
        bulletinStore = bulletinStore.filter(b => b.row !== targetRow)
        return { status: 'ok' }
      }
    }

    if (type === 'movies') {
      if (action === 'add') {
        moviesStore.push({ id: nextIdFor(moviesStore), title: fields.title || '', type: fields.mediaType || 'Movie', status: '' })
        return { status: 'ok' }
      }
      if (action === 'delete') {
        moviesStore = moviesStore.filter(m => m.id !== Number(fields.idx))
        return { status: 'ok' }
      }
    }

    if (type === 'books') {
      if (action === 'add') {
        booksStore.push({ id: nextIdFor(booksStore), title: fields.title || '', author: fields.author || '', category: '' })
        return { status: 'ok' }
      }
      if (action === 'delete') {
        booksStore = booksStore.filter(b => b.id !== Number(fields.idx))
        return { status: 'ok' }
      }
    }

    if (type === 'tori_wishlist' || type === 'nova_wishlist') {
      const store = type === 'tori_wishlist' ? toriWishlistStore : novaWishlistStore
      const setStore = (next) => { if (type === 'tori_wishlist') toriWishlistStore = next; else novaWishlistStore = next }
      if (action === 'add') {
        store.push({ id: nextIdFor(store), text: fields.text || '' })
        return { status: 'ok' }
      }
      if (action === 'update') {
        const item = store.find(i => i.id === Number(fields.idx))
        if (item) item.text = fields.text || ''
        return { status: 'ok' }
      }
      if (action === 'delete') {
        setStore(store.filter(i => i.id !== Number(fields.idx)))
        return { status: 'ok' }
      }
    }
  }

  if (base === 'mock://tori' || base === 'mock://nova') {
    const isTori = base === 'mock://tori'
    if (type === 'events') {
      const store = isTori ? toriEventsStore : novaEventsStore
      const setStore = (next) => { if (isTori) toriEventsStore = next; else novaEventsStore = next }
      if (action === 'add') {
        store.push({ id: nextIdFor(store), name: fields.name || '', type: fields.evtType || '', date: fields.date || '', location: fields.location || '' })
        return { status: 'ok' }
      }
      if (action === 'delete') {
        setStore(store.filter(i => i.id !== Number(fields.idx)))
        return { status: 'ok' }
      }
    }
    if (type === 'reminders') {
      const store = isTori ? toriRemindersStore : novaRemindersStore
      const setStore = (next) => { if (isTori) toriRemindersStore = next; else novaRemindersStore = next }
      if (action === 'add') {
        store.push({ id: nextIdFor(store), text: fields.text || '', date: fields.date || '' })
        return { status: 'ok' }
      }
      if (action === 'update') {
        const item = store.find(i => i.id === Number(fields.idx))
        if (item) { item.text = fields.text || ''; item.date = fields.date || '' }
        return { status: 'ok' }
      }
      if (action === 'delete') {
        setStore(store.filter(i => i.id !== Number(fields.idx)))
        return { status: 'ok' }
      }
    }
  }

  if (base === 'mock://grocery') {
    if (action === 'delete') {
      groceryStore = groceryStore.filter(i => i !== fields.item)
      return { status: 'ok' }
    }
    // No `action` field means add — matches GroceryPanel's quick-add, which
    // only ever sends `item`.
    if (fields.item) {
      groceryStore.push(fields.item)
      return { status: 'ok' }
    }
  }

  return { error: 'unhandled mock request: ' + base + ' ' + type + '/' + action }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Entry point — mirrors the shape apiFetch() expects from a real fetch()
export async function mockFetch(url, options = {}) {
  await delay(150) // small, realistic-feeling latency so loading states are visible
  const [base, qs] = url.split('?')
  const params = new URLSearchParams(qs || '')

  let payload
  if ((options.method || 'GET').toUpperCase() === 'POST') {
    const fields = options.body instanceof FormData
      ? Object.fromEntries(options.body.entries())
      : {}
    payload = handlePost(base, fields)
  } else {
    payload = handleGet(base, params)
  }

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
