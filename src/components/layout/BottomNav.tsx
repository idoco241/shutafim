import { NavLink } from 'react-router-dom'
import { useUnreadMessages } from '../../hooks/useUnreadMessages'

const tabs = [
  { label: 'חדרים',    icon: 'ti-building',     path: '/rooms' },
  { label: 'שיחות',   icon: 'ti-message-2',    path: '/chat',        chat: true },
  { label: 'שוק',     icon: 'ti-shopping-bag', path: '/marketplace' },
  { label: 'שותפים',  icon: 'ti-users',        path: '/roommates' },
]

export function BottomNav() {
  const unreadMessages = useUnreadMessages()

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 z-40">
      <div className="flex">
        {tabs.map((tab) => {
          const badge = tab.chat ? unreadMessages : 0
          return (
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
                {badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[1rem] h-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center leading-none">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              <span>{tab.label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
