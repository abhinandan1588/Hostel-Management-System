import { NavLink } from 'react-router-dom'

import { MOBILE_TABS } from '../../config/navigation'

/** Bottom tab bar for phones. Hidden from lg upwards where the sidebar shows. */
export function MobileNavbar({ role }) {
  const tabs = MOBILE_TABS[role] || []
  if (!tabs.length) return null

  return (
    <nav
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
      aria-label="Quick navigation"
    >
      <ul className="grid grid-cols-5">
        {tabs.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-1 pt-2 pb-1 text-[10px] font-semibold transition-colors ${
                  isActive ? 'text-brand-700' : 'text-slate-500'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${
                      isActive ? 'bg-brand-50' : ''
                    }`}
                  >
                    <tab.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="truncate">{tab.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default MobileNavbar
