import { NavLink } from 'react-router-dom'
import { Building2, LogOut, X } from 'lucide-react'

import { useAuth } from '../../context/auth'
import { PORTAL_TITLES } from '../../config/navigation'
import { Avatar } from '../common/Primitives'

function NavItems({ groups, onNavigate }) {
  return (
    <nav className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Main">
      {groups.map((group) => (
        <div key={group.section}>
          <p className="mb-1.5 px-3 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            {group.section}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={onNavigate}
                  className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
                >
                  <item.icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function Brand({ role, onClose }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white">
          <Building2 className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">Hostel Manager</p>
          <p className="truncate text-[11px] text-slate-500">{PORTAL_TITLES[role] || 'Portal'}</p>
        </div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

function UserFooter({ onNavigate }) {
  const { user, profile, logout } = useAuth()
  const subtitle =
    user?.role === 'ADMIN'
      ? profile?.designation || 'Administrator'
      : user?.role === 'PARENT'
        ? profile?.relationship_to_student || 'Parent'
        : profile?.student_class || 'Student'

  return (
    <div className="border-t border-slate-200 p-3">
      <div className="mb-2 flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5">
        <Avatar src={user?.profile_photo} name={user?.full_name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{user?.full_name}</p>
          <p className="truncate text-[11px] text-slate-500">{subtitle}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          onNavigate?.()
          logout()
        }}
        className="nav-link w-full text-red-600 hover:bg-red-50 hover:text-red-700"
      >
        <LogOut className="h-4.5 w-4.5" aria-hidden="true" />
        Logout
      </button>
    </div>
  )
}

/** Fixed sidebar on desktop; slide-over drawer on tablet/mobile. */
export function Sidebar({ groups, role, open, onClose }) {
  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <Brand role={role} />
        <NavItems groups={groups} />
        <UserFooter />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} aria-hidden="true" />
          <aside
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-white shadow-[var(--shadow-float)]"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <Brand role={role} onClose={onClose} />
            <NavItems groups={groups} onNavigate={onClose} />
            <UserFooter onNavigate={onClose} />
          </aside>
        </div>
      )}
    </>
  )
}

export default Sidebar
