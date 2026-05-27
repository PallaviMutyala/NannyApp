import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Layout() {
  const { userProfile, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-violet-50">
      {/* Header */}
      <header className="bg-white border-b border-violet-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-violet-600 text-white w-8 h-8 rounded-xl flex items-center justify-center text-base">
              🍼
            </div>
            <span className="font-bold text-violet-900 text-lg tracking-tight">NannyLog</span>
          </div>
          <div className="flex items-center gap-3">
            {userProfile && (
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-600">
                  {userProfile.name?.[0]?.toUpperCase()}
                </div>
                <span className="text-sm text-gray-500">{userProfile.name}</span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="text-sm text-violet-600 hover:text-violet-800 font-medium"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 pb-28">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-violet-100 shadow-lg">
        <div className="max-w-2xl mx-auto flex">
          {[
            { to: '/', end: true, emoji: '🏠', label: 'Today' },
            { to: '/log', emoji: '✏️', label: 'Log' },
            { to: '/history', emoji: '📅', label: 'History' },
          ].map(({ to, end, emoji, label }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center py-3 gap-0.5 text-xs font-semibold transition-colors relative ${
                  isActive ? 'text-violet-600' : 'text-gray-400 hover:text-gray-500'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-violet-600 rounded-full" />
                  )}
                  <span className="text-xl">{emoji}</span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
