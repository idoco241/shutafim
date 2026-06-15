# Shutafim — Claude Code Project Context

> Read this file at the start of every session before writing any code.
> This is the single source of truth for architecture, schema, and build order.

---

## What we are building

A serverless web app called **Shutafim (שותפים)** for university students to find rooms and roommates near campus.
The app has two live pages in v1 and two "coming soon" stubs.

**Live in v1:**
- Rooms page — map view + list view of available room/apartment listings with filters
- Chat page — real-time messaging between students (triggered by applying to a room)

**Coming soon stubs (visible but not functional):**
- Marketplace — buy/sell furniture
- Roommate finder — student profiles for finding roommates

The app is in Hebrew/Israeli context. Addresses are Israeli. MapTiler handles Hebrew RTL rendering natively — no extra plugin needed.

---

## Tech stack

| Layer | Tool | Notes |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript | Use functional components and hooks only |
| Styling | Tailwind CSS | Mobile-first, no extra component libraries |
| Routing | React Router v6 | 4 routes: /rooms, /chat, /marketplace, /roommates |
| Map | MapLibre GL JS + @maptiler/sdk | Free tier, Hebrew RTL built-in, same API as Mapbox |
| Map tiles | MapTiler (streets-v2 style) | Key stored in VITE_MAPTILER_KEY env var |
| Geocoding | MapTiler Geocoding API | Address search for listing creation |
| Backend | Supabase | DB + Auth + Storage + Realtime — no custom server |
| Database | PostgreSQL via Supabase | Row Level Security enabled on all tables |
| Auth | Supabase Auth | Email + password. Magic link optional |
| File storage | Supabase Storage | Bucket: listing-images (public read, auth write) |
| Hosting | Vercel | Auto-deploy from GitHub. All env vars set in Vercel dashboard |
| Serverless fns | Vercel (if needed) | Only for logic Supabase cannot handle directly |

**This is a fully serverless app. There is no Express server, no Node backend, no custom API server.
All backend logic runs through Supabase's auto-generated REST API, Realtime subscriptions, and RLS policies.**

---

## Environment variables

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_MAPTILER_KEY=your_maptiler_api_key
```

Never hardcode these. Always read from `import.meta.env.VITE_*`.

---

## Database schema (Phase 1 only — do not create tables not listed here)

### `users`
```sql
id            uuid PRIMARY KEY  -- must match Supabase Auth uid exactly
name          text NOT NULL
age           int
sex           text              -- 'm' | 'f' | 'other'
field_of_study text
year_of_study  int              -- 1–6
bio           text              -- nullable, used in Phase 2
avatar_url    text              -- nullable
created_at    timestamp DEFAULT now()
```
RLS: users can read all rows, update/delete only their own row.

---

### `listings`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
owner_id        uuid REFERENCES users(id) NOT NULL
address         text NOT NULL
floor           int
neighborhood    text
lat             float8 NOT NULL
lng             float8 NOT NULL
price_per_month int NOT NULL
total_rooms     int
description     text
listing_type    text NOT NULL DEFAULT 'full_lease'  -- 'full_lease' | 'sublet'
available_from  date NOT NULL  -- entry date for full_lease; equals sublet_start for sublet
sublet_end      date           -- required when listing_type = 'sublet'
restrictions    jsonb          -- e.g. {"sex":"f","min_year":3}
image_urls      text[]         -- array of Supabase Storage URLs
is_active       boolean DEFAULT true
created_at      timestamp DEFAULT now()
```
RLS: all authenticated users can read active listings. Only owner can insert/update/delete their own listings.

**listing_type rules:**
- `full_lease` — standard year-long lease. `available_from` is required (the date the tenant can move in). `sublet_end` must be null.
- `sublet` — short-term sublet. `available_from` is the sublet start date (required). `sublet_end` is required and must be a valid date with `sublet_end > available_from`.
- Enforce this in the create listing form with client-side validation before submitting.

---

