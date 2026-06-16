import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { uploadListingImages } from '../lib/listings'
import type { ListingType } from '../types'

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string
const MAX_IMAGES = 5

interface GeoResult {
  place_name: string
  center: [number, number] // [lng, lat]
  neighborhood: string     // auto-detected from context, '' if unknown
}

function detectNeighborhood(context: Array<{ id: string; text: string }> = []): string {
  const text = context.find(c => c.id.startsWith('neighborhood'))?.text ?? ''
  if (text.includes('שכונה ב')) return 'שכונה ב׳'
  if (text.includes('שכונה ג')) return 'שכונה ג׳'
  if (text.includes('שכונה ד')) return 'שכונה ד׳'
  if (text) return 'אחר'
  return ''
}

interface FormState {
  listingType: ListingType
  address: string
  lat: number | null
  lng: number | null
  price: string
  totalRooms: string
  floor: string
  neighborhood: string
  description: string
  availableFrom: string
  subletEnd: string
  restrictSex: '' | 'm' | 'f'
  restrictMinYear: string
}

const INITIAL: FormState = {
  listingType: 'full_lease',
  address: '',
  lat: null,
  lng: null,
  price: '',
  totalRooms: '',
  floor: '',
  neighborhood: '',
  description: '',
  availableFrom: '',
  subletEnd: '',
  restrictSex: '',
  restrictMinYear: '',
}

