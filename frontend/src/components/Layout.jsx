import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { username, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };
  const closeSidebar = () => setSidebarOpen(false);

  const NavItems = () => (
    <>
      <NavLink to="/" end onClick={closeSidebar}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-150 ${
            isActive ? 'bg-tulce-500/20 text-tulce-400 border border-tulce-500/30' : 'text-gray-400 hover:text-gray-200 hover:bg-dark-700'
          }`}>
        <span>📊</span> Dashboard
      </NavLink>
      <NavLink to="/customers" onClick={closeSidebar}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-150 ${
            isActive ? 'bg-tulce-500/20 text-tulce-400 border border-tulce-500/30' : 'text-gray-400 hover:text-gray-200 hover:bg-dark-700'
          }`}>
        <span>👥</span> Customers
      </NavLink>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-dark-900">

      {/* ── DESKTOP SIDEBAR (hidden on mobile) ── */}
      <aside className="hidden md:flex w-56 flex-shrink-0 flex-col bg-dark-800 border-r border-dark-600">
        <div className="px-5 pt-6 pb-5 border-b border-dark-600">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🍩</span>
            <div>
              <p className="font-display text-sm font-bold text-tulce-400 tracking-widest uppercase leading-none">Tulce</p>
              <p className="font-display text-xs text-gray-600 tracking-widest uppercase">Tracker</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1"><NavItems /></nav>
        <div className="px-3 pb-4 border-t border-dark-600 pt-3">
          <div className="px-3 py-2 mb-2">
            <p className="text-xs text-gray-500">Logged in as</p>
            <p className="text-sm font-medium text-gray-300">{username}</p>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-900/20 rounded-lg transition-colors">
            <span>🚪</span> Logout
          </button>
        </div>
      </aside>

      {/* ── MOBILE OVERLAY ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeSidebar} />
          {/* drawer */}
          <aside className="absolute left-0 top-0 h-full w-64 flex flex-col bg-dark-800 border-r border-dark-600 z-50 animate-slide-up">
            <div className="px-5 pt-6 pb-5 border-b border-dark-600 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🍩</span>
                <div>
                  <p className="font-display text-sm font-bold text-tulce-400 tracking-widest uppercase leading-none">Tulce</p>
                  <p className="font-display text-xs text-gray-600 tracking-widest uppercase">Tracker</p>
                </div>
              </div>
              <button onClick={closeSidebar} className="text-gray-500 hover:text-white text-xl px-1">✕</button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1"><NavItems /></nav>
            <div className="px-3 pb-6 border-t border-dark-600 pt-3">
              <div className="px-3 py-2 mb-2">
                <p className="text-xs text-gray-500">Logged in as</p>
                <p className="text-sm font-medium text-gray-300">{username}</p>
              </div>
              <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-900/20 rounded-lg transition-colors">
                <span>🚪</span> Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-dark-800 border-b border-dark-600 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">🍩</span>
            <p className="font-display text-sm font-bold text-tulce-400 tracking-widest uppercase">Tulce Tracker</p>
          </div>
          <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-dark-700 transition-colors">
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="19" y2="6"/>
              <line x1="3" y1="12" x2="19" y2="12"/>
              <line x1="3" y1="18" x2="19" y2="18"/>
            </svg>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