### `conversations`
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
listing_id  uuid REFERENCES listings(id)   -- nullable (for future DMs)
user_a      uuid REFERENCES users(id) NOT NULL
user_b      uuid REFERENCES users(id) NOT NULL
created_at  timestamp DEFAULT now()
```
RLS: a user can only read conversations where they are user_a or user_b.
Add a unique constraint on (user_a, user_b, listing_id) to prevent duplicate threads.

---

### `messages`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
conversation_id uuid REFERENCES conversations(id) NOT NULL
sender_id       uuid REFERENCES users(id) NOT NULL
content         text NOT NULL
is_read         boolean DEFAULT false
created_at      timestamp DEFAULT now()
```
RLS: a user can only read messages in conversations they belong to. A user can only insert messages where sender_id = their own uid.
Enable Realtime on this table in the Supabase dashboard.

---

### `applications`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
listing_id      uuid REFERENCES listings(id) NOT NULL
applicant_id    uuid REFERENCES users(id) NOT NULL
conversation_id uuid REFERENCES conversations(id)  -- 1-on-1 thread with listing owner
status          text DEFAULT 'pending'  -- 'pending' | 'accepted' | 'rejected' | 'denied_closed'
created_at      timestamp DEFAULT now()
```
RLS: listing owner and applicant can both read. Only applicant can insert. Only listing owner can update status.

**Status meanings:**
- `pending` — applied, awaiting owner review
- `accepted` — owner accepted for viewing/interview. Applicant is notified.
- `rejected` — owner rejected before listing closed. Applicant is notified.
- `denied_closed` — listing was closed and this applicant did not get the room. Applicant is notified automatically when listing closes.

---

### `group_messages`
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
listing_id  uuid REFERENCES listings(id) NOT NULL  -- group broadcast is scoped per listing
sender_id   uuid REFERENCES users(id) NOT NULL
content     text NOT NULL
created_at  timestamp DEFAULT now()
```
RLS: a user can read if they have an accepted application for that listing_id, or are the listing owner. A user can only insert if sender_id = their own uid AND they are the owner of the listing (only the owner can broadcast to the group).
Enable Realtime on this table in the Supabase dashboard.

There is no separate group-conversation table — the group thread is implicit per listing.

---

### `notifications`
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id     uuid REFERENCES users(id) NOT NULL   -- recipient
type        text NOT NULL
            -- 'application'       → owner: someone applied to your listing
            -- 'accepted'          → applicant: you were accepted for viewing
            -- 'rejected'          → applicant: your application was rejected
            -- 'group_message'     → accepted applicant: owner sent a group broadcast
            -- 'message'           → any party: new 1-on-1 message
            -- 'listing_closed'    → denied applicant: listing is closed, you didn't get the room
payload     jsonb
            -- { listing_id, from_user_id, conversation_id? }
