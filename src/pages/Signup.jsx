import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'nanny' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) return setError('Password must be at least 6 characters.')
    setLoading(true)
    try {
      await signup(form.email, form.password, form.name, form.role)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Failed to create account.')
    } finally {
      setLoading(false)
    }
  }

  const roles = [
    { value: 'nanny', emoji: '👩', label: 'Nanny', desc: 'I log daily care' },
    { value: 'parent', emoji: '👨‍👩‍👧', label: 'Parent', desc: 'I view the logs' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-100 via-violet-50 to-rose-50 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-3xl shadow-lg shadow-violet-200 text-4xl mb-4">
            🍼
          </div>
          <h1 className="text-3xl font-bold text-violet-900">NannyLog</h1>
          <p className="text-violet-400 mt-1 text-sm">Daily care, beautifully tracked</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl shadow-violet-100 p-7">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Create account</h2>

          {error && (
            <div className="bg-rose-50 text-rose-600 text-sm rounded-2xl px-4 py-3 mb-5 flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => update('name', e.target.value)}
                required
                className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                required
                className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={e => update('password', e.target.value)}
                required
                className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition"
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">I am a…</label>
              <div className="flex gap-3">
                {roles.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => update('role', r.value)}
                    className={`flex-1 py-3 px-3 rounded-2xl text-left transition-all border-2 ${
                      form.role === r.value
                        ? 'border-violet-500 bg-violet-50'
                        : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                    }`}
                  >
                    <div className="text-xl mb-0.5">{r.emoji}</div>
                    <div className={`text-sm font-bold ${form.role === r.value ? 'text-violet-700' : 'text-gray-600'}`}>
                      {r.label}
                    </div>
                    <div className="text-xs text-gray-400">{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-violet-600 to-rose-500 text-white font-bold py-3.5 rounded-2xl transition-opacity disabled:opacity-50 shadow-lg shadow-violet-200 mt-2"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-violet-600 font-semibold hover:text-violet-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
