import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { Avatar } from '../components/shared/Avatar'

interface SenderProfile {
  id: string
  name: string
  avatar_url: string | null
}

interface GroupMsgRow {
  id: string
  listing_id: string
  sender_id: string
  content: string
  created_at: string
  sender: SenderProfile | null
}

function formatMsgTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' }) +
    ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
}

export default function GroupBroadcastPage() {
  const { id: listingId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [address, setAddress] = useState('')
  const [isOwner, setIsOwner] = useState(false)
  const [ownerProfile, setOwnerProfile] = useState<SenderProfile | null>(null)
  const [messages, setMessages] = useState<GroupMsgRow[]>([])
  const [loading, setLoading] = useState(true)
  const [notAllowed, setNotAllowed] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const ownerProfileRef = useRef<SenderProfile | null>(null)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior })
  }, [])

  useEffect(() => {
    if (!listingId || !user) return

    const load = async () => {
      // Load listing + owner profile
      const { data: listing } = await supabase
        .from('listings')
        .select('id, address, owner_id, owner:users!owner_id(id, name, avatar_url)')
        .eq('id', listingId)
        .single()

      if (!listing) { setNotAllowed(true); setLoading(false); return }

      const ownerIsMe = listing.owner_id === user.id
      setIsOwner(ownerIsMe)
      setAddress(listing.address)

      const op = (listing as any).owner as SenderProfile
      setOwnerProfile(op)
      ownerProfileRef.current = op

      // If not owner, verify accepted applicant
      if (!ownerIsMe) {
        const { data: app } = await supabase
          .from('applications')
          .select('id')
          .eq('listing_id', listingId)
          .eq('applicant_id', user.id)
          .eq('status', 'accepted')
          .maybeSingle()

        if (!app) { setNotAllowed(true); setLoading(false); return }
      }

      // Load messages with sender profile
      const { data: msgs } = await supabase
        .from('group_messages')
        .select('*, sender:users!sender_id(id, name, avatar_url)')
        .eq('listing_id', listingId)
        .order('created_at', { ascending: true })

      setMessages((msgs ?? []) as GroupMsgRow[])
      setLoading(false)
    }

    load()
  }, [listingId, user])

  // Scroll to bottom after initial load
  useEffect(() => {
    if (!loading) scrollToBottom('instant')
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime subscription
  useEffect(() => {
    if (!listingId) return

    const channel = supabase
      .channel(`group-${listingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `listing_id=eq.${listingId}`,
        },
        (payload) => {
          const raw = payload.new as Omit<GroupMsgRow, 'sender'>
          // Attach sender profile from cache (only owner can send)
          const msg: GroupMsgRow = {
            ...raw,
            sender: ownerProfileRef.current,
          }
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev
            return [...prev, msg]
          })
          scrollToBottom('smooth')
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [listingId, scrollToBottom])

  const handleSend = async () => {
    const content = input.trim()
    if (!content || !user || sending || !listingId) return

    setSending(true)
    setInput('')

    const { data: msg, error } = await supabase
      .from('group_messages')
      .insert({ listing_id: listingId, sender_id: user.id, content })
      .select('*')
      .single()

    if (!error && msg) {
      // Optimistic — Realtime will deduplicate
      const full: GroupMsgRow = { ...(msg as GroupMsgRow), sender: ownerProfileRef.current }
      setMessages(prev => prev.some(m => m.id === full.id) ? prev : [...prev, full])
      scrollToBottom('smooth')

      // Best-effort: notify all accepted applicants
      const { data: accepted } = await supabase
        .from('applications')
        .select('applicant_id')
        .eq('listing_id', listingId)
        .eq('status', 'accepted')

      if (accepted?.length) {
        await supabase.from('notifications').insert(
          accepted.map((a: { applicant_id: string }) => ({
            user_id: a.applicant_id,
            type: 'group_message',
            payload: { listing_id: listingId },
          }))
        )
      }
    }

    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  if (notAllowed) {
    return (
      <div className="flex flex-col items-center justify-center h-64 px-8">
        <i className="ti ti-lock text-4xl text-gray-300 mb-3" />
        <p className="text-sm text-gray-500 text-center">גישה לשידור הקבוצתי מיועדת לבעל המודעה ולמועמדים שהתקבלו</p>
        <button onClick={() => navigate(-1)} className="mt-3 text-sm text-purple-700">חזרה</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem-4rem)]">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1">
            <i className="ti ti-arrow-left text-xl text-gray-700" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">שידור קבוצתי</p>
            {address && <p className="text-xs text-gray-500 truncate">{address}</p>}
          </div>
          <i className="ti ti-broadcast text-lg text-purple-600 shrink-0" />
        </div>

        {/* Context chip */}
        <div className="px-4 pb-2">
          <span className="text-[11px] text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">
            {isOwner ? 'אתה שולח • הדיירים שהתקבלו רואים' : 'בעל המודעה שולח • אתה קורא'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading && (
          <div className="flex justify-center pt-8">
            <div className="w-5 h-5 rounded-full border-2 border-purple-700 border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center pt-12">
            <i className="ti ti-broadcast text-4xl text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">
              {isOwner ? 'שלח הודעה לכל הדיירים שהתקבלו' : 'אין הודעות עדיין'}
            </p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isOwnerMsg = msg.sender_id === ownerProfile?.id
          const showTime =
            i === messages.length - 1 ||
            new Date(messages[i + 1].created_at).getTime() - new Date(msg.created_at).getTime() > 5 * 60 * 1000

          // From owner's POV: own msgs right-aligned; from applicant's POV: owner msgs left-aligned
          const alignRight = isOwner && isOwnerMsg

          return (
            <div key={msg.id} className={`flex flex-col ${alignRight ? 'items-end' : 'items-start'}`}>
              {/* Sender name (shown only when not right-aligned own message) */}
              {!alignRight && msg.sender && (
                <div className="flex items-center gap-1.5 mb-1">
                  <Avatar name={msg.sender.name} userId={msg.sender.id} size="sm" />
                  <span className="text-xs font-medium text-gray-600">{msg.sender.name}</span>
                </div>
              )}

              <div
                className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-relaxed break-words whitespace-pre-wrap ${
                  alignRight
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

      {/* Input (owner) or read-only label (applicant) */}
      {isOwner ? (
        <div className="shrink-0 bg-white border-t border-gray-100 px-3 py-2 flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="שלח הודעה לכל הדיירים שהתקבלו..."
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
      ) : (
        <div className="shrink-0 bg-gray-50 border-t border-gray-100 px-4 py-3 flex items-center gap-2">
          <i className="ti ti-eye text-gray-400" />
          <span className="text-xs text-gray-400">מצב צפייה בלבד — רק בעל המודעה יכול לשלוח</span>
        </div>
      )}
    </div>
  )
}
