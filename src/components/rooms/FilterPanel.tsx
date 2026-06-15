import { useState } from 'react'
import type { Filters } from '../../hooks/useListings'
import type { ListingType } from '../../types'
import { NEIGHBORHOODS } from '../../lib/listings'

interface LocalState {
  minPrice: string
  maxPrice: string
  neighborhood: string
  listingType: '' | ListingType
  totalRooms: string
  matchMyProfile: boolean
}

interface Props {
  filters: Filters
  onApply: (f: Filters) => void
  onClose: () => void
}

export function FilterPanel({ filters, onApply, onClose }: Props) {
  const [local, setLocal] = useState<LocalState>({
    minPrice: filters.minPrice?.toString() ?? '',
    maxPrice: filters.maxPrice?.toString() ?? '',
    neighborhood: filters.neighborhood ?? '',
    listingType: filters.listingType ?? '',
    totalRooms: filters.totalRooms?.toString() ?? '',
    matchMyProfile: filters.matchMyProfile,
  })

  const set = (patch: Partial<LocalState>) => setLocal((p) => ({ ...p, ...patch }))

  const handleApply = () => {
    onApply({
      minPrice: local.minPrice ? parseInt(local.minPrice) : null,
      maxPrice: local.maxPrice ? parseInt(local.maxPrice) : null,
      neighborhood: local.neighborhood || null,
      listingType: local.listingType || null,
      totalRooms: local.totalRooms ? parseInt(local.totalRooms) : null,
      matchMyProfile: local.matchMyProfile,
    })
    onClose()
  }

  const handleReset = () =>
    setLocal({ minPrice: '', maxPrice: '', neighborhood: '', listingType: '', totalRooms: '', matchMyProfile: false })

  const typeOptions = [
    { value: '' as const, label: 'הכל' },
    { value: 'full_lease' as ListingType, label: 'שכירות מלאה' },
    { value: 'sublet' as ListingType, label: 'סאבלט' },
  ]

  const roomOptions = [
    { value: '', label: 'הכל' },
    { value: '1', label: '1' },
    { value: '2', label: '2' },
    { value: '3', label: '3' },
    { value: '4', label: '4+' },
  ]

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed bottom-0 inset-x-0 bg-white rounded-t-2xl z-50 p-4 pb-10 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">סינון</h2>
          <button onClick={handleReset} className="text-sm text-purple-700">אפס הכל</button>
        </div>

        {/* Price range */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">טווח מחיר (₪/חודש)</label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="מינימום"
              value={local.minPrice}
              onChange={(e) => set({ minPrice: e.target.value })}
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <input
              type="number"
              placeholder="מקסימום"
              value={local.maxPrice}
              onChange={(e) => set({ maxPrice: e.target.value })}
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Neighborhood */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">שכונה</label>
          <select
            value={local.neighborhood}
            onChange={(e) => set({ neighborhood: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">כל השכונות</option>
            {NEIGHBORHOODS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Listing type */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">סוג</label>
          <div className="flex gap-2">
            {typeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set({ listingType: opt.value })}
                className={`flex-1 py-2 text-sm rounded-xl border transition-colors ${
                  local.listingType === opt.value
                    ? 'bg-purple-700 text-white border-purple-700'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Rooms */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">מספר חדרים</label>
          <div className="flex gap-2">
            {roomOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set({ totalRooms: opt.value })}
                className={`flex-1 py-2 text-sm rounded-xl border transition-colors ${
                  local.totalRooms === opt.value
                    ? 'bg-purple-700 text-white border-purple-700'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Match profile toggle */}
        <div className="flex items-center justify-between mb-6 py-3 border-t border-gray-100">
          <div>
            <p className="text-sm font-medium text-gray-700">התאם לפרופיל שלי</p>
            <p className="text-xs text-gray-400 mt-0.5">הסתר מודעות שלא מתאימות למגדר/שנה שלך</p>
          </div>
          <button
            type="button"
            onClick={() => set({ matchMyProfile: !local.matchMyProfile })}
            className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${
              local.matchMyProfile ? 'bg-purple-700' : 'bg-gray-200'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                local.matchMyProfile ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        <button
          onClick={handleApply}
          className="w-full py-3 bg-purple-700 text-white text-sm font-medium rounded-xl hover:bg-purple-800 transition-colors"
        >
          הצג תוצאות
        </button>
      </div>
    </>
  )
}
