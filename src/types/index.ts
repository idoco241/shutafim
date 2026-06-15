export type ListingType = 'full_lease' | 'sublet'
export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'denied_closed'
export type NotificationType =
  | 'application'
  | 'accepted'
  | 'rejected'
  | 'group_message'
  | 'message'
  | 'listing_closed'
export type Sex = 'm' | 'f' | 'other'

export interface User {
  id: string
  name: string
  age: number | null
  sex: Sex | null
  field_of_study: string | null
  year_of_study: number | null
  bio: string | null
  avatar_url: string | null
  created_at: string
}

export interface Restrictions {
  sex?: 'm' | 'f'
  min_year?: number
}

export interface Listing {
  id: string
  owner_id: string
  address: string
  floor: number | null
  neighborhood: string | null
  lat: number
  lng: number
  price_per_month: number
  total_rooms: number | null
  description: string | null
  listing_type: ListingType
  available_from: string
  sublet_end: string | null
  restrictions: Restrictions | null
  image_urls: string[] | null
  is_active: boolean
  created_at: string
}

export interface Conversation {
  id: string
  listing_id: string | null
  user_a: string
  user_b: string
  created_at: string
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  is_read: boolean
  created_at: string
}

export interface Application {
  id: string
  listing_id: string
  applicant_id: string
  conversation_id: string | null
  status: ApplicationStatus
  created_at: string
}

export interface GroupMessage {
  id: string
  listing_id: string
  sender_id: string
  content: string
  created_at: string
}

export interface NotificationPayload {
  listing_id?: string
  from_user_id?: string
  conversation_id?: string
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  payload: NotificationPayload
  is_read: boolean
  created_at: string
}
