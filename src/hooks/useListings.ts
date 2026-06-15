import { useEffect, useMemo, useState } from 'react'
import { useAuth } from './useAuth'
import { fetchListings } from '../lib/listings'
import { supabase } from '../lib/supabase'
import type { Listing, ListingType, User } from '../types'

export interface Filters {
  minPrice: number | null
  maxPrice: number | null
  neighborhood: string | null
  listingType: ListingType | null
  totalRooms: number | null  // 4 means "4 or more"
  matchMyProfile: boolean
}

export const DEFAULT_FILTERS: Filters = {
  minPrice: null,
  maxPrice: null,
  neighborhood: null,
  listingType: null,
  totalRooms: null,
  matchMyProfile: false,
}

function applyFilters(listings: Listing[], filters: Filters, profile: User | null): Listing[] {
  return listings.filter((l) => {
    if (filters.minPrice !== null && l.price_per_month < filters.minPrice) return false
    if (filters.maxPrice !== null && l.price_per_month > filters.maxPrice) return false
    if (filters.neighborhood && l.neighborhood !== filters.neighborhood) return false
    if (filters.listingType && l.listing_type !== filters.listingType) return false
    if (filters.totalRooms !== null) {
      if (l.total_rooms === null) return false
      if (filters.totalRooms === 4 ? l.total_rooms < 4 : l.total_rooms !== filters.totalRooms) return false
    }
    if (filters.matchMyProfile && profile) {
      if (l.restrictions?.sex && profile.sex && l.restrictions.sex !== profile.sex) return false
      if (l.restrictions?.min_year && profile.year_of_study &&
          profile.year_of_study < l.restrictions.min_year) return false
    }
    return true
  })
}

export function useListings() {
  const { user } = useAuth()
  const [allListings, setAllListings] = useState<Listing[]>([])
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)

  useEffect(() => {
    fetchListings()
      .then(setAllListings)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!user) return
    supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data }) => { if (data) setProfile(data as User) })
  }, [user])

  const listings = useMemo(
    () => applyFilters(allListings, filters, profile),
    [allListings, filters, profile]
  )

  const clearFilter = (key: keyof Filters) =>
    setFilters((prev) => ({ ...prev, [key]: key === 'matchMyProfile' ? false : null }))

  const resetFilters = () => setFilters(DEFAULT_FILTERS)

  return { listings, allListings, loading, error, filters, setFilters, clearFilter, resetFilters }
}
