import { useState, useEffect } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext'

const ROLE_EMOJI = { parent: '👨‍👩‍👧', nanny: '👩' }

export default function Family() {
  const { userProfile, familyData, joinFamily, setHourlyRate } = useAuth()
  const [members, setMembers] = useState([])
  const [copied, setCopied] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [joinSuccess, setJoinSuccess] = useState('')
  const [rate, setRate] = useState('')
  const [rateSaving, setRateSaving] = useState(false)
  const [rateSaved, setRateSaved] = useState(false)

  useEffect(() => {
    if (!userProfile?.familyId) return
    getDocs(query(collection(db, 'users'), where('familyId', '==', userProfile.familyId)))
      .then(snap => setMembers(snap.docs.map(d => d.data())))
      .catch(err => console.error('Failed to load members:', err))
  }, [userProfile?.familyId])

  useEffect(() => {
    setRate(familyData?.hourlyRate != null ? String(familyData.hourlyRate) : '30')
  }, [familyData?.hourlyRate])

  async function handleSaveRate(e) {
    e.preventDefault()
    const val = parseFloat(rate)
    if (isNaN(val) || val < 0) return
    setRateSaving(true)
    try {
      await setHourlyRate(val)
      setRateSaved(true)
      setTimeout(() => setRateSaved(false), 2000)
    } catch (err) {
      console.error('Failed to save rate:', err)
    } finally {
      setRateSaving(false)
    }
  }

  async function handleJoin(e) {
    e.preventDefault()
    setJoinError(''); setJoinSuccess('')
    if (!joinCode.trim()) return
    setJoining(true)
    try {
      await joinFamily(joinCode)
      setJoinSuccess('Joined! Reloading…')
      setTimeout(() => window.location.reload(), 700)
    } catch (err) {
      setJoinError(err.message)
      setJoining(false)
    }
  }

  return (
    <div className="py-6 space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-violet-900">Family</h2>
        <p className="text-violet-400 text-sm mt-0.5">Members & invite settings</p>
      </div>

      {/* Invite code — parents only; hidden from nanny */}
      {userProfile?.role === 'parent' && (
        <div className="bg-white rounded-3xl shadow-sm shadow-violet-100 p-5">
          <h4 className="font-bold text-gray-800 flex items-center gap-3 mb-3">
            <span className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center text-base flex-shrink-0">🔗</span>
            Your Invite Code
          </h4>
          {familyData?.inviteCode ? (
            <>
              <div className="flex items-center gap-3">
                <div className="bg-violet-50 text-violet-900 font-mono font-bold text-2xl tracking-[0.3em] px-4 py-3 rounded-2xl flex-1 text-center">
                  {familyData.inviteCode}
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(familyData.inviteCode); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                  className="bg-violet-600 text-white text-sm font-bold px-4 py-3 rounded-2xl hover:bg-violet-700 transition-colors"
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">Share this code so your nanny or partner can join this family</p>
            </>
          ) : (
            <p className="text-gray-300 text-sm">No invite code available</p>
          )}
        </div>
      )}

      {/* Hourly rate — parents only */}
      {userProfile?.role === 'parent' && (
        <div className="bg-white rounded-3xl shadow-sm shadow-violet-100 p-5">
          <h4 className="font-bold text-gray-800 flex items-center gap-3 mb-3">
            <span className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center text-base flex-shrink-0">💵</span>
            Nanny Hourly Rate
          </h4>
          <form onSubmit={handleSaveRate} className="flex items-center gap-2">
            <div className="flex items-center flex-1 border border-gray-200 rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-violet-400">
              <span className="text-gray-400 font-semibold">$</span>
              <input
                type="number"
                min="0"
                step="0.5"
                value={rate}
                onChange={e => setRate(e.target.value)}
                className="flex-1 ml-1 text-sm font-semibold focus:outline-none"
              />
              <span className="text-gray-400 text-sm">/hr</span>
            </div>
            <button
              type="submit"
              disabled={rateSaving}
              className="bg-violet-600 text-white text-sm font-bold px-5 py-3 rounded-2xl hover:bg-violet-700 transition-colors disabled:opacity-50"
            >
              {rateSaving ? 'Saving…' : rateSaved ? '✓ Saved' : 'Save'}
            </button>
          </form>
          <p className="text-xs text-gray-400 mt-2">Used to calculate the weekly pay shown on the Today tab</p>
        </div>
      )}

      {/* Members */}
      <div className="bg-white rounded-3xl shadow-sm shadow-violet-100 p-5">
        <h4 className="font-bold text-gray-800 flex items-center gap-3 mb-3">
          <span className="w-8 h-8 bg-teal-100 rounded-xl flex items-center justify-center text-base flex-shrink-0">👨‍👩‍👧</span>
          Members ({members.length})
        </h4>
        <div className="space-y-2">
          {members.map((m, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-base">
                {ROLE_EMOJI[m.role] || '👤'}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-gray-800 text-sm truncate">
                  {m.name}
                  {m.email === userProfile?.email && <span className="text-violet-400 font-normal"> (you)</span>}
                </div>
                <div className="text-xs text-gray-400 capitalize">{m.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Join another family */}
      <div className="bg-white rounded-3xl shadow-sm shadow-violet-100 p-5">
        <h4 className="font-bold text-gray-800 flex items-center gap-3 mb-3">
          <span className="w-8 h-8 bg-rose-100 rounded-xl flex items-center justify-center text-base flex-shrink-0">➕</span>
          Join Another Family
        </h4>
        <p className="text-xs text-gray-400 mb-3">
          Enter another family's invite code to switch to their shared logs. You'll leave your current family.
        </p>
        {joinError && (
          <div className="bg-rose-50 text-rose-600 text-sm rounded-2xl px-4 py-3 mb-3">⚠️ {joinError}</div>
        )}
        {joinSuccess && (
          <div className="bg-emerald-50 text-emerald-600 text-sm rounded-2xl px-4 py-3 mb-3">✓ {joinSuccess}</div>
        )}
        <form onSubmit={handleJoin} className="flex gap-2">
          <input
            type="text"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="CODE"
            className="flex-1 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition"
          />
          <button
            type="submit"
            disabled={joining || !joinCode.trim()}
            className="bg-violet-600 text-white text-sm font-bold px-5 py-3 rounded-2xl hover:bg-violet-700 transition-colors disabled:opacity-50"
          >
            {joining ? 'Joining…' : 'Join'}
          </button>
        </form>
      </div>
    </div>
  )
}
