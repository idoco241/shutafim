import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import type { Notification, NotificationType, NotificationPayload } from '../../types'

interface Props {
  onClose: () => void
}

const NOTIF_CONFIG: Record<NotificationType, { icon: string; color: string; text: string }> = {
  application:    { icon: 'ti-user-plus',     color: 'text-purple-600 bg-purple-50',  text: 'פנייה חדשה למודעה שלך' },
  accepted:       { icon: 'ti-circle-check',  color: 'text-emerald-600 bg-emerald-50', text: 'פנייתך התקבלה! 🎉' },
  rejected:       { icon: 'ti-circle-x',      color: 'text-gray-400 bg-gray-100',     text: 'פנייתך לא התקבלה הפעם' },
  group_message:  { icon: 'ti-broadcast',     color: 'text-purple-600 bg-purple-50',  text: 'הודעה חדשה בשידור הקבוצתי' },
  message:        { icon: 'ti-message-2',     color: 'text-blue-600 bg-blue-50',      text: 'הודעה חדשה בשיחה' },
  listing_closed: { icon: 'ti-lock',          color: 'text-gray-400 bg-gray-100',     text: 'מודעה שהתעניינת בה נסגרה' },
}

function navTarget(type: NotificationType, payload: NotificationPayload): string {
  switch (type) {
    case 'application':   return payload.listing_id ? `/listing/${payload.listing_id}/applicants` : '/'
    case 'accepted':      return payload.listing_id ? `/listing/${payload.listing_id}/group` : '/rooms'
    case 'rejected':      return '/rooms'
    case 'group_message': return payload.listing_id ? `/listing/${payload.listing_id}/group` : '/'
    case 'message':       return payload.conversation_id ? `/chat/${payload.conversation_id}` : '/chat'
    case 'listing_closed':return '/rooms'
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1)  return 'עכשיו'
  if (diffMin < 60) return `לפני ${diffMin} דק׳`
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  const diffDays = Math.floor(diffMs / 86_400_000)
  if (diffDays < 7) return d.toLocaleDateString('he-IL', { weekday: 'short' })
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })
}

export function NotificationsSheet({ onClose }: Props) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setNotifs((data ?? []) as Notification[])
        setLoading(false)
      })
  }, [user])

  const markOne = async (notif: Notification) => {
    if (!notif.is_read) {
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n))
      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id)
    }
    onClose()
    navigate(navTarget(notif.type, notif.payload))
  }

  const markAll = async () => {
    if (markingAll) return
    setMarkingAll(true)
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user!.id)
      .eq('is_read', false)
    setMarkingAll(false)
  }

  const unreadCount = notifs.filter(n => !n.is_read).length

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed bottom-0 inset-x-0 bg-white rounded-t-2xl z-50 flex flex-col max-h-[80dvh]">
        {/* Handle + header */}
        <div className="shrink-0 px-4 pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              התראות
              {unreadCount > 0 && (
                <span className="mr-2 text-xs font-medium text-white bg-red-500 px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </h2>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={markAll}
                  disabled={markingAll}
                  className="text-xs text-purple-700 font-medium disabled:opacity-50"
                >
                  סמן הכל כנקרא
                </button>
              )}
              <button onClick={onClose} className="p-1 text-gray-400">
                <i className="ti ti-x text-lg" />
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100" />

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex justify-center py-12">
              <div className="w-5 h-5 rounded-full border-2 border-purple-700 border-t-transparent animate-spin" />
            </div>
          )}

          {!loading && notifs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center px-8">
              <i className="ti ti-bell-off text-4xl text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">אין התראות עדיין</p>
            </div>
          )}

          {notifs.map(notif => {
            const cfg = NOTIF_CONFIG[notif.type]
            return (
              <button
                key={notif.id}
                onClick={() => markOne(notif)}
                className={`w-full flex items-start gap-3 px-4 py-3 border-b border-gray-100 text-right transition-colors ${notif.is_read ? 'bg-white hover:bg-gray-50' : 'bg-purple-50/40 hover:bg-purple-50'}`}
              >
                {/* Unread dot */}
                <div className="shrink-0 mt-1 w-2">
                  {!notif.is_read && (
                    <div className="w-2 h-2 rounded-full bg-purple-600" />
                  )}
                </div>

                {/* Type icon */}
                <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${cfg.color}`}>
                  <i className={`ti ${cfg.icon} text-base`} />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${notif.is_read ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                    {cfg.text}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatTime(notif.created_at)}</p>
                </div>

                <i className="ti ti-chevron-left text-gray-300 shrink-0 mt-1" />
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
