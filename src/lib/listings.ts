import { supabase } from './supabase'
import type { Listing } from '../types'

export const uploadListingImages = async (files: File[], listingId: string): Promise<string[]> => {
  const urls: string[] = []
  for (const file of files) {
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${listingId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('listing-images').upload(path, file)
    if (error) throw new Error(error.message)
    const { data } = supabase.storage.from('listing-images').getPublicUrl(path)
    urls.push(data.publicUrl)
  }
  return urls
}

// Beer Sheva city focus
export const CITY_CENTER: [number, number] = [34.7913, 31.2518] // [lng, lat]
export const CITY_BOUNDS = {
  lat: { min: 31.00, max: 31.50 },
  lng: { min: 34.55, max: 35.05 },
}

export const NEIGHBORHOODS = [
  'נווה זאב',
  'שכונה ד׳',
  'שכונה ג׳',
  'מרכז העיר',
  'גבעת המוסיאון',
  'רמות',
  'נאות לון',
  'רמת בגין',
  'פארק הנגב',
  'נחל בקע',
  'עומר',
  'להבים',
  'תל שבע',
]

export const fetchListings = async (): Promise<Listing[]> => {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('is_active', true)
    .gte('lat', CITY_BOUNDS.lat.min)
    .lte('lat', CITY_BOUNDS.lat.max)
    .gte('lng', CITY_BOUNDS.lng.min)
    .lte('lng', CITY_BOUNDS.lng.max)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Listing[]
}

export const formatHebrewDate = (isoDate: string): string => {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
