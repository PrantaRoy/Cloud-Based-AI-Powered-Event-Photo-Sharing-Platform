import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearToken } from '../api';
import ChangePasswordModal from './ChangePasswordModal';

const NAV = [
  { to: '/events',            label: 'All Events',       icon: '🗓️' },
  { to: '/my-events',         label: 'My Events',        icon: '⭐' },
  { to: '/organised-events',  label: 'Organised Events', icon: '🎟️' },
  { to: '/search-photos',     label: 'Search My Photos', icon: '🔍' },
  { to: '/my-photos',         label: 'My Photos',        icon: '🖼️' },
];

export default function Layout() {
  const [adminOpen, setAdminOpen]   = useState(false);
  const [showCPModal, setShowCPModal] = useState(false);
  const navigate = useNavigate();

  function logout() {
    clearToken();
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col py-6 px-4 shrink-0">
        <div className="flex items-center gap-2 mb-8 px-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="font-bold text-gray-900">EventPro</span>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {NAV.map(({ to, label, icon }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-gray-600 hover:bg-gray-50'
                }`
              }>
              <span>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-end px-6 shrink-0">
          <div className="relative">
            <button onClick={() => setAdminOpen(o => !o)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                ME
              </div>
              <span>Admin</span>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {adminOpen && (
              <div className="absolute right-0 top-10 bg-white border border-gray-100 shadow-lg rounded-xl w-44 py-1 z-50">
                <button onClick={() => { setShowCPModal(true); setAdminOpen(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  Change Password
                </button>
                <hr className="my-1 border-gray-100" />
                <button onClick={logout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {showCPModal && <ChangePasswordModal onClose={() => setShowCPModal(false)} />}
    </div>
  );
}
