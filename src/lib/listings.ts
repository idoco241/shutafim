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

export const NEIGHBORHOODS = [
  'רמת גן',
  'פתח תקווה',
  'בני ברק',
  'גבעתיים',
  'אור יהודה',
  'קרית אונו',
  'ראש העין',
  'תל אביב יפו',
  'חולון',
  'בת ים',
  'כפר סבא',
  'הרצליה',
  'רעננה',
]

export const fetchListings = async (): Promise<Listing[]> => {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('is_active', true)
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
