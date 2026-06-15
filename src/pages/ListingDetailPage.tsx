import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { applyToListing, DEFAULT_APPLY_MESSAGE } from '../lib/applications'
import { formatHebrewDate } from '../lib/listings'
import { Avatar } from '../components/shared/Avatar'
import type { Listing, Application } from '../types'

type ListingWithOwner = Listing & {
  owner: { id: string; name: string; avatar_url: string | null }
}

const APP_STATUS_LABEL: Record<string, string> = {
  pending: 'ממתין לתשובה',
  accepted: 'התקבלת! 🎉',
  rejected: 'לא התקבלת הפעם',
  denied_closed: 'המודעה נסגרה',
}

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [listing, setListing] = useState<ListingWithOwner | null>(null)
  const [existingApp, setExistingApp] = useState<Application | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [applyOpen, setApplyOpen] = useState(false)
  const [applyMessage, setApplyMessage] = useState(DEFAULT_APPLY_MESSAGE)
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState('')

  useEffect(() => {
    if (!id) return

    const load = async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('*, owner:users!owner_id(id, name, avatar_url)')
        .eq('id', id)
        .single()

      if (error || !data) {
        setNotFound(true)
        setLoading(false)
        return
      }

      const listing = data as ListingWithOwner
      setListing(listing)

      // Only check application status for non-owners
      if (user && user.id !== listing.owner_id) {
        const { data: app } = await supabase
          .from('applications')
          .select('*')
          .eq('listing_id', id)
          .eq('applicant_id', user.id)
          .maybeSingle()
        setExistingApp(app as Application | null)
      }

      setLoading(false)
    }

    load()
  }, [id, user])

  const isOwner = user?.id === listing?.owner_id

  const handleApply = async () => {
    if (!user || !listing) return
    setApplying(true)
    setApplyError('')
    try {
      const conversationId = await applyToListing(
        listing.id,
        listing.owner_id,
        user.id,
        applyMessage
      )
      setApplyOpen(false)
      navigate(`/chat/${conversationId}`)
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'שגיאה בשליחת הפנייה')
    } finally {
      setApplying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 rounded-full border-2 border-purple-700 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (notFound || !listing) {
    return (
      <div className="flex flex-col items-center justify-center h-64 px-8">
        <i className="ti ti-building-off text-4xl text-gray-300 mb-3" />
        <p className="text-sm text-gray-500 text-center">מודעה לא נמצאה</p>
        <button onClick={() => navigate('/rooms')} className="mt-4 text-sm text-purple-700">
          חזרה לחיפוש
        </button>
      </div>
    )
  }

  const dateText =
    listing.listing_type === 'full_lease'
      ? `כניסה: ${formatHebrewDate(listing.available_from)}`
      : `${formatHebrewDate(listing.available_from)} – ${formatHebrewDate(listing.sublet_end!)}`

  return (
    <div className="pb-36">
      {/* Back header */}
      <div className="flex items-center px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 mr-2">
          <i className="ti ti-arrow-left text-xl text-gray-700" />
        </button>
        <span className="text-sm font-medium text-gray-900 truncate">{listing.address}</span>
      </div>

      {/* Image gallery */}
      {listing.image_urls && listing.image_urls.length > 0 ? (
        <>
          <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide">
            {listing.image_urls.map((url, i) => (
              <div key={i} className="snap-center shrink-0 w-full">
                <img src={url} alt={`תמונה ${i + 1}`} className="w-full aspect-video object-cover" />
              </div>
            ))}
          </div>
          {listing.image_urls.length > 1 && (
            <div className="flex justify-center gap-1.5 py-2">
              {listing.image_urls.map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-300" />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="aspect-video bg-gray-100 flex items-center justify-center">
          <i className="ti ti-building text-6xl text-gray-300" />
        </div>
      )}

      {/* Key info */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-baseline justify-between mb-2">
          <div>
            <span className="text-2xl font-bold text-gray-900">
              ₪{listing.price_per_month.toLocaleString()}
            </span>
            <span className="text-sm text-gray-400 ml-1">/חודש</span>
          </div>
          {listing.total_rooms && (
            <span className="text-sm text-gray-500">{listing.total_rooms} חדרים</span>
          )}
        </div>

        <p className="text-base text-gray-800 mb-0.5">{listing.address}</p>
        {listing.neighborhood && (
          <p className="text-sm text-gray-500">{listing.neighborhood}</p>
        )}
        {listing.floor != null && (
          <p className="text-sm text-gray-500">קומה {listing.floor}</p>
        )}
      </div>

      {/* Type + dates + restrictions */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex flex-wrap gap-2 mb-2">
          {listing.listing_type === 'full_lease' ? (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-purple-50 text-purple-700">
              שכירות מלאה
            </span>
          ) : (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
              סאבלט
            </span>
          )}
          {listing.restrictions?.sex === 'f' && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-pink-50 text-pink-600">נשים בלבד</span>
          )}
          {listing.restrictions?.sex === 'm' && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">גברים בלבד</span>
          )}
          {listing.restrictions?.min_year && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
              שנה {listing.restrictions.min_year}+
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500">{dateText}</p>
      </div>

      {/* Description */}
      {listing.description && (
        <div className="px-4 py-3 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">תיאור</h3>
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
            {listing.description}
          </p>
        </div>
      )}

      {/* Owner */}
      <div className="px-4 py-3 border-t border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">המפרסם</h3>
        <div className="flex items-center gap-3">
          <Avatar name={listing.owner.name || '?'} userId={listing.owner.id} size="md" />
          <span className="text-sm font-medium text-gray-800">{listing.owner.name}</span>
        </div>
      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-16 inset-x-0 bg-white border-t border-gray-100 px-4 py-3 z-20">
        {isOwner ? (
          <button
            onClick={() => navigate('/chat')}
            className="w-full py-3 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors"
          >
            ניהול מועמדים
          </button>
        ) : existingApp ? (
          <button
            onClick={() =>
              existingApp.conversation_id && navigate(`/chat/${existingApp.conversation_id}`)
            }
            className="w-full py-3 border border-purple-700 text-purple-700 text-sm font-medium rounded-xl"
          >
            {APP_STATUS_LABEL[existingApp.status] ?? 'פנייה נשלחה'} — פתח שיחה
          </button>
        ) : (
          <button
            onClick={() => setApplyOpen(true)}
            className="w-full py-3 bg-purple-700 text-white text-sm font-medium rounded-xl hover:bg-purple-800 transition-colors"
          >
            הגש מועמדות
          </button>
        )}
      </div>

      {/* Apply modal */}
      {applyOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-50"
            onClick={() => { setApplyOpen(false); setApplyError('') }}
          />
          <div className="fixed bottom-0 inset-x-0 bg-white rounded-t-2xl z-50 p-4 pb-10">
            <h2 className="text-base font-semibold text-gray-900 mb-3">שליחת הודעת פנייה</h2>
            <textarea
              value={applyMessage}
              onChange={(e) => setApplyMessage(e.target.value)}
              rows={4}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            {applyError && <p className="text-sm text-red-500 mt-2">{applyError}</p>}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { setApplyOpen(false); setApplyError('') }}
                className="basis-1/3 py-3 border border-gray-200 text-gray-700 text-sm rounded-xl"
              >
                ביטול
              </button>
              <button
                onClick={handleApply}
                disabled={applying || !applyMessage.trim()}
                className="basis-2/3 py-3 bg-purple-700 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors"
              >
                {applying ? 'שולח...' : 'שלח פנייה'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
