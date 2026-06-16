import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useListings } from '../hooks/useListings'
import { ListingList } from '../components/rooms/ListingList'
import { MapView } from '../components/rooms/MapView'
import { FilterPanel } from '../components/rooms/FilterPanel'
import { FilterPills } from '../components/rooms/FilterPills'

type View = 'list' | 'map'

export default function RoomsPage() {
  const navigate = useNavigate()
  const [view, setView] = useState<View>('map')
  const [showFilters, setShowFilters] = useState(false)
  const { listings, allListings, loading, error, filters, setFilters, clearFilter } = useListings()

  const activeFilterCount = Object.entries(filters).filter(([k, v]) =>
    k === 'matchMyProfile' ? v === true : v !== null
  ).length

  const filtersActive = activeFilterCount > 0

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem-4rem)]">
      {/* Filter bar */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full shrink-0"
          >
            <i className="ti ti-adjustments-horizontal text-sm" />
            <span>סינון</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-purple-700 text-white text-[10px] flex items-center justify-center leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>

          <div className="flex-1 overflow-x-auto min-w-0">
            <FilterPills filters={filters} onRemove={clearFilter} />
          </div>

          <div className="flex gap-0.5 shrink-0 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setView('list')}
              title="רשימה"
              className={`p-1.5 rounded-md transition-colors ${view === 'list' ? 'bg-white shadow-sm text-purple-700' : 'text-gray-400'}`}
            >
              <i className="ti ti-list text-sm" />
            </button>
            <button
              onClick={() => setView('map')}
              title="מפה"
              className={`p-1.5 rounded-md transition-colors ${view === 'map' ? 'bg-white shadow-sm text-purple-700' : 'text-gray-400'}`}
            >
              <i className="ti ti-map text-sm" />
            </button>
          </div>
        </div>
      </div>

      {/* Content — no scroll for map so it fills height exactly */}
      <div className={`flex-1 ${view === 'map' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {view === 'list' ? (
          <ListingList listings={listings} loading={loading} />
        ) : (
          <MapView
            listings={listings}
            allListings={allListings}
            filtersActive={filtersActive}
          />
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="shrink-0 px-4 py-2 bg-red-50 text-sm text-red-600 border-t border-red-100">
          {error}
        </div>
      )}

      {/* Add listing FAB — hidden in map view to avoid overlap with locate button */}
      {view === 'list' && (
        <button
          onClick={() => navigate('/listing/new')}
          className="fixed bottom-20 right-4 w-12 h-12 rounded-full bg-purple-700 text-white shadow-lg flex items-center justify-center hover:bg-purple-800 active:scale-95 transition-all z-30"
          title="מודעה חדשה"
        >
          <i className="ti ti-plus text-xl" />
        </button>
      )}

      {showFilters && (
        <FilterPanel
          filters={filters}
          onApply={setFilters}
          onClose={() => setShowFilters(false)}
        />
      )}
    </div>
  )
}
