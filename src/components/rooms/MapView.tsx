import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Listing } from '../../types'
import { formatHebrewDate, CITY_CENTER } from '../../lib/listings'

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string
const INIT_ZOOM = 14

interface Props {
  listings: Listing[]      // currently filtered (shown as active/purple)
  allListings: Listing[]   // every listing (to show gray pins for non-matches)
  filtersActive: boolean
}

function buildGeoJSON(all: Listing[], filtered: Listing[], filtersActive: boolean) {
  const filteredIds = new Set(filtered.map(l => l.id))
  return {
    type: 'FeatureCollection' as const,
    features: all.map(l => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [l.lng, l.lat] },
      properties: {
        id: l.id,
        isMatch: !filtersActive || filteredIds.has(l.id),
      },
    })),
  }
}

export function MapView({ listings, allListings, filtersActive }: Props) {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const geoJSONRef = useRef(buildGeoJSON(allListings, listings, filtersActive))
  const allListingsRef = useRef(allListings)
  const [selected, setSelected] = useState<Listing | null>(null)
  const [locating, setLocating] = useState(false)

  // Keep refs fresh every render
  allListingsRef.current = allListings

  // Update GeoJSON ref and push to source whenever inputs change
  useEffect(() => {
    geoJSONRef.current = buildGeoJSON(allListings, listings, filtersActive)
    const source = mapRef.current?.getSource('listings')
    source?.setData(geoJSONRef.current)
  }, [allListings, listings, filtersActive])

  // Init map once on mount
  useEffect(() => {
    if (!containerRef.current) return

    let cancelled = false

    const init = async () => {
      const sdk = await import('@maptiler/sdk')
      if (cancelled) return

      sdk.config.apiKey = MAPTILER_KEY

      const map = new sdk.Map({
        container: containerRef.current!,
        style: sdk.MapStyle.STREETS,
        center: CITY_CENTER,
        zoom: INIT_ZOOM,
      })

      map.on('load', () => {
        if (cancelled) return

        map.addSource('listings', {
          type: 'geojson',
          data: geoJSONRef.current,
          cluster: true,
          clusterMaxZoom: 13,
          clusterRadius: 40,
        })

        // Cluster bubbles
        map.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'listings',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#7c3aed',
            'circle-radius': ['step', ['get', 'point_count'], 18, 10, 26, 50, 34],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        })

        // Cluster count label
        map.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'listings',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 12,
          },
          paint: { 'text-color': '#ffffff' },
        })

        // Individual pins — purple for matches, gray for non-matches
        map.addLayer({
          id: 'pins',
          type: 'circle',
          source: 'listings',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': ['case', ['==', ['get', 'isMatch'], true], '#7c3aed', '#d1d5db'],
            'circle-radius': ['case', ['==', ['get', 'isMatch'], true], 12, 9],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        })

        // Click cluster → zoom in
        map.on('click', 'clusters', (e: any) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })
          if (!features.length) return
          const clusterId = features[0].properties!.cluster_id
          const coords = (features[0].geometry as any).coordinates as [number, number]
          const source = map.getSource('listings') as any
          source.getClusterExpansionZoom(clusterId).then((zoom: number) => {
            map.easeTo({ center: coords, zoom: zoom + 1 })
          })
        })

        // Click pin → show bottom sheet
        map.on('click', 'pins', (e: any) => {
          const id = e.features?.[0]?.properties?.id
          if (!id) return
          const listing = allListingsRef.current.find(l => l.id === id) ?? null
          setSelected(listing)
        })

        map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = '' })
        map.on('mouseenter', 'pins', () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', 'pins', () => { map.getCanvas().style.cursor = '' })
      })

      mapRef.current = map
    }

    init()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  const handleLocate = () => {
    if (!navigator.geolocation || !mapRef.current) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        mapRef.current.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 14,
          duration: 1200,
        })
        setLocating(false)
      },
      () => setLocating(false),
      { timeout: 8000 }
    )
  }

  return (
    <div className="relative w-full h-full">
      {/* Map canvas */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Locate-me button */}
      <button
        onClick={handleLocate}
        className="absolute top-3 left-3 w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center z-10 active:scale-95 transition-transform"
        title="מקם אותי"
      >
        {locating
          ? <span className="w-4 h-4 rounded-full border-2 border-purple-600 border-t-transparent animate-spin" />
          : <i className="ti ti-current-location text-lg text-gray-700" />
        }
      </button>

      {/* Bottom sheet overlay — closes sheet when tapping the map */}
      {selected && (
        <div
          className="absolute inset-0 z-20"
          onClick={() => setSelected(null)}
        />
      )}

      {/* Listing bottom sheet */}
      {selected && (
        <div
          className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl z-30 p-4 shadow-xl"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex gap-3">
            {selected.image_urls?.[0] ? (
              <img
                src={selected.image_urls[0]}
                className="w-20 h-20 rounded-xl object-cover shrink-0"
                alt=""
              />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                <i className="ti ti-building text-2xl text-gray-300" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5 mb-0.5">
                <span className="text-base font-bold text-gray-900">
                  ₪{selected.price_per_month.toLocaleString()}
                </span>
                <span className="text-xs text-gray-400">/חודש</span>
              </div>
              <p className="text-sm text-gray-700 truncate">{selected.address}</p>
              {selected.neighborhood && (
                <p className="text-xs text-gray-500 mb-1">{selected.neighborhood}</p>
              )}
              <div className="flex gap-1.5 flex-wrap mt-1">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  selected.listing_type === 'full_lease'
                    ? 'bg-purple-50 text-purple-700'
                    : 'bg-amber-50 text-amber-700'
                }`}>
                  {selected.listing_type === 'full_lease' ? 'שכירות מלאה' : 'סאבלט'}
                </span>
                <span className="text-xs text-gray-400">
                  כניסה {formatHebrewDate(selected.available_from)}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate(`/listing/${selected.id}`)}
            className="mt-3 w-full py-2.5 bg-purple-700 text-white text-sm font-semibold rounded-xl hover:bg-purple-800 active:scale-[0.98] transition-all"
          >
            לפרטים המלאים
          </button>
        </div>
      )}
    </div>
  )
}