export default function CreateListingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [form, setForm] = useState<FormState>(INITIAL)
  const [images, setImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [geoResults, setGeoResults] = useState<GeoResult[]>([])
  const [geoLoading, setGeoLoading] = useState(false)
  const geoDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | 'images', string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Map
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<import('@maptiler/sdk').Map | null>(null)
  const markerRef = useRef<import('@maptiler/sdk').Marker | null>(null)

  // Init map when lat/lng are set
  useEffect(() => {
    if (!form.lat || !form.lng || !mapRef.current) return

    const init = async () => {
      const maptiler = await import('@maptiler/sdk')
      maptiler.config.apiKey = MAPTILER_KEY

      if (mapInstance.current) {
        mapInstance.current.setCenter([form.lng!, form.lat!])
        if (markerRef.current) markerRef.current.setLngLat([form.lng!, form.lat!])
        return
      }

      const map = new maptiler.Map({
        container: mapRef.current!,
        style: maptiler.MapStyle.STREETS,
        center: [form.lng!, form.lat!],
        zoom: 15,
      })

      map.on('load', () => {
        const marker = new maptiler.Marker({ color: '#7c3aed', draggable: true })
          .setLngLat([form.lng!, form.lat!])
          .addTo(map)

        marker.on('dragend', () => {
          const pos = marker.getLngLat()
          setForm(f => ({ ...f, lat: pos.lat, lng: pos.lng }))
        })

        markerRef.current = marker
      })

      mapInstance.current = map
    }

    init()
  }, [form.lat, form.lng])

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      mapInstance.current?.remove()
    }
  }, [])

  const set = (field: keyof FormState, value: string) => {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => ({ ...e, [field]: undefined }))
  }

  // Address geocoding
  const handleAddressChange = (value: string) => {
    set('address', value)
    if (geoDebounce.current) clearTimeout(geoDebounce.current)
    if (value.length < 3) { setGeoResults([]); return }
    geoDebounce.current = setTimeout(async () => {
      setGeoLoading(true)
      try {
        const res = await fetch(
          `https://api.maptiler.com/geocoding/${encodeURIComponent(value)}.json?key=${MAPTILER_KEY}&language=he&country=il&proximity=34.7913,31.2518&bbox=34.55,31.00,35.05,31.50`
        )
        const json = await res.json()
        setGeoResults((json.features ?? []).slice(0, 5).map((f: { place_name: string; center: [number, number]; context?: Array<{ id: string; text: string }> }) => ({
          place_name: f.place_name,
          center: f.center,
          neighborhood: detectNeighborhood(f.context),
        })))
      } catch {
        setGeoResults([])
      } finally {
        setGeoLoading(false)
      }
    }, 350)
  }

  const selectGeoResult = (r: GeoResult) => {
    setForm(f => ({ ...f, address: r.place_name, lat: r.center[1], lng: r.center[0], neighborhood: r.neighborhood }))
    setGeoResults([])
    setErrors(e => ({ ...e, address: undefined, lat: undefined }))
  }

  // Image dropzone
  const onDrop = useCallback((accepted: File[]) => {
    setImages(prev => {
      const next = [...prev, ...accepted].slice(0, MAX_IMAGES)
      setImagePreviews(next.map(f => URL.createObjectURL(f)))
      return next
    })
    setErrors(e => ({ ...e, images: undefined }))
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: MAX_IMAGES,
    disabled: images.length >= MAX_IMAGES,
  })

  const removeImage = (i: number) => {
    setImages(prev => {
      const next = prev.filter((_, idx) => idx !== i)
      setImagePreviews(next.map(f => URL.createObjectURL(f)))
      return next
    })
  }

  // Validation
  const validate = (): boolean => {
    const e: typeof errors = {}
    if (!form.address.trim()) e.address = 'יש להזין כתובת'
    if (form.lat == null) e.address = 'יש לבחור כתובת מהרשימה'
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0) e.price = 'מחיר לא תקין'
    if (!form.availableFrom) e.availableFrom = 'יש לבחור תאריך כניסה'
    if (form.listingType === 'sublet') {
      if (!form.subletEnd) e.subletEnd = 'יש לבחור תאריך סיום'
      else if (form.subletEnd <= form.availableFrom) e.subletEnd = 'תאריך סיום חייב להיות אחרי תאריך כניסה'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate() || !user) return
    setSubmitting(true)
    setSubmitError('')

    try {
      // Insert listing row first to get an ID for image paths
      const { data: row, error: insertErr } = await supabase
        .from('listings')
        .insert({
          owner_id: user.id,
          address: form.address.trim(),
          lat: form.lat,
          lng: form.lng,
          price_per_month: Number(form.price),
          total_rooms: form.totalRooms ? Number(form.totalRooms) : null,
          floor: form.floor ? Number(form.floor) : null,
          neighborhood: form.neighborhood || null,
          description: form.description.trim() || null,
          listing_type: form.listingType,
          available_from: form.availableFrom,
          sublet_end: form.listingType === 'sublet' ? form.subletEnd : null,
          restrictions: buildRestrictions(),
          image_urls: [],
          is_active: true,
        })
        .select('id')
        .single()

      if (insertErr || !row) throw new Error(insertErr?.message ?? 'שגיאה ביצירת מודעה')

      // Upload images if any
      if (images.length > 0) {
        const urls = await uploadListingImages(images, row.id)
        await supabase.from('listings').update({ image_urls: urls }).eq('id', row.id)
      }

      navigate(`/listing/${row.id}`, { replace: true })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'שגיאה בפרסום המודעה')
    } finally {
      setSubmitting(false)
    }
  }

  const buildRestrictions = () => {
    const r: { sex?: 'm' | 'f'; min_year?: number } = {}
    if (form.restrictSex) r.sex = form.restrictSex as 'm' | 'f'
    if (form.restrictMinYear) r.min_year = Number(form.restrictMinYear)
    return Object.keys(r).length ? r : null
  }

  return (
    <div className="pb-32">
      {/* Back header */}
      <div className="flex items-center px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 mr-2">
          <i className="ti ti-arrow-left text-xl text-gray-700" />
        </button>
        <span className="text-sm font-semibold text-gray-900">פרסום מודעה חדשה</span>
      </div>

      <div className="px-4 pt-4 space-y-6">

        {/* Listing type toggle */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">סוג מודעה</label>
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            {(['full_lease', 'sublet'] as ListingType[]).map(type => (
              <button
                key={type}
                onClick={() => set('listingType', type)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  form.listingType === type
                    ? 'bg-white text-purple-700 shadow-sm'
                    : 'text-gray-500'
                }`}
              >
                {type === 'full_lease' ? 'שכירות מלאה' : 'סאבלט'}
              </button>
            ))}
          </div>
        </div>

        {/* Address */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">כתובת *</label>
          <div className="relative">
            <input
              type="text"
              value={form.address}
              onChange={e => handleAddressChange(e.target.value)}
              placeholder="הזן כתובת..."
              className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${errors.address ? 'border-red-400' : 'border-gray-200'}`}
            />
            {geoLoading && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
              </div>
            )}
          </div>
          {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}

          {/* Autocomplete dropdown */}
          {geoResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
              {geoResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => selectGeoResult(r)}
                  className="w-full text-right px-3 py-2.5 text-sm text-gray-800 hover:bg-purple-50 flex items-center gap-2 border-b border-gray-100 last:border-0"
                >
                  <i className="ti ti-map-pin text-purple-500 shrink-0" />
                  <span className="truncate">{r.place_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Map preview */}
        {form.lat != null && (
          <div>
            <p className="text-xs text-gray-500 mb-1.5">גרור את הסיכה לכוונון מדויק</p>
            <div
              ref={mapRef}
              className="w-full h-48 rounded-xl overflow-hidden border border-gray-200"
            />
          </div>
        )}

        {/* Price */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">מחיר לחודש (₪) *</label>
          <input
            type="number"
            inputMode="numeric"
            value={form.price}
            onChange={e => set('price', e.target.value)}
            placeholder="3500"
            className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${errors.price ? 'border-red-400' : 'border-gray-200'}`}
          />
          {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price}</p>}
        </div>

        {/* Rooms + Floor */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">מספר חדרים</label>
            <input
              type="number"
              inputMode="numeric"
              value={form.totalRooms}
              onChange={e => set('totalRooms', e.target.value)}
              placeholder="3"
              min="1"
              max="20"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">קומה</label>
            <input
              type="number"
              inputMode="numeric"
              value={form.floor}
              onChange={e => set('floor', e.target.value)}
              placeholder="2"
              min="0"
              max="50"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Neighborhood — auto-detected from address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">שכונה</label>
          <div className="px-3 py-2.5 border border-gray-100 rounded-xl bg-gray-50 text-sm text-gray-400 select-none">
            {form.neighborhood || 'תיקבע אוטומטית לפי הכתובת'}
          </div>
        </div>

        {/* Dates */}
        <div className={`${form.listingType === 'sublet' ? 'flex gap-3' : ''}`}>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {form.listingType === 'full_lease' ? 'כניסה מתאריך *' : 'מתאריך *'}
            </label>
            <input
              type="date"
              value={form.availableFrom}
              onChange={e => set('availableFrom', e.target.value)}
              className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${errors.availableFrom ? 'border-red-400' : 'border-gray-200'}`}
            />
            {errors.availableFrom && <p className="text-xs text-red-500 mt-1">{errors.availableFrom}</p>}
          </div>

          {form.listingType === 'sublet' && (
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">עד תאריך *</label>
              <input
                type="date"
                value={form.subletEnd}
                min={form.availableFrom || undefined}
                onChange={e => set('subletEnd', e.target.value)}
                className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${errors.subletEnd ? 'border-red-400' : 'border-gray-200'}`}
              />
              {errors.subletEnd && <p className="text-xs text-red-500 mt-1">{errors.subletEnd}</p>}
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">תיאור</label>
          <textarea
            value={form.description}
            onChange={e => set('description', e.target.value)}
            rows={4}
            placeholder="ספר/י על הדירה, השכנים, הסביבה..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Restrictions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">הגבלות (אופציונלי)</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {(['', 'f', 'm'] as const).map(val => (
              <button
                key={val}
                onClick={() => set('restrictSex', val)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  form.restrictSex === val
                    ? 'bg-purple-700 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {val === '' ? 'ללא הגבלת מגדר' : val === 'f' ? 'נשים בלבד' : 'גברים בלבד'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 shrink-0">שנה מינימלית:</label>
            <select
              value={form.restrictMinYear}
              onChange={e => set('restrictMinYear', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
            >
              <option value="">ללא הגבלה</option>
              {[1, 2, 3, 4].map(y => <option key={y} value={y}>שנה {y}+</option>)}
            </select>
          </div>
        </div>

        {/* Image upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            תמונות ({images.length}/{MAX_IMAGES})
          </label>
          {imagePreviews.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-2">
              {imagePreviews.map((src, i) => (
                <div key={i} className="relative shrink-0">
                  <img src={src} className="w-24 h-24 object-cover rounded-xl" alt="" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-900 text-white rounded-full flex items-center justify-center"
                  >
                    <i className="ti ti-x text-xs" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {images.length < MAX_IMAGES && (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-purple-400 bg-purple-50' : 'border-gray-200 hover:border-purple-300'
              }`}
            >
              <input {...getInputProps()} />
              <i className="ti ti-photo-plus text-2xl text-gray-400 mb-1" />
              <p className="text-sm text-gray-500">
                {isDragActive ? 'שחרר כאן...' : 'גרור תמונות או לחץ להעלאה'}
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Fixed submit */}
      <div className="fixed bottom-16 inset-x-0 bg-white border-t border-gray-100 px-4 py-3 z-20">
        {submitError && <p className="text-xs text-red-500 mb-2 text-center">{submitError}</p>}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 bg-purple-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 hover:bg-purple-800 transition-colors"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              מפרסם...
            </span>
          ) : (
            'פרסם מודעה'
          )}
        </button>
      </div>
    </div>
  )
}
