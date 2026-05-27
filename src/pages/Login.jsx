import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch {
      setError('Incorrect email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-100 via-violet-50 to-rose-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-3xl shadow-lg shadow-violet-200 text-4xl mb-4">
            🍼
          </div>
          <h1 className="text-3xl font-bold text-violet-900">NannyLog</h1>
          <p className="text-violet-400 mt-1 text-sm">Daily care, beautifully tracked</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl shadow-violet-100 p-7">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Welcome back</h2>

          {error && (
            <div className="bg-rose-50 text-rose-600 text-sm rounded-2xl px-4 py-3 mb-5 flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-violet-600 to-rose-500 text-white font-bold py-3.5 rounded-2xl transition-opacity disabled:opacity-50 shadow-lg shadow-violet-200 mt-2"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-6">
            New here?{' '}
            <Link to="/signup" className="text-violet-600 font-semibold hover:text-violet-700">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
