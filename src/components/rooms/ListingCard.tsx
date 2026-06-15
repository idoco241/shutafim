import { useNavigate } from 'react-router-dom'
import type { Listing } from '../../types'
import { formatHebrewDate } from '../../lib/listings'

interface Props {
  listing: Listing
}

export function ListingCard({ listing }: Props) {
  const navigate = useNavigate()

  const dateText =
    listing.listing_type === 'full_lease'
      ? `כניסה: ${formatHebrewDate(listing.available_from)}`
      : `${formatHebrewDate(listing.available_from)} – ${formatHebrewDate(listing.sublet_end!)}`

  return (
    <div
      onClick={() => navigate(`/listing/${listing.id}`)}
      className="bg-white rounded-2xl overflow-hidden shadow-sm active:scale-[0.99] transition-transform cursor-pointer"
    >
      {/* Image */}
      <div className="aspect-video bg-gray-100 overflow-hidden">
        {listing.image_urls?.[0] ? (
          <img
            src={listing.image_urls[0]}
            alt={listing.address}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <i className="ti ti-building text-4xl text-gray-300" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Address + price */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{listing.address}</p>
            {listing.neighborhood && (
              <p className="text-xs text-gray-500">{listing.neighborhood}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <span className="text-base font-semibold text-gray-900">
              ₪{listing.price_per_month.toLocaleString()}
            </span>
            <span className="text-xs text-gray-400">/חו׳</span>
          </div>
        </div>

        {listing.total_rooms && (
          <p className="text-xs text-gray-400 mb-2">{listing.total_rooms} חדרים</p>
        )}

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {listing.listing_type === 'full_lease' ? (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
              שכירות מלאה
            </span>
          ) : (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
              סאבלט
            </span>
          )}
          {listing.restrictions?.sex === 'f' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-pink-50 text-pink-600">נשים בלבד</span>
          )}
          {listing.restrictions?.sex === 'm' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">גברים בלבד</span>
          )}
          {listing.restrictions?.min_year && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              שנה {listing.restrictions.min_year}+
            </span>
          )}
        </div>

        {/* Date */}
        <p className="text-xs text-gray-400">{dateText}</p>
      </div>
    </div>
  )
}
