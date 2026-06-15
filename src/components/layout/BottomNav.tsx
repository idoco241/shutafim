import { NavLink } from 'react-router-dom'

const tabs = [
  { label: 'Rooms',     icon: 'ti-building',     path: '/rooms' },
  { label: 'Chat',      icon: 'ti-message-2',    path: '/chat',        badge: 0 },
  { label: 'Market',    icon: 'ti-shopping-bag', path: '/marketplace' },
  { label: 'Roommates', icon: 'ti-users',        path: '/roommates' },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 z-40">
      <div className="flex">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-2 gap-0.5 text-xs transition-colors ${
                isActive ? 'text-purple-700' : 'text-gray-400'
              }`
            }
          >
            <div className="relative">
              <i className={`ti ${tab.icon} text-xl`} />
              {tab.badge ? (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center leading-none">
                  {tab.badge > 9 ? '9+' : tab.badge}
                </span>
              ) : null}
            </div>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
