import { useState, useRef, useEffect, useCallback } from 'react'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext'
import { useParams, useNavigate } from 'react-router-dom'
function isHeicFile(file) {
  return file.type === 'image/heic' || file.type === 'image/heif'
    || /\.(heic|heif)$/i.test(file.name)
}

function canvasToJpeg(canvas) {
  const preview = canvas.toDataURL('image/jpeg', 0.85)
  return new Promise(resolve =>
    canvas.toBlob(blob => resolve({ blob, preview }), 'image/jpeg', 0.85)
  )
}

function scaleCanvas(source, srcW, srcH) {
  const MAX = 1600
  let w = srcW, h = srcH
  if (w > MAX || h > MAX) {
    const r = Math.min(MAX / w, MAX / h)
    w = Math.round(w * r); h = Math.round(h * r)
  }
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  canvas.getContext('2d').drawImage(source, 0, 0, w, h)
  return canvas
}

// Path 1: browser native (JPEG/PNG/WebP, and HEIC on Safari)
async function viaBitmap(file) {
  const bitmap = await createImageBitmap(file)
  const canvas = scaleCanvas(bitmap, bitmap.width, bitmap.height)
  bitmap.close()
  const { blob, preview } = await canvasToJpeg(canvas)
  const name = file.name.replace(/\.(heic|heif)$/i, '.jpg')
  return { file: new File([blob], name, { type: 'image/jpeg' }), preview }
}

// Path 2: libheif WASM (HEIC on Chrome — lazy-loaded ~2MB, only when needed)
async function viaLibheif(file) {
  const { default: libheif } = await import('libheif-js/wasm-bundle')
  const buffer = await file.arrayBuffer()
  const decoder = new libheif.HeifDecoder()
  const images = decoder.decode(buffer)
  if (!images?.length) throw new Error('No image found in HEIC file')

  const image = images[0]
  const w = image.get_width()
  const h = image.get_height()

  const pixelData = await new Promise((resolve, reject) => {
    const dest = { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }
    image.display(dest, result => result ? resolve(result) : reject(new Error('HEIC decode failed')))
  })

  // Render raw RGBA into a temp canvas, then scale
  const tmp = document.createElement('canvas')
  tmp.width = w; tmp.height = h
  tmp.getContext('2d').putImageData(new ImageData(pixelData.data, w, h), 0, 0)
  const canvas = scaleCanvas(tmp, w, h)
  const { blob, preview } = await canvasToJpeg(canvas)
  const name = file.name.replace(/\.(heic|heif)$/i, '.jpg')
  return { file: new File([blob], name, { type: 'image/jpeg' }), preview }
}

async function preparePhoto(file) {
  if (isHeicFile(file)) {
    try {
      return await viaBitmap(file) // fast: Safari native
    } catch {
      return await viaLibheif(file) // fallback: WASM decoder for Chrome
    }
  }
  return await viaBitmap(file)
}

const SUPPLY_OPTIONS = ['Diapers', 'Wipes', 'Formula', 'Baby food', 'Onesies', 'Bibs', 'Socks']

function Section({ emoji, emojiColor = 'bg-violet-100', title, children }) {
  return (
    <div className="bg-white rounded-3xl shadow-sm shadow-violet-100 p-5">
      <h3 className="font-bold text-gray-800 flex items-center gap-3 mb-4">
        <span className={`w-9 h-9 ${emojiColor} rounded-2xl flex items-center justify-center text-lg flex-shrink-0`}>
          {emoji}
        </span>
        {title}
      </h3>
      {children}
    </div>
  )
}

function TimeAmountRow({ time, amount, amountUnit, onTimeChange, onAmountChange, onRemove }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <input
        type="time"
        value={time}
        onChange={e => onTimeChange(e.target.value)}
        className="flex-1 border border-gray-100 bg-gray-50 rounded-2xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:bg-white transition"
      />
      <div className="flex items-center gap-1.5 flex-1">
        <input
          type="number"
          min="0"
          step="0.5"
          value={amount}
          onChange={e => onAmountChange(e.target.value)}
          placeholder="0"
          className="w-full border border-gray-100 bg-gray-50 rounded-2xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:bg-white transition"
        />
        <span className="text-xs text-gray-400 whitespace-nowrap">{amountUnit}</span>
      </div>
      <button type="button" onClick={onRemove} className="text-gray-300 hover:text-rose-400 text-xl w-6 text-center">
        ×
      </button>
    </div>
  )
}

