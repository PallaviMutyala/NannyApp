import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function getMondayOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

function hoursWorked(arrival, departure) {
  if (!arrival || !departure) return 0
  const [ah, am] = arrival.split(':').map(Number)
  const [dh, dm] = departure.split(':').map(Number)
  const mins = (dh * 60 + dm) - (ah * 60 + am)
  return mins > 0 ? mins / 60 : 0
}

function formatHours(h) {
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

function getFederalHolidays(year) {
  const h = new Map()
  function fmt(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  function observed(m, day, name) {
    const d = new Date(year, m - 1, day)
    const w = d.getDay()
    if (w === 6) d.setDate(d.getDate() - 1)
    else if (w === 0) d.setDate(d.getDate() + 1)
    h.set(fmt(d), name)
  }
  function nthMonday(m, n, name) {
    const d = new Date(year, m - 1, 1)
    let count = 0
    while (true) { if (d.getDay() === 1 && ++count === n) { h.set(fmt(d), name); return } d.setDate(d.getDate() + 1) }
  }
  function lastMonday(m, name) {
    const d = new Date(year, m, 0)
    while (d.getDay() !== 1) d.setDate(d.getDate() - 1)
    h.set(fmt(d), name)
  }
  function nthThursday(m, n, name) {
    const d = new Date(year, m - 1, 1)
    let count = 0
    while (true) { if (d.getDay() === 4 && ++count === n) { h.set(fmt(d), name); return } d.setDate(d.getDate() + 1) }
  }
  observed(1, 1, "New Year's Day")
  nthMonday(1, 3, 'MLK Day')
  nthMonday(2, 3, "Presidents' Day")
  lastMonday(5, 'Memorial Day')
  observed(6, 19, 'Juneteenth')
  observed(7, 4, 'Independence Day')
  nthMonday(9, 1, 'Labor Day')
  nthMonday(10, 2, 'Columbus Day')
  observed(11, 11, 'Veterans Day')
  nthThursday(11, 4, 'Thanksgiving')
  observed(12, 25, 'Christmas Day')
  return h
}

function napDuration(start, end) {
  if (!start || !end) return null
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins <= 0) return null
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`
}

function Card({ emoji, emojiColor = 'bg-violet-100', title, children, empty }) {
  return (
    <div className="bg-white rounded-3xl shadow-sm shadow-violet-100 p-5">
      <h4 className="font-bold text-gray-800 flex items-center gap-3 mb-3">
        <span className={`w-8 h-8 ${emojiColor} rounded-xl flex items-center justify-center text-base flex-shrink-0`}>
          {emoji}
        </span>
        {title}
      </h4>
      {empty
        ? <p className="text-gray-300 text-sm">Nothing logged yet</p>
        : children}
    </div>
  )
}

export default function Dashboard() {
  const today = new Date().toISOString().split('T')[0]
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [weekLogs, setWeekLogs] = useState([])
  const navigate = useNavigate()
  const isFriday = new Date().getDay() === 5

  useEffect(() => {
    const monday = getMondayOfWeek(new Date())

    const unsubToday = onSnapshot(
      query(collection(db, 'logs'), where('date', '==', today)),
      snap => {
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoading(false)
      }
    )

    const unsubWeek = onSnapshot(
      query(collection(db, 'logs'), where('date', '>=', monday), where('date', '<=', today)),
      snap => {
        setWeekLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      }
    )

    return () => { unsubToday(); unsubWeek() }
  }, [today])

  const allMilk = logs.flatMap(l => l.milk || [])
  const allSolids = logs.flatMap(l => l.solids || [])
  const allNaps = logs.flatMap(l => l.naps || [])
  const allSupplies = [...new Set(logs.flatMap(l => l.supplies || []))]
  const allPhotos = logs.flatMap(l => l.photoUrls || [])
  const vitaminDGiven = logs.some(l => l.vitaminD)
  const notes = logs.map(l => l.otherNotes).filter(Boolean)
  const totalMilkOz = allMilk.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0)

  if (loading) {
    return (
      <div className="py-16 text-center text-violet-300">
        <div className="text-5xl mb-3 animate-pulse">🍼</div>
        <p className="text-sm">Loading today's log…</p>
      </div>
    )
  }

  return (
    <div className="py-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-violet-900">Today</h2>
          <p className="text-violet-400 text-sm mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => navigate('/log')}
          className="bg-gradient-to-r from-violet-600 to-rose-500 text-white text-sm font-bold px-4 py-2.5 rounded-2xl shadow-md shadow-violet-200 hover:opacity-90 transition-opacity"
        >
          + Add log
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="bg-white rounded-3xl shadow-sm shadow-violet-100 p-10 text-center">
          <div className="text-5xl mb-3">📋</div>
          <p className="text-gray-400 font-medium">No entries yet today</p>
          <button
            onClick={() => navigate('/log')}
            className="mt-5 bg-gradient-to-r from-violet-600 to-rose-500 text-white text-sm font-bold px-6 py-3 rounded-2xl shadow-md shadow-violet-200 hover:opacity-90 transition-opacity"
          >
            Start today's log
          </button>
        </div>
      ) : (
        <>
          {/* Vitamin D banner */}
          <div className={`rounded-3xl px-5 py-4 flex items-center gap-4 ${
            vitaminDGiven
              ? 'bg-gradient-to-r from-violet-50 to-violet-100 border border-violet-200'
              : 'bg-gradient-to-r from-rose-50 to-orange-50 border border-rose-200'
          }`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${
              vitaminDGiven ? 'bg-white shadow-sm' : 'bg-white shadow-sm'
            }`}>
              {vitaminDGiven ? '☀️' : '⚠️'}
            </div>
            <div>
              <div className={`font-bold ${vitaminDGiven ? 'text-violet-800' : 'text-rose-700'}`}>
                Vitamin D Drop
              </div>
              <div className={`text-sm ${vitaminDGiven ? 'text-violet-500' : 'text-rose-400'}`}>
                {vitaminDGiven ? 'Given today ✓' : 'Not yet given — reminder!'}
              </div>
            </div>
          </div>

          {/* Weekly summary — always visible, prominent on Fridays */}
          {weekLogs.length > 0 && (() => {
            const monday = getMondayOfWeek(new Date())
            const weekDays = Array.from({ length: 5 }, (_, i) => {
              const d = new Date(monday)
              d.setDate(d.getDate() + i)
              return d.toISOString().split('T')[0]
            })
            const mondayYear = new Date(monday).getFullYear()
            const holidays = getFederalHolidays(mondayYear)
            const fridayYear = new Date(weekDays[4]).getFullYear()
            if (fridayYear !== mondayYear) getFederalHolidays(fridayYear).forEach((name, date) => holidays.set(date, name))

            const loggedByDate = {}
            weekLogs.forEach(l => {
              const h = hoursWorked(l.arrivalTime, l.departureTime)
              if (h > 0) loggedByDate[l.date] = (loggedByDate[l.date] || 0) + h
            })
            const totalHours = weekDays.reduce((sum, date) => {
              const logged = loggedByDate[date] || 0
              return sum + logged + (holidays.has(date) && logged === 0 ? 8 : 0)
            }, 0)
            const weekHolidays = weekDays.filter(d => holidays.has(d)).map(d => holidays.get(d))

            return (
              <div className={`rounded-3xl p-5 ${isFriday ? 'bg-gradient-to-r from-violet-600 to-rose-500 text-white shadow-lg shadow-violet-200' : 'bg-white shadow-sm shadow-violet-100'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-base ${isFriday ? 'bg-white/20' : 'bg-teal-100'}`}>🕐</span>
                    <span className={`font-bold ${isFriday ? 'text-white' : 'text-gray-800'}`}>
                      {isFriday ? 'Weekly Summary 🎉' : 'This Week'}
                    </span>
                  </div>
                  <span className={`font-bold text-lg ${isFriday ? 'text-white' : 'text-teal-700'}`}>
                    {formatHours(totalHours)} total
                  </span>
                </div>
                <div className="flex gap-1">
                  {weekDays.map((date, i) => {
                    const loggedHrs = loggedByDate[date] || 0
                    const isHoliday = holidays.has(date)
                    const isUnloggedHoliday = isHoliday && loggedHrs === 0
                    const hrs = loggedHrs + (isUnloggedHoliday ? 8 : 0)
                    const isToday = date === today
                    const isPast = date <= today
                    return (
                      <div key={date} className="flex-1 text-center">
                        <div className={`text-xs font-semibold mb-1 ${isFriday ? 'text-white/70' : 'text-gray-400'}`}>
                          {DAY_NAMES[i]}
                        </div>
                        <div className={`rounded-xl py-1.5 text-xs font-bold ${
                          isToday
                            ? isFriday ? 'bg-white/30 text-white' : 'bg-violet-100 text-violet-700'
                            : isUnloggedHoliday
                              ? isFriday ? 'bg-white/20 text-yellow-200' : 'bg-amber-50 text-amber-700'
                              : hrs > 0
                                ? isFriday ? 'bg-white/20 text-white' : 'bg-teal-50 text-teal-700'
                                : isFriday ? 'bg-white/10 text-white/40' : 'bg-gray-50 text-gray-300'
                        }`}>
                          {isUnloggedHoliday ? '🏛️' : hrs > 0 ? `${hrs.toFixed(1)}h` : isPast ? '—' : '·'}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {weekHolidays.length > 0 && (
                  <p className={`mt-2.5 text-xs ${isFriday ? 'text-white/60' : 'text-amber-600'}`}>
                    🏛️ {weekHolidays.join(' · ')} — paid holiday
                  </p>
                )}
              </div>
            )
          })()}

          {/* Schedule */}
          {(() => {
            const arrival = logs.find(l => l.arrivalTime)?.arrivalTime
            const departure = logs.find(l => l.departureTime)?.departureTime
            if (!arrival && !departure) return null
            const hrs = hoursWorked(arrival, departure)
            return (
              <Card emoji="🕐" emojiColor="bg-teal-100" title="Nanny Schedule">
                <div className="flex items-center gap-6">
                  {arrival && (
                    <div>
                      <div className="text-xs text-gray-400 mb-0.5">Arrived</div>
                      <div className="font-semibold text-gray-800">{formatTime(arrival)}</div>
                    </div>
                  )}
                  {departure && (
                    <div>
                      <div className="text-xs text-gray-400 mb-0.5">Left</div>
                      <div className="font-semibold text-gray-800">{formatTime(departure)}</div>
                    </div>
                  )}
                  {hrs > 0 && (
                    <div className="ml-auto bg-teal-50 text-teal-700 text-sm font-bold px-3 py-1.5 rounded-full">
                      {formatHours(hrs)}
                    </div>
                  )}
                </div>
              </Card>
            )
          })()}

          {/* Photo feed */}
          {allPhotos.length > 0 && (
            <div className="space-y-3">
              {allPhotos.map((url, i) => (
                <div key={i} className="bg-white rounded-3xl overflow-hidden shadow-sm shadow-violet-100">
                  <img
                    src={url}
                    alt=""
                    className="w-full object-cover"
                    style={{ maxHeight: '70vh' }}
                  />
                  <div className="px-4 py-3 flex items-center gap-2">
                    <span className="text-pink-400 text-lg">📷</span>
                    <span className="text-xs text-gray-400">
                      Photo {allPhotos.length > 1 ? `${i + 1} of ${allPhotos.length}` : 'today'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Milk */}
          <Card emoji="🍼" emojiColor="bg-blue-100" title={`Milk · ${totalMilkOz} oz total`} empty={allMilk.length === 0}>
            <div className="space-y-2">
              {allMilk.map((e, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 bg-gray-50 rounded-xl px-2.5 py-1 w-20 text-center">{formatTime(e.time)}</span>
                  <span className="font-semibold text-gray-700 text-sm">{e.amount} oz</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Solids */}
          <Card emoji="🥣" emojiColor="bg-orange-100" title="Solids" empty={allSolids.length === 0}>
            <div className="space-y-2">
              {allSolids.map((e, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 bg-gray-50 rounded-xl px-2.5 py-1 w-20 text-center">{formatTime(e.time)}</span>
                  <span className="font-semibold text-gray-700 text-sm">{e.food}</span>
                  {e.amount && <span className="text-gray-400 text-xs">{e.amount} tbsp</span>}
                </div>
              ))}
            </div>
          </Card>

          {/* Naps */}
          <Card emoji="😴" emojiColor="bg-indigo-100" title="Naps" empty={allNaps.length === 0}>
            <div className="space-y-2">
              {allNaps.map((e, i) => {
                const dur = napDuration(e.start, e.end)
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">{formatTime(e.start)} – {formatTime(e.end)}</span>
                    {dur && (
                      <span className="bg-indigo-100 text-indigo-600 text-xs font-semibold px-2.5 py-1 rounded-full">
                        {dur}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Supplies */}
          {allSupplies.length > 0 && (
            <Card emoji="🛒" emojiColor="bg-rose-100" title="Supplies Needed">
              <div className="flex flex-wrap gap-2">
                {allSupplies.map(s => (
                  <span key={s} className="bg-rose-50 text-rose-600 border border-rose-200 text-sm font-medium px-3.5 py-1.5 rounded-full">
                    ⚠️ {s}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {/* Notes */}
          {notes.length > 0 && (
            <Card emoji="📝" emojiColor="bg-emerald-100" title="Notes">
              <div className="space-y-2">
                {notes.map((note, i) => (
                  <p key={i} className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{note}</p>
                ))}
              </div>
            </Card>
          )}

          <p className="text-center text-xs text-violet-300 pb-2">
            {logs.length} log entr{logs.length === 1 ? 'y' : 'ies'} today
          </p>
        </>
      )}
    </div>
  )
}
