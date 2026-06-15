import type { Listing } from '../../types'
import { ListingCard } from './ListingCard'

interface Props {
  listings: Listing[]
  loading: boolean
}

export function ListingList({ listings, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 rounded-full border-2 border-purple-700 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (listings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 px-8">
        <i className="ti ti-building-off text-4xl text-gray-300 mb-3" />
        <p className="text-sm text-gray-500 text-center">
          לא נמצאו מודעות התואמות את הסינון שלך
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 p-4">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  )
}
