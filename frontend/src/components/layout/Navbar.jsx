import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, GraduationCap, Menu, Search, Users } from 'lucide-react'

import { NOTIFICATION_PATH } from '../../config/navigation'
import { useAuth } from '../../context/auth'
import { useDebounce } from '../../hooks'
import { adminService, notificationService } from '../../services'
import { greeting } from '../../utils/format'
import { Avatar } from '../common/Primitives'

const POLL_INTERVAL = 60000

/** Global admin search with a dropdown of students, parents and rooms. */
function GlobalSearch() {
  const [term, setTerm] = useState('')
  // Stored with the term it belongs to, so "searching" is derived rather than
  // tracked in its own state.
  const [answer, setAnswer] = useState(null)
  const [open, setOpen] = useState(false)
  const debounced = useDebounce(term, 350)
  const containerRef = useRef(null)
  const navigate = useNavigate()

  const query = debounced.trim()
  const busy = query.length >= 2 && answer?.term !== query
  const results = answer?.term === query ? answer.data : null

  useEffect(() => {
    if (query.length < 2) return undefined
    let active = true
    adminService
      .search(query)
      .then((data) => {
        if (active) setAnswer({ term: query, data })
      })
      .catch(() => {
        if (active) setAnswer({ term: query, data: null })
      })
    return () => {
      active = false
    }
  }, [query])

  useEffect(() => {
    const onClickOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const go = (path) => {
    setOpen(false)
    setTerm('')
    navigate(path)
  }

  const hasResults =
    results && (results.students?.length || results.parents?.length || results.rooms?.length)

  return (
    <div ref={containerRef} className="relative hidden flex-1 max-w-md md:block">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <input
        type="search"
        className="input py-2 pl-9"
        placeholder="Search students, parents, rooms…"
        value={term}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setTerm(event.target.value)
          setOpen(true)
        }}
        aria-label="Global search"
      />
      {open && term.trim().length >= 2 && (
        <div className="absolute top-full right-0 left-0 z-30 mt-2 max-h-96 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-[var(--shadow-float)]">
          {busy && <p className="px-3 py-2 text-sm text-slate-500">Searching…</p>}
          {!busy && !hasResults && (
            <p className="px-3 py-2 text-sm text-slate-500">No matches for “{term}”.</p>
          )}
          {results?.students?.length > 0 && (
            <SearchGroup label="Students" icon={GraduationCap}>
              {results.students.map((student) => (
                <SearchRow
                  key={`s-${student.id}`}
                  title={student.full_name}
                  subtitle={`${student.student_code} · ${student.student_class || '—'}`}
                  onClick={() => go(`/admin/students/${student.id}`)}
                />
              ))}
            </SearchGroup>
          )}
          {results?.parents?.length > 0 && (
            <SearchGroup label="Parents" icon={Users}>
              {results.parents.map((parent) => (
                <SearchRow
                  key={`p-${parent.id}`}
                  title={parent.full_name}
                  subtitle={parent.phone || parent.email}
                  onClick={() => go(`/admin/parents/${parent.id}`)}
                />
              ))}
            </SearchGroup>
          )}
          {results?.rooms?.length > 0 && (
            <SearchGroup label="Rooms">
              {results.rooms.map((room) => (
                <SearchRow
                  key={`r-${room.id}`}
                  title={room.label}
                  subtitle={`${room.occupied_beds} occupied · ${room.available_beds} free`}
                  onClick={() => go('/admin/rooms')}
                />
              ))}
            </SearchGroup>
          )}
        </div>
      )}
    </div>
  )
}

function SearchGroup({ label, icon: Icon, children }) {
  return (
    <div className="mb-1">
      <p className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
        {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
        {label}
      </p>
      {children}
    </div>
  )
}

function SearchRow({ title, subtitle, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left hover:bg-slate-50"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-slate-800">{title}</span>
        <span className="block truncate text-xs text-slate-500">{subtitle}</span>
      </span>
    </button>
  )
}

/** Unread-count bell. Polls, and exposes a refresh for page-level updates. */
export function NotificationBell({ to }) {
  const [count, setCount] = useState(0)

  const load = useCallback(() => {
    notificationService
      .unreadCount()
      .then((data) => setCount(data?.unread_count || 0))
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, POLL_INTERVAL)
    return () => clearInterval(timer)
  }, [load])

  return (
    <Link
      to={to}
      className="relative rounded-xl p-2.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
      aria-label={count ? `Notifications, ${count} unread` : 'Notifications'}
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      {count > 0 && (
        <span className="absolute top-1 right-1 inline-flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}

export function Navbar({ onMenuClick, title, subtitle }) {
  const { user, isAdmin } = useAuth()
  const notificationsPath = NOTIFICATION_PATH[user?.role] || '/'

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-3 py-2.5 backdrop-blur sm:px-4">
      <button
        type="button"
        onClick={onMenuClick}
        className="rounded-xl p-2.5 text-slate-600 hover:bg-slate-100 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="min-w-0 flex-1 lg:flex lg:items-center lg:gap-6">
        <div className="min-w-0 lg:w-auto">
          <p className="truncate text-sm font-semibold text-slate-900">
            {title || `${greeting()}, ${user?.full_name?.split(' ')[0] || 'there'}`}
          </p>
          {subtitle && <p className="truncate text-[11px] text-slate-500">{subtitle}</p>}
        </div>
        {isAdmin && <GlobalSearch />}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <NotificationBell to={notificationsPath} />
        <Avatar src={user?.profile_photo} name={user?.full_name} size="sm" className="ml-1" />
      </div>
    </header>
  )
}

export default Navbar