is_read     boolean DEFAULT false
created_at  timestamp DEFAULT now()
```
RLS: users can only read their own notifications. Insert allowed for authenticated users (triggered by app logic, not user directly).

---

## Apply flow — critical logic (implement exactly as described)

When a user taps "Apply for this room" on a listing:

1. Check if a conversation between current user and listing owner already exists for this listing. If yes, open that conversation instead of creating a new one.
2. Insert a row into `conversations` (user_a = applicant, user_b = listing owner, listing_id = listing id).
3. Insert a row into `applications` (status = 'pending', conversation_id = the new conversation id).
4. Insert the first message into `messages`: sender_id = applicant, content = "היי! ראיתי את המודעה שלך ואני מעוניין/ת. אשמח לשמוע עוד פרטים." (or the applicant can write a custom intro message).
5. Insert a row into `notifications` for the listing owner: type = 'application', payload = { listing_id, from_user_id: applicant id, conversation_id }.
6. Navigate the applicant to the chat page, opening this conversation.

All steps must happen in a single async function. If any step fails, show an error toast and do not partially complete the flow.

---

## Owner application management — critical logic

The listing owner has a dedicated **"Manage applicants"** view, accessible from their own listing detail page and from the chat page. This is only visible to the owner of the listing.

### Applicants panel

The owner sees a list of all applicants for their listing, each showing:
- Applicant name, year, field of study, sex
- Current status badge: `pending` | `accepted` | `rejected`
- Two action buttons per pending applicant: **Accept** and **Reject**
- For accepted applicants: a **"Message privately"** button that opens the existing 1-on-1 conversation thread

### Accept flow

When the owner taps **Accept** on a pending applicant:
1. Update `applications.status` to `'accepted'` for that applicant id + listing id.
2. Insert a `notifications` row for the applicant: type = `'accepted'`, payload = { listing_id, from_user_id: owner id }.
3. The accepted applicant now has read access to the listing's group messages (via RLS on their accepted application status — no separate row needs to be created).
4. Show a success toast to the owner: "התקבל/ה לצפייה בדירה".

The applicant receives a notification: **"התקבלת לצפייה! בעל הדירה יצור קשר עם פרטים."**

### Reject flow

When the owner taps **Reject** on a pending applicant:
1. Update `applications.status` to `'rejected'`.
2. Insert a `notifications` row for the applicant: type = `'rejected'`, payload = { listing_id }.
3. The applicant's 1-on-1 conversation thread remains accessible — they can still message the owner.

The applicant receives a notification: **"בקשתך לדירה ב[address] לא התקבלה הפעם."**

### Group broadcast (owner → all accepted applicants)

Once at least one applicant is accepted, the owner sees a **"Send to group"** button in the applicants panel.

Tapping it opens a message composer. The owner types a message (e.g. viewing time and address) and sends it.

On send:
1. Insert a row into `group_messages` (listing_id, sender_id = owner, content).
2. Insert a `notifications` row for **every accepted applicant** of this listing: type = `'group_message'`, payload = { listing_id }.

Accepted applicants see group messages in a dedicated **"Group" tab** within the chat page for that listing. The group tab is read-only for applicants — only the owner can send to the group. Applicants reply via their individual 1-on-1 thread.

Group messages use the same Realtime subscription pattern as regular messages, subscribed to the `group_messages` table filtered by `listing_id`.

### Close listing flow

The owner can close a listing from their listing detail page via a **"Close listing"** button. This marks the listing as filled and triggers denial notifications for all remaining non-accepted applicants.

When the owner taps **"Close listing"**:
1. Show a confirmation dialog: "האם אתה בטוח? פעולה זו תסגור את המודעה ותודיע לכל המועמדים שלא התקבלו."
2. On confirm:
   a. Update `listings.is_active` to `false`.
   b. Fetch all applications for this listing where status = `'pending'` or `'rejected'`.
   c. For each of those applicants, update status to `'denied_closed'`.
   d. For each of those applicants, insert a `notifications` row: type = `'listing_closed'`, payload = { listing_id }.
   e. Applications with status = `'accepted'` are left as-is — those applicants got the room.
3. The listing disappears from the public rooms map and list (filtered by `is_active = true`).
4. Navigate the owner back to their profile/my listings page.

Denied applicants receive a notification: **"המודעה ב[address] נסגרה. בהצלחה בחיפוש!"**

All steps in the close listing flow must complete atomically. If any insert/update fails, roll back by re-setting `is_active = true` and show an error toast.

---

## Real-time chat — implementation pattern

Use Supabase Realtime to subscribe to new messages. Do NOT use polling.

**1-on-1 conversation subscription:**
```typescript
const channel = supabase
  .channel(`conversation-${conversationId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`,
    },
    (payload) => {
      setMessages((prev) => [...prev, payload.new as Message])
    }
  )
  .subscribe()

