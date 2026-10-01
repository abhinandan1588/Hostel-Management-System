import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { NAV_BY_ROLE } from '../../config/navigation'
import { useAuth } from '../../context/auth'
import { useBodyScrollLock, useEscapeKey } from '../../hooks'
import { EmergencyBanner } from './EmergencyBanner'
import { MobileNavbar } from './MobileNavbar'
import { Navbar } from './Navbar'
import { Sidebar } from './Sidebar'

/**
 * Shared responsive shell: sidebar (desktop) / drawer + bottom tabs (mobile),
 * sticky top bar and the routed page content.
 */
export function AppShell({ role, showEmergencyBanner = false }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const [lastPath, setLastPath] = useState(location.pathname)
  const { user } = useAuth()
  const groups = NAV_BY_ROLE[role] || []

  // Close the drawer whenever the route changes (adjusted during render, so the
  // new page never paints with the drawer still open).
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    if (drawerOpen) setDrawerOpen(false)
  }

  useEscapeKey(() => setDrawerOpen(false), drawerOpen)
  useBodyScrollLock(drawerOpen)

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar
        groups={groups}
        role={role}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar onMenuClick={() => setDrawerOpen(true)} />
        {showEmergencyBanner && <EmergencyBanner />}

        <main className="flex-1 px-3 py-4 pb-24 sm:px-4 sm:py-5 lg:px-6 lg:pb-8">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>

        <footer className="hidden border-t border-slate-200 px-6 py-3 text-xs text-slate-400 lg:block">
          Hostel Management System · signed in as {user?.full_name} ({user?.role?.toLowerCase()})
        </footer>
      </div>

      <MobileNavbar role={role} />
    </div>
  )
}

export function AdminLayout() {
  return <AppShell role="ADMIN" />
}

export function ParentLayout() {
  return <AppShell role="PARENT" showEmergencyBanner />
}

export function StudentLayout() {
  return <AppShell role="STUDENT" showEmergencyBanner />
}

export default AppShell