function NapRow({ start, end, onStartChange, onEndChange, onRemove }) {
  return (
    <div className="flex items-end gap-2 mb-2">
      <div className="flex-1">
        <label className="text-xs text-gray-400 font-medium mb-1 block">Start</label>
        <input
          type="time"
          value={start}
          onChange={e => onStartChange(e.target.value)}
          className="w-full border border-gray-100 bg-gray-50 rounded-2xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:bg-white transition"
        />
      </div>
      <div className="flex-1">
        <label className="text-xs text-gray-400 font-medium mb-1 block">End</label>
        <input
          type="time"
          value={end}
          onChange={e => onEndChange(e.target.value)}
          className="w-full border border-gray-100 bg-gray-50 rounded-2xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:bg-white transition"
        />
      </div>
      <button type="button" onClick={onRemove} className="text-gray-300 hover:text-rose-400 text-xl pb-2.5">
        ×
      </button>
    </div>
  )
}

function SaveStatus({ status }) {
  if (status === 'idle') return null
  const styles = {
    saving: 'bg-violet-100 text-violet-500',
    saved:  'bg-emerald-100 text-emerald-600',
    error:  'bg-rose-100 text-rose-500',
  }
  const labels = {
    saving: '● Saving…',
    saved:  '✓ Saved',
    error:  '⚠ Error saving',
  }
  return (
    <span className={`text-xs font-semibold px-3 py-1 rounded-full transition-all ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

export default function DailyLog() {
  const { currentUser, userProfile } = useAuth()
  const { date: dateParam } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef()
  const today = new Date().toISOString().split('T')[0]
  const targetDate = dateParam || today
  const isEditing = targetDate !== today
  const docId = `${currentUser.uid}_${targetDate}`
  const [converting, setConverting] = useState(false)
  const docRef = doc(db, 'logs', docId)

  const [loaded, setLoaded] = useState(false)
  const [saveStatus, setSaveStatus] = useState('idle')
  const savedTimerRef = useRef(null)
  const debounceRef = useRef(null)

  const [uploadedPhotoUrls, setUploadedPhotoUrls] = useState([])
  const [pendingPhotos, setPendingPhotos] = useState([])
  const [pendingPreviews, setPendingPreviews] = useState([])
  const [uploadingPhotos, setUploadingPhotos] = useState(false)

  const [arrivalTime, setArrivalTime] = useState('')
  const [departureTime, setDepartureTime] = useState('')
  const [vitaminD, setVitaminD] = useState(false)
  const [milkEntries, setMilkEntries] = useState([{ time: '', amount: '' }])
  const [solidEntries, setSolidEntries] = useState([{ time: '', amount: '', food: '' }])
  const [napEntries, setNapEntries] = useState([{ start: '', end: '' }])
  const [supplies, setSupplies] = useState([])
  const [customSupply, setCustomSupply] = useState('')
  const [otherNotes, setOtherNotes] = useState('')

  // Load today's existing log on mount
  useEffect(() => {
    async function load() {
      const snap = await getDoc(docRef)
      if (snap.exists()) {
        const d = snap.data()
        setArrivalTime(d.arrivalTime || '')
        setDepartureTime(d.departureTime || '')
        setVitaminD(d.vitaminD || false)
        setMilkEntries(d.milk?.length ? d.milk : [{ time: '', amount: '' }])
        setSolidEntries(d.solids?.length ? d.solids : [{ time: '', amount: '', food: '' }])
        setNapEntries(d.naps?.length ? d.naps : [{ start: '', end: '' }])
        setSupplies(d.supplies || [])
        setOtherNotes(d.otherNotes || '')
        setUploadedPhotoUrls(d.photoUrls || [])
      }
      setLoaded(true)
    }
    load()
  }, [])

  const markSaved = useCallback(() => {
    setSaveStatus('saved')
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2500)
  }, [])

  const saveToFirestore = useCallback(async (overrides = {}) => {
    setSaveStatus('saving')
    try {
      await setDoc(docRef, {
        date: targetDate,
        familyId: userProfile.familyId,
        loggedBy: currentUser.uid,
        loggedByName: userProfile?.name || currentUser.displayName,
        photoUrls: overrides.photoUrls ?? uploadedPhotoUrls,
        arrivalTime,
        departureTime,
        vitaminD: overrides.vitaminD ?? vitaminD,
        milk: (overrides.milkEntries ?? milkEntries).filter(e => e.time || e.amount),
        solids: (overrides.solidEntries ?? solidEntries).filter(e => e.time || e.amount || e.food),
        naps: (overrides.napEntries ?? napEntries).filter(e => e.start || e.end),
        supplies: overrides.supplies ?? supplies,
        otherNotes: overrides.otherNotes ?? otherNotes,
        updatedAt: serverTimestamp(),
      })
      markSaved()
    } catch (err) {
      console.error(err)
      setSaveStatus('error')
    }
  }, [arrivalTime, departureTime, uploadedPhotoUrls, vitaminD, milkEntries, solidEntries, napEntries, supplies, otherNotes, currentUser, userProfile, targetDate])

  // Debounced auto-save whenever form fields change
  useEffect(() => {
    if (!loaded) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => saveToFirestore(), 1500)
    return () => clearTimeout(debounceRef.current)
  }, [arrivalTime, departureTime, vitaminD, milkEntries, solidEntries, napEntries, supplies, otherNotes, loaded])

  async function handlePhotoSelect(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    e.target.value = ''

    setUploadingPhotos(true)
    setSaveStatus('saving')

    const newUrls = []
    for (const file of files) {
      let prepared
      try {
        if (isHeicFile(file)) setConverting(true)
        await new Promise(resolve => setTimeout(resolve, 60)) // let overlay render
        prepared = await preparePhoto(file)
      } catch (err) {
        alert(`Could not process photo: ${err.message}`)
        continue
      } finally {
        setConverting(false)
      }
      // Show preview immediately after conversion
      setPendingPreviews(prev => [...prev, prepared.preview])
      try {
        const storageRef = ref(storage, `logs/${targetDate}/${Date.now()}_${prepared.file.name}`)
        await uploadBytes(storageRef, prepared.file)
        const url = await getDownloadURL(storageRef)
        newUrls.push(url)
        setPendingPreviews(prev => prev.filter(p => p !== prepared.preview))
      } catch (err) {
        console.error(err)
        setPendingPreviews(prev => prev.filter(p => p !== prepared.preview))
        setSaveStatus('error')
      }
    }

    if (newUrls.length > 0) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      const combined = [...uploadedPhotoUrls, ...newUrls]
      setUploadedPhotoUrls(combined)
      await saveToFirestore({ photoUrls: combined })
    }
    setUploadingPhotos(false)
  }

  function removeUploadedPhoto(i) {
    const updated = uploadedPhotoUrls.filter((_, idx) => idx !== i)
    setUploadedPhotoUrls(updated)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    saveToFirestore({ photoUrls: updated })
  }

  const updateMilk  = (i, f, v) => setMilkEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [f]: v } : e))
  const updateSolid = (i, f, v) => setSolidEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [f]: v } : e))
  const updateNap   = (i, f, v) => setNapEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [f]: v } : e))

  function toggleSupply(item) {
    setSupplies(prev => prev.includes(item) ? prev.filter(s => s !== item) : [...prev, item])
  }

  function addCustomSupply() {
    const trimmed = customSupply.trim()
    if (trimmed && !supplies.includes(trimmed)) setSupplies(prev => [...prev, trimmed])
    setCustomSupply('')
  }

  if (!loaded) {
    return (
      <div className="py-16 text-center text-violet-300">
        <div className="text-5xl mb-3 animate-pulse">📝</div>
        <p className="text-sm">Loading today's log…</p>
      </div>
    )
  }

  if (converting) {
    return (
      <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
        <div className="w-14 h-14 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
        <div className="text-center">
          <p className="font-bold text-violet-900 text-lg">Converting HEIC photo…</p>
          <p className="text-gray-400 text-sm mt-1">This takes 10–30 seconds on Chrome.<br/>Please don't close the tab.</p>
        </div>
      </div>
    )
  }

  const allPhotos = [
    ...uploadedPhotoUrls.map(url => ({ type: 'uploaded', url })),
    ...pendingPreviews.map(url => ({ type: 'pending', url })),
  ]

  return (
    <div className="py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          {isEditing && (
            <button
              onClick={() => navigate('/history')}
              className="text-violet-400 text-sm font-medium flex items-center gap-1 mb-1 hover:text-violet-600"
            >
              ← Back to History
            </button>
          )}
          <h2 className="text-2xl font-bold text-violet-900">
            {isEditing ? 'Edit Log' : 'Daily Log'}
          </h2>
          <p className="text-violet-400 text-sm mt-0.5">
            {(() => {
              const [y, m, d] = targetDate.split('-').map(Number)
              return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
            })()}
          </p>
        </div>
        <div className="mt-1">
          <SaveStatus status={saveStatus} />
        </div>
      </div>

      <div className="space-y-4">

        {/* Schedule */}
        <Section emoji="🕐" emojiColor="bg-teal-100" title="Nanny Schedule">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-400 font-medium mb-1 block">Arrived</label>
              <input
                type="time"
                value={arrivalTime}
                onChange={e => setArrivalTime(e.target.value)}
                className="w-full border border-gray-100 bg-gray-50 rounded-2xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:bg-white transition"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-400 font-medium mb-1 block">Left</label>
              <input
                type="time"
                value={departureTime}
                onChange={e => setDepartureTime(e.target.value)}
                className="w-full border border-gray-100 bg-gray-50 rounded-2xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:bg-white transition"
              />
            </div>
          </div>
          {arrivalTime && departureTime && (() => {
            const [ah, am] = arrivalTime.split(':').map(Number)
            const [dh, dm] = departureTime.split(':').map(Number)
            const mins = (dh * 60 + dm) - (ah * 60 + am)
            if (mins <= 0) return null
            const hrs = (mins / 60).toFixed(1)
            return (
              <div className="mt-3 bg-teal-50 text-teal-700 text-sm rounded-2xl px-3 py-2 font-medium">
                ⏱ {hrs} hours today
              </div>
            )
          })()}
        </Section>

        {/* Vitamin D */}
        <div className="bg-white rounded-3xl shadow-sm shadow-violet-100 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 bg-yellow-100 rounded-2xl flex items-center justify-center text-lg">☀️</span>
              <div>
                <div className="font-bold text-gray-800">Vitamin D Drop</div>
                <div className="text-xs text-gray-400">Daily supplement check</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setVitaminD(v => !v)}
              style={{ width: 52 }}
              className={`h-7 rounded-full transition-colors relative flex-shrink-0 ${vitaminD ? 'bg-violet-500' : 'bg-gray-200'}`}
            >
              <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${vitaminD ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>
          {vitaminD && (
            <div className="mt-3 bg-violet-50 text-violet-700 text-sm rounded-2xl px-3 py-2 font-medium">
              ✓ Vitamin D given today
            </div>
          )}
        </div>

        {/* Photos */}
        <Section emoji="📷" emojiColor="bg-pink-100" title="Photos">
          <div className="flex flex-wrap gap-2">
            {allPhotos.map((photo, i) => (
              <div key={i} className="relative">
                <img
                  src={photo.url}
                  alt=""
                  className={`w-20 h-20 object-cover rounded-2xl ${photo.type === 'pending' ? 'opacity-50' : ''}`}
                />
                {photo.type === 'pending' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {photo.type === 'uploaded' && (
                  <button
                    type="button"
                    onClick={() => removeUploadedPhoto(i)}
                    className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center shadow"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhotos}
              className="w-20 h-20 border-2 border-dashed border-violet-200 rounded-2xl flex flex-col items-center justify-center text-violet-300 hover:border-violet-400 hover:text-violet-400 transition-colors disabled:opacity-50"
            >
              <span className="text-2xl leading-none">+</span>
              <span className="text-xs mt-0.5">Add</span>
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoSelect} />
        </Section>

        {/* Milk */}
        <Section emoji="🍼" emojiColor="bg-blue-100" title="Milk / Formula">
          <div className="flex gap-2 mb-2">
            <span className="flex-1 text-xs text-gray-400 font-medium">Time</span>
            <span className="flex-1 text-xs text-gray-400 font-medium">Amount</span>
            <span className="w-6" />
          </div>
          {milkEntries.map((entry, i) => (
            <TimeAmountRow
              key={i}
              time={entry.time}
              amount={entry.amount}
              amountUnit="oz"
              onTimeChange={v => updateMilk(i, 'time', v)}
              onAmountChange={v => updateMilk(i, 'amount', v)}
              onRemove={() => setMilkEntries(prev => prev.filter((_, idx) => idx !== i))}
            />
          ))}
          <button type="button" onClick={() => setMilkEntries(p => [...p, { time: '', amount: '' }])}
            className="text-violet-600 text-sm font-semibold hover:text-violet-700 mt-1">
            + Add feeding
          </button>
        </Section>

        {/* Solids */}
        <Section emoji="🥣" emojiColor="bg-orange-100" title="Solids">
          {solidEntries.map((entry, i) => (
            <div key={i} className="mb-3 pb-3 border-b border-gray-50 last:border-0 last:mb-0 last:pb-0">
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={entry.food}
                  onChange={e => updateSolid(i, 'food', e.target.value)}
                  placeholder="e.g. Puréed peas, oatmeal"
                  className="flex-1 border border-gray-100 bg-gray-50 rounded-2xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:bg-white transition"
                />
                <button type="button" onClick={() => setSolidEntries(prev => prev.filter((_, idx) => idx !== i))}
                  className="text-gray-300 hover:text-rose-400 text-xl px-1">×</button>
              </div>
              <div className="flex gap-2">
                <input
                  type="time"
                  value={entry.time}
                  onChange={e => updateSolid(i, 'time', e.target.value)}
                  className="flex-1 border border-gray-100 bg-gray-50 rounded-2xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:bg-white transition"
                />
                <div className="flex items-center gap-1.5 flex-1">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={entry.amount}
                    onChange={e => updateSolid(i, 'amount', e.target.value)}
                    placeholder="0"
                    className="w-full border border-gray-100 bg-gray-50 rounded-2xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:bg-white transition"
                  />
                  <span className="text-xs text-gray-400 whitespace-nowrap">tbsp</span>
                </div>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setSolidEntries(p => [...p, { time: '', amount: '', food: '' }])}
            className="text-violet-600 text-sm font-semibold hover:text-violet-700">
            + Add solid meal
          </button>
        </Section>

        {/* Naps */}
        <Section emoji="😴" emojiColor="bg-indigo-100" title="Nap Times">
          {napEntries.map((entry, i) => (
            <NapRow
              key={i}
              start={entry.start}
              end={entry.end}
              onStartChange={v => updateNap(i, 'start', v)}
              onEndChange={v => updateNap(i, 'end', v)}
              onRemove={() => setNapEntries(prev => prev.filter((_, idx) => idx !== i))}
            />
          ))}
          <button type="button" onClick={() => setNapEntries(p => [...p, { start: '', end: '' }])}
            className="text-violet-600 text-sm font-semibold hover:text-violet-700 mt-1">
            + Add nap
          </button>
        </Section>

        {/* Supplies */}
        <Section emoji="🛒" emojiColor="bg-rose-100" title="Supplies Needed">
          <div className="flex flex-wrap gap-2 mb-3">
            {SUPPLY_OPTIONS.map(item => (
              <button
                key={item}
                type="button"
                onClick={() => toggleSupply(item)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  supplies.includes(item)
                    ? 'bg-rose-100 border-rose-300 text-rose-700'
                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {supplies.includes(item) ? '⚠️ ' : ''}{item}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={customSupply}
              onChange={e => setCustomSupply(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomSupply())}
              placeholder="Other item needed…"
              className="flex-1 border border-gray-100 bg-gray-50 rounded-2xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:bg-white transition"
            />
            <button type="button" onClick={addCustomSupply}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-2xl text-sm text-gray-600 font-medium transition-colors">
              Add
            </button>
          </div>
          {supplies.filter(s => !SUPPLY_OPTIONS.includes(s)).map(s => (
            <div key={s} className="mt-2 flex items-center gap-2">
              <span className="text-sm text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full">⚠️ {s}</span>
              <button type="button" onClick={() => setSupplies(prev => prev.filter(x => x !== s))}
                className="text-xs text-gray-400 hover:text-rose-400">remove</button>
            </div>
          ))}
        </Section>

        {/* Notes */}
        <Section emoji="📝" emojiColor="bg-emerald-100" title="Notes">
          <textarea
            value={otherNotes}
            onChange={e => setOtherNotes(e.target.value)}
            placeholder="Observations, mood, milestones, messages for parents…"
            rows={4}
            className="w-full border border-gray-100 bg-gray-50 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:bg-white transition resize-none"
          />
        </Section>

      </div>
    </div>
  )
}
