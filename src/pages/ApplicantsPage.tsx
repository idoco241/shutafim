import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { Avatar } from '../components/shared/Avatar'
import type { ApplicationStatus } from '../types'

interface ApplicantProfile {
  id: string
  name: string
  avatar_url: string | null
  field_of_study: string | null
  year_of_study: number | null
  age: number | null
}

interface AppRow {
  id: string
  listing_id: string
  applicant_id: string
  conversation_id: string | null
  status: ApplicationStatus
  created_at: string
  applicant: ApplicantProfile | null
}

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  pending: 'ממתין',
  accepted: 'התקבל',
  rejected: 'נדחה',
  denied_closed: 'מודעה נסגרה',
}

const STATUS_STYLE: Record<ApplicationStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  accepted: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-gray-100 text-gray-500',
  denied_closed: 'bg-gray-100 text-gray-400',
}

export default function ApplicantsPage() {
  const { id: listingId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [address, setAddress] = useState<string>('')
  const [isActive, setIsActive] = useState(true)
  const [apps, setApps] = useState<AppRow[]>([])
  const [loading, setLoading] = useState(true)
  const [notAllowed, setNotAllowed] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Close listing state
  const [confirmClose, setConfirmClose] = useState(false)
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState('')

  useEffect(() => {
    if (!listingId || !user) return

    const load = async () => {
      const { data: listing } = await supabase
        .from('listings')
        .select('id, address, owner_id, is_active')
        .eq('id', listingId)
        .single()

      if (!listing || listing.owner_id !== user.id) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      setAddress(listing.address)
      setIsActive(listing.is_active)

      const { data } = await supabase
        .from('applications')
        .select('*, applicant:users!applicant_id(id, name, avatar_url, field_of_study, year_of_study, age)')
        .eq('listing_id', listingId)
        .order('created_at', { ascending: true })

      setApps((data ?? []) as AppRow[])
      setLoading(false)
    }

    load()
  }, [listingId, user])

  const updateStatus = async (app: AppRow, newStatus: 'accepted' | 'rejected') => {
    if (actionLoading) return
    setActionLoading(app.id)
    setApps(prev => prev.map(a => a.id === app.id ? { ...a, status: newStatus } : a))

    const { error } = await supabase
      .from('applications')
      .update({ status: newStatus })
      .eq('id', app.id)

    if (error) {
      setApps(prev => prev.map(a => a.id === app.id ? { ...a, status: app.status } : a))
      setActionLoading(null)
      return
    }

    await supabase.from('notifications').insert({
      user_id: app.applicant_id,
      type: newStatus,
      payload: { listing_id: listingId },
    })

    setActionLoading(null)
  }

  const handleCloseListing = async () => {
    if (!listingId || closing) return
    setClosing(true)
    setCloseError('')

    // Step 1 — deactivate listing
    const { error: listingErr } = await supabase
      .from('listings')
      .update({ is_active: false })
      .eq('id', listingId)

    if (listingErr) {
      setCloseError('שגיאה בסגירת המודעה, נסה שוב')
      setClosing(false)
      return
    }

    // Step 2 — deny all pending applications
    const pendingIds = apps.filter(a => a.status === 'pending').map(a => a.applicant_id)

    const { error: appsErr } = await supabase
      .from('applications')
      .update({ status: 'denied_closed' })
      .eq('listing_id', listingId)
      .eq('status', 'pending')

    if (appsErr) {
      // Rollback listing deactivation
      await supabase.from('listings').update({ is_active: true }).eq('id', listingId)
      setCloseError('שגיאה בעדכון הפניות, המודעה לא נסגרה')
      setClosing(false)
      return
    }

    // Step 3 — notify denied applicants (best-effort, no rollback)
    if (pendingIds.length > 0) {
      await supabase.from('notifications').insert(
        pendingIds.map(uid => ({
          user_id: uid,
          type: 'listing_closed',
          payload: { listing_id: listingId },
        }))
      )
    }

    // Update local state
    setIsActive(false)
    setApps(prev => prev.map(a => a.status === 'pending' ? { ...a, status: 'denied_closed' } : a))
    setConfirmClose(false)
    setClosing(false)
  }

  if (notAllowed) {
    return (
      <div className="flex flex-col items-center justify-center h-64 px-8">
        <i className="ti ti-lock text-4xl text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">אין הרשאה לצפות בדף זה</p>
        <button onClick={() => navigate(-1)} className="mt-3 text-sm text-purple-700">חזרה</button>
      </div>
    )
  }

  const pendingCount = apps.filter(a => a.status === 'pending').length
  const acceptedCount = apps.filter(a => a.status === 'accepted').length

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 mr-2">
          <i className="ti ti-arrow-left text-xl text-gray-700" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">מועמדים</p>
            {!isActive && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-500">
                מודעה סגורה
              </span>
            )}
          </div>
          {address && <p className="text-xs text-gray-500 truncate">{address}</p>}
        </div>
        <button
          onClick={() => navigate(`/listing/${listingId}/group`)}
          title="שידור קבוצתי"
          className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
        >
          <i className="ti ti-broadcast text-lg" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 rounded-full border-2 border-purple-700 border-t-transparent animate-spin" />
        </div>
      ) : apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 px-8 text-center">
          <i className="ti ti-user-search text-5xl text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">אין מועמדים עדיין</p>
          <p className="text-xs text-gray-400 mt-1">המועמדים יופיעו כאן לאחר שיגישו פנייה</p>
        </div>
      ) : (
        <>
          {/* Stats strip */}
          <div className="flex gap-4 px-4 py-3 border-b border-gray-100 bg-gray-50">
            <span className="text-sm text-gray-600">
              סה"כ: <span className="font-semibold text-gray-900">{apps.length}</span>
            </span>
            <span className="text-sm text-gray-600">
              ממתינים: <span className="font-semibold text-amber-600">{pendingCount}</span>
            </span>
            <span className="text-sm text-gray-600">
              התקבלו: <span className="font-semibold text-emerald-600">{acceptedCount}</span>
            </span>
          </div>

          {/* Applicant cards */}
          <div className="divide-y divide-gray-100">
            {apps.map(app => {
              const p = app.applicant
              const isInFlight = actionLoading === app.id

              return (
                <div key={app.id} className="px-4 py-4 bg-white">
                  <div className="flex items-start gap-3">
                    <Avatar name={p?.name ?? '?'} userId={app.applicant_id} size="md" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {p?.name ?? '—'}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[app.status]}`}>
                          {STATUS_LABEL[app.status]}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 mb-3">
                        {p?.field_of_study && <span>{p.field_of_study}</span>}
                        {p?.year_of_study && <span>שנה {p.year_of_study}</span>}
                        {p?.age && <span>גיל {p.age}</span>}
                      </div>

                      <div className="flex gap-2">
                        {app.status === 'pending' && isActive && (
                          <>
                            <button
                              onClick={() => updateStatus(app, 'accepted')}
                              disabled={!!isInFlight}
                              className="flex-1 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl disabled:opacity-50 active:scale-[0.98] transition-all"
                            >
                              {isInFlight ? '...' : 'קבל'}
                            </button>
                            <button
                              onClick={() => updateStatus(app, 'rejected')}
                              disabled={!!isInFlight}
                              className="flex-1 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl disabled:opacity-50 active:scale-[0.98] transition-all"
                            >
                              דחה
                            </button>
                          </>
                        )}

                        {app.conversation_id && (
                          <button
                            onClick={() => navigate(`/chat/${app.conversation_id}`)}
                            className={`py-2 border border-purple-200 text-purple-700 text-sm font-medium rounded-xl active:scale-[0.98] transition-all ${(app.status === 'pending' && isActive) ? 'px-3' : 'flex-1'}`}
                          >
                            <i className="ti ti-message-2 text-sm" />
                            {!(app.status === 'pending' && isActive) && <span className="mr-1.5">פתח שיחה</span>}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Close listing CTA — fixed at bottom, only shown when listing is still active */}
      {!loading && isActive && (
        <div className="fixed bottom-16 inset-x-0 bg-white border-t border-gray-100 px-4 py-3 z-20">
          <button
            onClick={() => setConfirmClose(true)}
            className="w-full py-3 border border-red-300 text-red-600 text-sm font-medium rounded-xl hover:bg-red-50 active:scale-[0.98] transition-all"
          >
            <i className="ti ti-lock text-sm ml-1.5" />
            סגור מודעה
          </button>
        </div>
      )}

      {/* Confirmation bottom sheet */}
      {confirmClose && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-50"
            onClick={() => { if (!closing) setConfirmClose(false) }}
          />
          <div className="fixed bottom-0 inset-x-0 bg-white rounded-t-2xl z-50 p-5 pb-10">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mx-auto mb-3">
              <i className="ti ti-lock text-2xl text-red-500" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 text-center mb-1">סגירת מודעה</h2>
            <p className="text-sm text-gray-500 text-center mb-1">
              המודעה תוסר מהחיפוש ולא ניתן יהיה להגיש מועמדויות חדשות.
            </p>
            {pendingCount > 0 && (
              <p className="text-sm text-amber-600 text-center mb-4">
                {pendingCount} פנייה/ות ממתינות יקבלו הודעת דחייה.
              </p>
            )}
            {!pendingCount && <div className="mb-4" />}

            {closeError && (
              <p className="text-sm text-red-500 text-center mb-3">{closeError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setConfirmClose(false); setCloseError('') }}
                disabled={closing}
                className="flex-1 py-3 border border-gray-200 text-gray-700 text-sm rounded-xl disabled:opacity-50"
              >
                ביטול
              </button>
              <button
                onClick={handleCloseListing}
                disabled={closing}
                className="flex-1 py-3 bg-red-600 text-white text-sm font-medium rounded-xl disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                {closing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    סוגר...
                  </span>
                ) : (
                  'סגור מודעה'
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
