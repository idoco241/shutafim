import type { Filters } from '../../hooks/useListings'

interface Props {
  filters: Filters
  onRemove: (key: keyof Filters) => void
}

interface Pill {
  key: keyof Filters
  label: string
}

export function FilterPills({ filters, onRemove }: Props) {
  const pills: Pill[] = []

  if (filters.minPrice !== null)
    pills.push({ key: 'minPrice', label: `מ-₪${filters.minPrice.toLocaleString()}` })
  if (filters.maxPrice !== null)
    pills.push({ key: 'maxPrice', label: `עד ₪${filters.maxPrice.toLocaleString()}` })
  if (filters.neighborhood)
    pills.push({ key: 'neighborhood', label: filters.neighborhood })
  if (filters.listingType)
    pills.push({ key: 'listingType', label: filters.listingType === 'full_lease' ? 'שכירות מלאה' : 'סאבלט' })
  if (filters.totalRooms !== null)
    pills.push({ key: 'totalRooms', label: filters.totalRooms === 4 ? '4+ חדרים' : `${filters.totalRooms} חדרים` })
  if (filters.matchMyProfile)
    pills.push({ key: 'matchMyProfile', label: 'מתאים לפרופיל שלי' })

  if (pills.length === 0) return null

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide py-0.5">
      {pills.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onRemove(key)}
          className="flex items-center gap-1 whitespace-nowrap text-xs font-medium px-3 py-1 rounded-full bg-purple-50 text-purple-700 shrink-0"
        >
          {label}
          <i className="ti ti-x text-[10px]" />
        </button>
      ))}
    </div>
  )
}
