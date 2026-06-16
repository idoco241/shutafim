import type { Listing } from '../../types'
import { ListingCard } from './ListingCard'

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm animate-pulse">
      <div className="aspect-video bg-gray-200" />
      <div className="p-3 space-y-2">
        <div className="h-5 bg-gray-200 rounded-lg w-1/3" />
        <div className="h-4 bg-gray-200 rounded-lg w-2/3" />
        <div className="flex gap-2 pt-1">
          <div className="h-5 bg-gray-200 rounded-full w-16" />
          <div className="h-5 bg-gray-200 rounded-full w-20" />
        </div>
      </div>
    </div>
  )
}

interface Props {
  listings: Listing[]
  loading: boolean
}

export function ListingList({ listings, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 p-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
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
