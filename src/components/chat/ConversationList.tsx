import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { Avatar } from '../shared/Avatar'

interface ConvoRow {
  id: string
  listing_id: string | null
  user_a: string
  user_b: string
  created_at: string
  user_a_data: { id: string; name: string; avatar_url: string | null } | null
  user_b_data: { id: string; name: string; avatar_url: string | null } | null
  listing: { id: string; address: string } | null
}

interface MsgRow {
  conversation_id: string
  content: string
  created_at: string
  sender_id: string
  is_read: boolean
}

interface ThreadItem {
  id: string
  otherUser: { id: string; name: string; avatar_url: string | null }
  listingAddress: string | null
  lastMsg: MsgRow | null
  unreadCount: number
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  }
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (days < 7) return d.toLocaleDateString('he-IL', { weekday: 'short' })
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })
}

export function ConversationList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [threads, setThreads] = useState<ThreadItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    const load = async () => {
      const { data: convos, error } = await supabase
        .from('conversations')
        .select(
          '*, user_a_data:users!user_a(id, name, avatar_url), user_b_data:users!user_b(id, name, avatar_url), listing:listings!listing_id(id, address)'
        )
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)

      if (error || !convos?.length) {
        setLoading(false)
        return
      }

      const ids = (convos as ConvoRow[]).map(c => c.id)
      const { data: msgs } = await supabase
        .from('messages')
        .select('conversation_id, content, created_at, sender_id, is_read')
        .in('conversation_id', ids)
        .order('created_at', { ascending: false })

      const lastMsgMap = new Map<string, MsgRow>()
      const unreadMap = new Map<string, number>()

      ;(msgs ?? []).forEach((m: MsgRow) => {
        if (!lastMsgMap.has(m.conversation_id)) lastMsgMap.set(m.conversation_id, m)
        if (m.sender_id !== user.id && !m.is_read) {
          unreadMap.set(m.conversation_id, (unreadMap.get(m.conversation_id) ?? 0) + 1)
        }
      })

      const items: ThreadItem[] = (convos as ConvoRow[]).map(c => {
        const otherUser = c.user_a === user.id ? c.user_b_data : c.user_a_data
        return {
          id: c.id,
          otherUser: otherUser ?? { id: '?', name: '?', avatar_url: null },
          listingAddress: (c.listing as any)?.address ?? null,
          lastMsg: lastMsgMap.get(c.id) ?? null,
          unreadCount: unreadMap.get(c.id) ?? 0,
        }
      })

      items.sort((a, b) => {
        const aT = a.lastMsg?.created_at ?? ''
        const bT = b.lastMsg?.created_at ?? ''
        return bT.localeCompare(aT)
      })

      setThreads(items)
      setLoading(false)
    }

    load()
  }, [user])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 rounded-full border-2 border-purple-700 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!threads.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 px-8 text-center">
        <i className="ti ti-message-circle-off text-5xl text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">אין שיחות עדיין</p>
        <p className="text-xs text-gray-400 mt-1">הגש מועמדות למודעה כדי להתחיל שיחה</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="px-4 pt-4 pb-2 text-base font-semibold text-gray-900">שיחות</h1>
      {threads.map(t => (
        <button
          key={t.id}
          onClick={() => navigate(`/chat/${t.id}`)}
          className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 active:bg-gray-100 transition-colors text-right"
        >
          <Avatar name={t.otherUser.name} userId={t.otherUser.id} size="md" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-sm font-semibold text-gray-900 truncate">{t.otherUser.name}</span>
              {t.lastMsg && (
                <span className="text-xs text-gray-400 shrink-0 ml-2">
                  {formatTime(t.lastMsg.created_at)}
                </span>
              )}
            </div>

            {t.listingAddress && (
              <p className="text-xs text-purple-600 truncate mb-0.5">{t.listingAddress}</p>
            )}

            <div className="flex items-center justify-between">
              <p className={`text-sm truncate ${t.unreadCount > 0 ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
                {t.lastMsg ? t.lastMsg.content : 'אין הודעות'}
              </p>
              {t.unreadCount > 0 && (
                <span className="shrink-0 ml-2 w-5 h-5 rounded-full bg-purple-700 text-white text-[10px] flex items-center justify-center leading-none">
                  {t.unreadCount > 9 ? '9+' : t.unreadCount}
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
