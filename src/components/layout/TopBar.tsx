import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { NotificationsSheet } from '../notifications/NotificationsSheet'

export function TopBar() {
  const { user } = useAuth()
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)

  const fetchUnread = async () => {
    if (!user) return
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
    setUnread(count ?? 0)
  }

  useEffect(() => { fetchUnread() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    setOpen(false)
    fetchUnread() // refresh badge after sheet closes (reads may have occurred)
  }

  return (
    <>
      <header className="sticky top-0 bg-white border-b border-gray-100 z-30 px-4 py-3 flex items-center justify-between">
        <span className="font-semibold text-purple-700 text-lg">שותפים</span>

        {user && (
          <button
            onClick={() => setOpen(true)}
            className="relative p-1 -mr-1"
            aria-label="התראות"
          >
            <i className="ti ti-bell text-xl text-gray-600" />
            {unread > 0 && (
              <span className="absolute top-0 right-0 min-w-[1rem] h-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center leading-none">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
        )}
      </header>

      {open && <NotificationsSheet onClose={handleClose} />}
    </>
  )
}
