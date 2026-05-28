import { useEffect, useState } from 'react'
import { collection, query, limit, getDocs } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useNavigate } from 'react-router-dom'

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })
}

function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`
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

function DayCard({ date, entries }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const allMilk = entries.flatMap(l => l.milk || [])
  const allSolids = entries.flatMap(l => l.solids || [])
  const allNaps = entries.flatMap(l => l.naps || [])
  const allSupplies = [...new Set(entries.flatMap(l => l.supplies || []))]
  const allPhotos = entries.flatMap(l => l.photoUrls || [])
  const arrival = entries.find(l => l.arrivalTime)?.arrivalTime
  const departure = entries.find(l => l.departureTime)?.departureTime
  const vitaminDGiven = entries.some(l => l.vitaminD)
  const notes = entries.map(l => l.otherNotes).filter(Boolean)
  const totalMilkOz = allMilk.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0)

  const chips = [
    arrival && (() => {
      if (arrival && departure) {
        const [ah, am] = arrival.split(':').map(Number)
        const [dh, dm] = departure.split(':').map(Number)
        const mins = (dh * 60 + dm) - (ah * 60 + am)
        const hrs = mins > 0 ? Math.round(mins / 60) : null
        return hrs ? { label: `${hrs}h`, emoji: '🕐', color: 'bg-teal-50 text-teal-600' } : null
      }
      return { label: formatTime(arrival), emoji: '🕐', color: 'bg-teal-50 text-teal-600' }
    })(),
    totalMilkOz > 0 && { label: `${totalMilkOz}oz`, emoji: '🍼', color: 'bg-blue-50 text-blue-600' },
    allSolids.length > 0 && { label: `${allSolids.length} meal${allSolids.length > 1 ? 's' : ''}`, emoji: '🥣', color: 'bg-orange-50 text-orange-600' },
    allNaps.length > 0 && { label: `${allNaps.length} nap${allNaps.length > 1 ? 's' : ''}`, emoji: '😴', color: 'bg-indigo-50 text-indigo-600' },
    vitaminDGiven && { label: 'Vit D', emoji: '☀️', color: 'bg-yellow-50 text-yellow-600' },
    allSupplies.length > 0 && { label: `${allSupplies.length} needed`, emoji: '⚠️', color: 'bg-rose-50 text-rose-600' },
  ].filter(Boolean)

  return (
    <div className="bg-white rounded-3xl shadow-sm shadow-violet-100 overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex-1 min-w-0 text-left"
        >
          <div className="font-bold text-gray-800">{formatDate(date)}</div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {chips.map(c => (
              <span key={c.label} className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.color}`}>
                {c.emoji} {c.label}
              </span>
            ))}
          </div>
        </button>
        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
          {allPhotos[0] && (
            <img src={allPhotos[0]} alt="" className="w-10 h-10 rounded-xl object-cover" />
          )}
          <button
            onClick={() => navigate(`/log/${date}`)}
            className="text-xs font-semibold text-violet-500 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-xl transition-colors"
          >
            Edit
          </button>
          <button onClick={() => setOpen(o => !o)} className="text-violet-300 text-sm px-1">
            {open ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-violet-50 px-5 py-5 space-y-5">

          {allPhotos.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Photos</p>
              <div className="space-y-2">
                {allPhotos.map((url, i) => (
                  <img key={i} src={url} alt="" className="w-full object-cover rounded-2xl" style={{ maxHeight: '60vh' }} />
                ))}
              </div>
            </div>
          )}

          {(arrival || departure) && (
            <div className="bg-teal-50 text-teal-700 text-sm rounded-2xl px-4 py-3 font-medium flex items-center gap-4">
              <span>🕐</span>
              {arrival && <span>Arrived {formatTime(arrival)}</span>}
              {departure && <span>Left {formatTime(departure)}</span>}
              {(() => {
                if (!arrival || !departure) return null
                const [ah, am] = arrival.split(':').map(Number)
                const [dh, dm] = departure.split(':').map(Number)
                const mins = (dh * 60 + dm) - (ah * 60 + am)
                if (mins <= 0) return null
                const h = Math.floor(mins / 60), m = mins % 60
                return <span className="ml-auto font-bold">{h > 0 ? `${h}h ${m}m` : `${m}m`}</span>
              })()}
            </div>
          )}

          <div className={`text-sm rounded-2xl px-4 py-3 font-medium ${
            vitaminDGiven ? 'bg-violet-50 text-violet-700' : 'bg-gray-50 text-gray-400'
          }`}>
            ☀️ Vitamin D: {vitaminDGiven ? 'Given ✓' : 'Not given'}
          </div>

          {allMilk.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                Milk · {totalMilkOz} oz total
              </p>
              <div className="space-y-1.5">
                {allMilk.map((e, i) => (
                  <div key={i} className="flex gap-3 items-center text-sm">
                    <span className="text-xs text-gray-400 bg-gray-50 rounded-lg px-2 py-0.5 w-20 text-center">{formatTime(e.time)}</span>
                    <span className="font-semibold text-gray-700">{e.amount} oz</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {allSolids.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Solids</p>
              <div className="space-y-1.5">
                {allSolids.map((e, i) => (
                  <div key={i} className="flex gap-3 items-center text-sm">
                    <span className="text-xs text-gray-400 bg-gray-50 rounded-lg px-2 py-0.5 w-20 text-center">{formatTime(e.time)}</span>
                    <span className="font-semibold text-gray-700">{e.food}</span>
                    {e.amount && <span className="text-gray-400 text-xs">{e.amount} tbsp</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {allNaps.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Naps</p>
              <div className="space-y-1.5">
                {allNaps.map((e, i) => {
                  const dur = napDuration(e.start, e.end)
                  return (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className="text-gray-600">{formatTime(e.start)} – {formatTime(e.end)}</span>
                      {dur && <span className="bg-indigo-100 text-indigo-600 text-xs font-semibold px-2 py-0.5 rounded-full">{dur}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {allSupplies.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Supplies Needed</p>
              <div className="flex flex-wrap gap-2">
                {allSupplies.map(s => (
                  <span key={s} className="bg-rose-50 text-rose-600 border border-rose-200 text-xs font-semibold px-3 py-1 rounded-full">
                    ⚠️ {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {notes.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Notes</p>
              {notes.map((note, i) => (
                <p key={i} className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{note}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function History() {
  const [grouped, setGrouped] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchHistory() {
      const q = query(collection(db, 'logs'), limit(60))
      const snap = await getDocs(q)
      const byDate = {}
      snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        .forEach(data => {
          if (!byDate[data.date]) byDate[data.date] = []
          byDate[data.date].push(data)
        })
      setGrouped(byDate)
      setLoading(false)
    }
    fetchHistory()
  }, [])

  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  if (loading) {
    return (
      <div className="py-16 text-center text-violet-300">
        <div className="text-5xl mb-3 animate-pulse">📅</div>
        <p className="text-sm">Loading history…</p>
      </div>
    )
  }

  return (
    <div className="py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-violet-900">History</h2>
        <p className="text-violet-400 text-sm mt-0.5">Past care logs</p>
      </div>
      {dates.length === 0 ? (
        <div className="bg-white rounded-3xl shadow-sm shadow-violet-100 p-10 text-center">
          <div className="text-5xl mb-3">📭</div>
          <p className="text-gray-400 font-medium">No past logs yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dates.map(date => (
            <DayCard key={date} date={date} entries={grouped[date]} />
          ))}
        </div>
      )}
    </div>
  )
}