return () => { supabase.removeChannel(channel) }
```

**Group conversation subscription (accepted applicants + owner):**
```typescript
const groupChannel = supabase
  .channel(`group-${listingId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'group_messages',
      filter: `listing_id=eq.${listingId}`,
    },
    (payload) => {
      setGroupMessages((prev) => [...prev, payload.new as GroupMessage])
    }
  )
  .subscribe()

return () => { supabase.removeChannel(groupChannel) }
```

Mark 1-on-1 messages as read when the conversation is opened: update `is_read = true` for all messages in the conversation where `sender_id != current user`. Group messages do not have a per-user read state in v1.

---

## Filtering logic for listings

Filters live in React state. Apply them client-side after fetching all active listings from Supabase. Do not build server-side filtered queries for v1 — the dataset is small enough.

Filter fields:
- `price_per_month` — between min and max (user sets a range)
- `neighborhood` — exact match from a predefined list
- `listing_type` — 'full_lease' | 'sublet' | both (default: both shown)
- `restrictions.sex` — match if restriction is null, or if restriction matches user's sex, or if restriction is 'mixed'
- `restrictions.min_year` — match if null, or if user's year_of_study >= min_year
- `total_rooms` — optional filter by number of rooms

Active filters show as removable pills below the search bar.

---

## Map implementation

Use `@maptiler/sdk` (not raw maplibre-gl) for simpler setup and built-in Hebrew support.

```typescript
import * as maptilersdk from '@maptiler/sdk'
import '@maptiler/sdk/dist/maptiler-sdk.css'

maptilersdk.config.apiKey = import.meta.env.VITE_MAPTILER_KEY

const map = new maptilersdk.Map({
  container: mapContainerRef.current,
  style: maptilersdk.MapStyle.STREETS,
  center: [34.8516, 32.1133], // Petah Tikva / Bar-Ilan area
  zoom: 13,
})
```

- Add a marker for each active listing. Marker color: purple (#534AB7) for standard, red (#E24B4A) for listings matching active filters.
- Clicking a marker opens a bottom sheet with listing summary and a "View listing" button.
- Enable pin clustering using MapLibre's built-in cluster source when there are more than 10 listings visible.
- Add a "locate me" button (bottom-right) using `navigator.geolocation.getCurrentPosition`.

---

## Page structure and routing

```
/                 → redirect to /rooms
/rooms            → RoomsPage (map view default, toggle to list view)
/chat             → ChatPage (conversation list)
/chat/:id         → ChatPage (open specific conversation)
/marketplace      → ComingSoon (page="Marketplace" icon="ti-shopping-bag")
/roommates        → ComingSoon (page="Roommate finder" icon="ti-users")
/listing/:id      → ListingDetailPage
/listing/new      → CreateListingPage
/profile          → ProfilePage (edit profile)
/auth             → AuthPage (login / signup)
```

---

## Component structure

```
src/
  components/
    layout/
      BottomNav.tsx         -- persistent 4-tab nav bar, shown on all pages
      TopBar.tsx            -- search box + avatar/dropdown, shown on all pages
      ProfileDropdown.tsx   -- dropdown menu from avatar (use React Portal to avoid overflow clip)
    rooms/
      ListingCard.tsx
      ListingDetail.tsx     -- full page on mobile
      ListingMap.tsx        -- MapLibre map with pins
      ListingList.tsx       -- scrollable card list
      FilterPills.tsx       -- horizontal scrollable filter row
      CreateListingForm.tsx
    chat/
      ConversationList.tsx      -- all 1-on-1 threads for current user
      ChatView.tsx              -- real-time 1-on-1 message thread
      GroupChatView.tsx         -- real-time group broadcast thread (read-only for applicants)
      MessageBubble.tsx
      ApplicantsPanel.tsx       -- owner only: list of applicants with accept/reject/close actions
    notifications/
      NotificationBell.tsx  -- icon + unread badge count
      NotificationFeed.tsx
    shared/
      ComingSoon.tsx         -- reusable placeholder page
      Avatar.tsx             -- initials circle with color from user id
      Toast.tsx              -- error/success toasts
  pages/
    RoomsPage.tsx
    ChatPage.tsx
    ListingDetailPage.tsx
    CreateListingPage.tsx
    ProfilePage.tsx
    AuthPage.tsx
  lib/
    supabase.ts             -- supabase client singleton
    auth.ts                 -- auth helpers (getCurrentUser, signOut)
    listings.ts             -- listing CRUD functions including closeListing()
    conversations.ts        -- 1-on-1 conversation + message functions
    groupMessages.ts        -- group broadcast message functions (scoped by listing)
    applications.ts         -- acceptApplicant(), rejectApplicant(), fetchApplicants()
    notifications.ts        -- notification read/write functions
  hooks/
    useAuth.ts              -- current user, loading state
    useListings.ts          -- fetch + filter listings
    useConversation.ts      -- 1-on-1 messages + realtime subscription
    useGroupMessages.ts     -- group messages + realtime subscription (by listing_id)
    useApplicants.ts        -- fetch applicants for a listing (owner only)
    useNotifications.ts     -- unread count + feed
  types/
    index.ts                -- TypeScript interfaces for all DB tables
```

---

## Auth flow

1. User lands on `/rooms` → if not authenticated, redirect to `/auth`.
2. On `/auth`, show email + password form with a toggle between Sign up and Log in.
3. On successful sign up: insert a row into `users` table with the Supabase Auth uid as the id. Redirect to `/profile` to complete profile setup.
4. On successful log in: check if `users` row exists. If not (edge case), redirect to profile setup. Otherwise go to `/rooms`.
5. Use `supabase.auth.onAuthStateChange` to keep session in sync across the app.
6. Wrap all protected routes in an `AuthGuard` component that redirects to `/auth` if no session.

---

## Coming soon page — exact implementation

```tsx
// src/components/shared/ComingSoon.tsx
interface Props {
  page: string
  icon: string
  teaser: string
}

export function ComingSoon({ page, icon, teaser }: Props) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-8 bg-white">
      <div className="w-18 h-18 rounded-full bg-purple-50 flex items-center justify-center mb-4">
        <i className={`ti ${icon} text-4xl text-purple-700`} />
      </div>
      <span className="text-xs font-medium text-purple-800 bg-purple-50 px-3 py-1 rounded-full mb-3">
        Coming soon
      </span>
      <h2 className="text-base font-medium text-gray-900 mb-2 text-center">{page}</h2>
      <p className="text-sm text-gray-500 text-center leading-relaxed">{teaser}</p>
    </div>
  )
}

// Usage in router:
<Route path="/marketplace" element={
  <ComingSoon page="Marketplace" icon="ti-shopping-bag" teaser="Buy and sell furniture and student essentials near campus." />
} />
<Route path="/roommates" element={
  <ComingSoon page="Roommate finder" icon="ti-users" teaser="Find and connect with students looking for the same kind of place." />
} />
```

---

## Bottom navigation bar

Always visible. 4 tabs: Rooms, Chat, Marketplace, Roommates.
Show an unread badge on Chat when `notifications` or `messages` have unread rows for the current user.
Marketplace and Roommates navigate to their coming soon pages — they are not disabled.

```tsx
const tabs = [
  { label: 'Rooms',      icon: 'ti-building',     path: '/rooms' },
  { label: 'Chat',       icon: 'ti-message-2',    path: '/chat',       badge: unreadCount },
  { label: 'Market',     icon: 'ti-shopping-bag', path: '/marketplace' },
  { label: 'Roommates',  icon: 'ti-users',        path: '/roommates' },
]
```

---

## Profile dropdown (top-right avatar)

Render using a React Portal (`ReactDOM.createPortal`) into `document.body` to avoid being clipped by any `overflow: hidden` parent. Close on outside click.

Menu items:
- My profile → `/profile`
- Notifications → opens notification feed panel
- Saved listings → Phase 2, show coming soon toast for now
- Settings → Phase 2
- Sign out → `supabase.auth.signOut()` then redirect to `/auth`

---

## Listing type — full lease vs sublet

Every listing is one of two types. The type is set by the owner at creation and cannot be changed after posting.

**Both types require `available_from`** — the date the room is available to move in. This is always shown on the listing card and detail page regardless of type.

**Full lease** (`listing_type = 'full_lease'`):
- Standard year-long rental contract.
- `available_from` = the move-in / lease start date (required).
- `sublet_end` is null — do not render an end date field.
- Show a "Full lease" badge and the entry date: e.g. "Available from 1 Sep 2025".

**Sublet** (`listing_type = 'sublet'`):
- Short-term. The owner specifies an exact date range.
- `available_from` = the sublet start date (required).
- `sublet_end` = the sublet end date (required). Must be after `available_from`.
- Show a "Sublet" badge and the full date range: e.g. "15 Jun – 31 Aug 2025".
- Show the duration in human-readable form on the detail page: e.g. "2.5 months".

**In the create listing form:**
1. Show a segmented toggle at the top of the form: `Full lease | Sublet`.
2. Always show an "Available from" date picker (required for both types).
3. When "Sublet" is selected, reveal a second date picker: "Available until" (required).
4. Validate that `available_from` is set; if sublet, also validate `sublet_end > available_from`.
5. When "Full lease" is selected, hide the end date picker and set `sublet_end` to null.

**On listing cards (in list and map bottom sheet):**
- Full lease → purple badge "שכירות מלאה" + "כניסה: 1 בספטמבר 2025"
- Sublet → amber badge "סאבלט" + "15 ביוני – 31 באוגוסט 2025"

**On the map:**
- Map pin color does not change based on listing type — color encodes filter match only.
- The listing type badge and entry date are visible in the bottom sheet that opens when a pin is tapped.

**TypeScript type:**
```typescript
type ListingType = 'full_lease' | 'sublet'

interface Listing {
  // ...other fields
  listing_type:   ListingType
  available_from: string        // ISO date string e.g. "2025-09-01" — always required
  sublet_end:     string | null // ISO date string e.g. "2025-08-31" — sublet only
}
```

---

## Restrictions field — how to read it

The `restrictions` jsonb column on `listings` has this shape:
```json
{ "sex": "f", "min_year": 3 }
```
Both keys are optional. An empty object `{}` means no restrictions.

When displaying restrictions as badges on a listing card:
- `sex: "f"` → show "Female only" badge
- `sex: "m"` → show "Male only" badge
- `min_year: 3` → show "3rd year+" badge
- No restriction keys → show "No restrictions" or nothing

When filtering: a listing matches the current user if:
- `restrictions.sex` is absent, OR equals the user's sex
- `restrictions.min_year` is absent, OR user's `year_of_study >= min_year`

---

## Image upload for listings

Use Supabase Storage. On the create listing form, accept up to 5 images.

```typescript
const uploadImage = async (file: File, listingId: string) => {
  const path = `${listingId}/${Date.now()}-${file.name}`
  const { error } = await supabase.storage
    .from('listing-images')
    .upload(path, file)
  if (error) throw error
  const { data } = supabase.storage
    .from('listing-images')
    .getPublicUrl(path)
  return data.publicUrl
}
```

Upload all images first, collect the URLs, then insert the listing row with `image_urls = [url1, url2, ...]`.

---

## Map/list toggle behavior

The toggle is two icon buttons in the top bar filter row (map icon + list icon).
State is local to `RoomsPage`. Both views share the same fetched listings data and the same active filters. Switching view does not re-fetch data.

---

## Address / location picker in create listing form

1. Text input for address search using MapTiler Geocoding API.
2. Results appear as a dropdown list below the input.
3. Selecting a result drops a draggable pin on a small inline map preview.
4. User can drag the pin to fine-tune the exact location.
5. On submit, store `lat`, `lng`, and the formatted `address` string.

```typescript
const searchAddress = async (query: string) => {
  const res = await fetch(
    `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${import.meta.env.VITE_MAPTILER_KEY}&language=he&country=il`
  )
  const data = await res.json()
  return data.features
}
```

---

## Build order for Claude Code sessions

Work in this order. Do not skip ahead.

1. **Supabase setup** — create all 7 tables, RLS policies, storage bucket, enable Realtime on `messages` and `group_messages`
2. **Vite + React skeleton** — routing, env vars, Supabase client singleton, Tailwind
3. **Types** — define TypeScript interfaces for all 7 tables in `src/types/index.ts`
4. **Auth** — login/signup page, AuthGuard, profile setup on first login
5. **Listings list view** — fetch listings, ListingCard, filter pills, client-side filtering
6. **Listing detail page** — photos, info, restrictions badges, tenant avatars, Apply button
7. **Create listing form** — address search, map pin picker, image upload, form submit
8. **Listings map view** — MapLibre map, pins, click to open detail, locate-me, toggle
9. **Apply flow** — full insert sequence described in apply flow section
10. **Chat — conversation list** — fetch all 1-on-1 conversations for current user, last message preview
11. **Chat — real-time 1-on-1 view** — message bubbles, send message, Realtime subscription, mark as read
12. **Applicants panel** — owner-only view: list applicants, accept/reject buttons, status badges
13. **Group broadcast** — group_messages (keyed by listing), owner send, accepted applicants read-only view with Realtime
14. **Close listing flow** — confirmation dialog, batch status update, batch denial notifications
15. **Notifications** — bell badge, full notification feed with all 6 types, mark as read
16. **Coming soon pages** — ComingSoon component, Marketplace route, Roommates route
17. **Polish** — mobile responsiveness, error states, loading skeletons, empty states, deploy to Vercel

---

## Key constraints to always respect

- **No Express, no custom server.** Everything goes through Supabase or Vercel serverless functions.
- **Mobile-first layout.** The app is used on phones. Test every component at 375px width.
- **Hebrew content.** All user-facing placeholder text should be in Hebrew where appropriate. RTL layout is handled by MapTiler automatically on the map; the app UI itself is LTR (standard for Israeli web apps).
- **RLS must be enabled.** Never disable Row Level Security. Never use the service role key on the client.
- **ProfileDropdown uses a React Portal.** Never render it inside a parent with `overflow: hidden`.
- **Realtime cleanup.** Always call `supabase.removeChannel(channel)` in the useEffect cleanup function. This applies to both `messages` and `group_messages` subscriptions.
- **No partial apply flow.** All steps in the apply flow must succeed or none should be visible to the user.
- **No partial close listing flow.** All updates and notification inserts must complete or roll back.
- **Group messages are owner-send only.** Applicants can read group messages but cannot send to the group. They reply via their individual 1-on-1 thread.
- **Group broadcast is implicit per listing.** There is no separate group-conversation table. `group_messages` are scoped by `listing_id`; read access is gated by an accepted application for that listing. Do not create a group row before broadcasting.
- **Applicants panel is owner-only.** Never render accept/reject/close controls for non-owners. Gate with `currentUser.id === listing.owner_id`.
- **Image URLs are stored as an array** in `listings.image_urls`, not as a join table.
- **All listing dates are ISO date strings** (`"2025-09-01"`), not timestamps. Use `<input type="date">` in the form and store as-is. `available_from` is required on every listing. `sublet_end` is required only for sublets.
- **Do not create tables not listed in this file.** If a feature requires a new table, ask before creating it.

---

## Dependencies to install

```bash
npm create vite@latest shutafim -- --template react-ts
cd shutafim
npm install @supabase/supabase-js
npm install maplibre-gl @maptiler/sdk
npm install react-router-dom
npm install tailwindcss @tailwindcss/vite
npm install react-dropzone
```

---

## Deployment

Push to GitHub. Connect the repo to Vercel. Set the three environment variables in Vercel dashboard. Every push to `main` auto-deploys. Share the Vercel URL with the team — no local setup needed for testing on phones.

---

*Last updated: pre-hackathon planning. App name: Shutafim (שותפים). Added listing_type (full_lease / sublet), available_from, sublet_end. Added owner applicant management: accept/reject, group broadcast messaging (group_messages table, scoped by listing), and close listing flow with batch denial notifications. All decisions in this file are final for Phase 1.*
