import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { Avatar } from '../shared/Avatar'

interface MsgRow {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  is_read: boolean
  created_at: string
}

interface OtherUser {
  id: string
  name: string
  avatar_url: string | null
}

interface ConvMeta {
  otherUser: OtherUser
  listingAddress: string | null
}

function formatMsgTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
}

interface Props {
  conversationId: string
}

export function ChatThread({ conversationId }: Props) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [meta, setMeta] = useState<ConvMeta | null>(null)
  const [messages, setMessages] = useState<MsgRow[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior })
  }, [])

  // Mark unread messages from other user as read
  const markRead = useCallback(async () => {
    if (!user) return
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id)
      .eq('is_read', false)
  }, [conversationId, user])

  // Initial load
  useEffect(() => {
    if (!user) return

    const load = async () => {
      const { data: conv, error } = await supabase
        .from('conversations')
        .select(
          '*, user_a_data:users!user_a(id, name, avatar_url), user_b_data:users!user_b(id, name, avatar_url), listing:listings!listing_id(id, address)'
        )
        .eq('id', conversationId)
        .single()

      if (error || !conv) { setNotFound(true); setLoading(false); return }

      const isUserA = conv.user_a === user.id
      const otherUser = (isUserA ? conv.user_b_data : conv.user_a_data) as OtherUser
      setMeta({
        otherUser: otherUser ?? { id: '?', name: '?', avatar_url: null },
        listingAddress: (conv.listing as any)?.address ?? null,
      })

      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      setMessages((msgs ?? []) as MsgRow[])
      setLoading(false)
      await markRead()
    }

    load()
  }, [conversationId, user, markRead])

  // Scroll to bottom when messages first load
  useEffect(() => {
    if (!loading && messages.length > 0) scrollToBottom('instant')
  }, [loading]) // only on load complete

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const msg = payload.new as MsgRow
          setMessages(prev => {
            // Deduplicate (optimistic insert may already have it)
            if (prev.some(m => m.id === msg.id)) return prev
            return [...prev, msg]
          })
          if (msg.sender_id !== user?.id) {
            await supabase.from('messages').update({ is_read: true }).eq('id', msg.id)
          }
          scrollToBottom('smooth')
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId, user, scrollToBottom])

  const handleSend = async () => {
    const content = input.trim()
    if (!content || !user || sending) return

    setSending(true)
    setInput('')

    const { data: msg, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: user.id, content })
      .select('*')
      .single()

    if (!error && msg) {
      // Add optimistically — Realtime will deduplicate
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev
        return [...prev, msg as MsgRow]
      })
      scrollToBottom('smooth')
    }

    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center h-64 px-8">
        <i className="ti ti-message-off text-4xl text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">שיחה לא נמצאה</p>
        <button onClick={() => navigate('/chat')} className="mt-3 text-sm text-purple-700">
          חזרה לשיחות
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem-4rem)]">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
        <button onClick={() => navigate('/chat')} className="p-1 -ml-1">
          <i className="ti ti-arrow-left text-xl text-gray-700" />
        </button>

        {meta ? (
          <>
            <Avatar name={meta.otherUser.name} userId={meta.otherUser.id} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{meta.otherUser.name}</p>
              {meta.listingAddress && (
                <p className="text-xs text-purple-600 truncate">{meta.listingAddress}</p>
              )}
            </div>
          </>
        ) : (
          <div className="h-9 w-40 bg-gray-100 rounded-lg animate-pulse" />
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading && (
          <div className="flex justify-center pt-8">
            <div className="w-5 h-5 rounded-full border-2 border-purple-700 border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="text-center text-sm text-gray-400 pt-8">תחילת השיחה</div>
        )}

        {messages.map((msg, i) => {
          const isOwn = msg.sender_id === user?.id
          const showTime =
            i === messages.length - 1 ||
            new Date(messages[i + 1].created_at).getTime() - new Date(msg.created_at).getTime() > 5 * 60 * 1000

          return (
            <div key={msg.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed break-words whitespace-pre-wrap ${
                  isOwn
                    ? 'bg-purple-700 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                }`}
              >
                {msg.content}
              </div>
              {showTime && (
                <span className="text-[10px] text-gray-400 mt-0.5 px-1">
                  {formatMsgTime(msg.created_at)}
                </span>
              )}
            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="shrink-0 bg-white border-t border-gray-100 px-3 py-2 flex items-end gap-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="כתוב הודעה..."
          rows={1}
          className="flex-1 resize-none px-3 py-2 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 max-h-28 overflow-y-auto"
          style={{ lineHeight: '1.4' }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="w-9 h-9 rounded-full bg-purple-700 text-white flex items-center justify-center disabled:opacity-40 shrink-0 active:scale-95 transition-transform"
        >
          <i className="ti ti-send text-sm" />
        </button>
      </div>
    </div>
  )
}
