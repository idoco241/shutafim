-- Shutafim — full schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)
-- Safe to re-run: uses IF NOT EXISTS / CREATE POLICY ... IF NOT EXISTS patterns

-- ─── TABLES ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id              uuid PRIMARY KEY,          -- must equal Supabase Auth uid
  name            text NOT NULL,
  age             int,
  sex             text CHECK (sex IN ('m', 'f', 'other')),
  field_of_study  text,
  year_of_study   int CHECK (year_of_study BETWEEN 1 AND 6),
  bio             text,
  avatar_url      text,
  created_at      timestamp WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS listings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid REFERENCES users(id) NOT NULL,
  address         text NOT NULL,
  floor           int,
  neighborhood    text,
  lat             float8 NOT NULL,
  lng             float8 NOT NULL,
  price_per_month int NOT NULL,
  total_rooms     int,
  description     text,
  listing_type    text NOT NULL DEFAULT 'full_lease'
                  CHECK (listing_type IN ('full_lease', 'sublet')),
  available_from  date NOT NULL,
  sublet_end      date,
  restrictions    jsonb,
  image_urls      text[],
  is_active       boolean DEFAULT true,
  created_at      timestamp WITH TIME ZONE DEFAULT now(),
  CONSTRAINT sublet_end_required
    CHECK (listing_type <> 'sublet' OR sublet_end IS NOT NULL),
  CONSTRAINT sublet_end_after_start
    CHECK (sublet_end IS NULL OR sublet_end > available_from)
);

CREATE TABLE IF NOT EXISTS conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid REFERENCES listings(id),     -- nullable for future DMs
  user_a      uuid REFERENCES users(id) NOT NULL,
  user_b      uuid REFERENCES users(id) NOT NULL,
  created_at  timestamp WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_a, user_b, listing_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) NOT NULL,
  sender_id       uuid REFERENCES users(id) NOT NULL,
  content         text NOT NULL,
  is_read         boolean DEFAULT false,
  created_at      timestamp WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS applications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      uuid REFERENCES listings(id) NOT NULL,
  applicant_id    uuid REFERENCES users(id) NOT NULL,
  conversation_id uuid REFERENCES conversations(id),
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'rejected', 'denied_closed')),
  created_at      timestamp WITH TIME ZONE DEFAULT now(),
  UNIQUE (listing_id, applicant_id)
);

CREATE TABLE IF NOT EXISTS group_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid REFERENCES listings(id) NOT NULL,
  sender_id   uuid REFERENCES users(id) NOT NULL,
  content     text NOT NULL,
  created_at  timestamp WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id) NOT NULL,
  type        text NOT NULL
              CHECK (type IN (
                'application', 'accepted', 'rejected',
                'group_message', 'message', 'listing_closed'
              )),
  payload     jsonb NOT NULL DEFAULT '{}',
  is_read     boolean DEFAULT false,
  created_at  timestamp WITH TIME ZONE DEFAULT now()
);

-- ─── ROW LEVEL SECURITY ────────────────────────────────────────────────────

ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications   ENABLE ROW LEVEL SECURITY;

-- users
CREATE POLICY "users: authenticated read all"
  ON users FOR SELECT TO authenticated USING (true);

CREATE POLICY "users: insert own row"
  ON users FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "users: update own row"
  ON users FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "users: delete own row"
  ON users FOR DELETE TO authenticated USING (id = auth.uid());

-- listings
CREATE POLICY "listings: read active or own"
  ON listings FOR SELECT TO authenticated
  USING (is_active = true OR owner_id = auth.uid());

CREATE POLICY "listings: insert own"
  ON listings FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "listings: update own"
  ON listings FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "listings: delete own"
  ON listings FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- conversations
CREATE POLICY "conversations: read as participant"
  ON conversations FOR SELECT TO authenticated
  USING (user_a = auth.uid() OR user_b = auth.uid());

CREATE POLICY "conversations: insert as participant"
  ON conversations FOR INSERT TO authenticated
  WITH CHECK (user_a = auth.uid() OR user_b = auth.uid());

-- messages
CREATE POLICY "messages: read in own conversations"
  ON messages FOR SELECT TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE user_a = auth.uid() OR user_b = auth.uid()
    )
  );

CREATE POLICY "messages: insert as sender in own conversations"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (
      SELECT id FROM conversations
      WHERE user_a = auth.uid() OR user_b = auth.uid()
    )
  );

CREATE POLICY "messages: mark own received as read"
  ON messages FOR UPDATE TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE user_a = auth.uid() OR user_b = auth.uid()
    )
    AND sender_id <> auth.uid()
  );

-- applications
CREATE POLICY "applications: read as applicant or listing owner"
  ON applications FOR SELECT TO authenticated
  USING (
    applicant_id = auth.uid()
    OR listing_id IN (
      SELECT id FROM listings WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "applications: insert as applicant"
  ON applications FOR INSERT TO authenticated
  WITH CHECK (applicant_id = auth.uid());

CREATE POLICY "applications: update as listing owner"
  ON applications FOR UPDATE TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings WHERE owner_id = auth.uid()
    )
  );

-- group_messages
CREATE POLICY "group_messages: read as owner or accepted applicant"
  ON group_messages FOR SELECT TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings WHERE owner_id = auth.uid()
    )
    OR listing_id IN (
      SELECT listing_id FROM applications
      WHERE applicant_id = auth.uid() AND status = 'accepted'
    )
  );

CREATE POLICY "group_messages: insert as listing owner only"
  ON group_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND listing_id IN (
      SELECT id FROM listings WHERE owner_id = auth.uid()
    )
  );

-- notifications
CREATE POLICY "notifications: read own"
  ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications: insert for authenticated"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "notifications: mark own as read"
  ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- ─── REALTIME ───────────────────────────────────────────────────────────────
-- Enable Realtime for these tables in the Supabase dashboard:
--   Dashboard → Database → Replication → toggle ON for:
--     • messages
--     • group_messages

-- ─── STORAGE ────────────────────────────────────────────────────────────────
-- Create storage bucket manually in the dashboard:
--   Dashboard → Storage → New bucket
--     Name: listing-images
--     Public: YES (toggle on)
--
-- Then add these storage policies (Dashboard → Storage → listing-images → Policies):
--   SELECT: public (anyone can view images)
--   INSERT: authenticated users only
--   DELETE: authenticated users only (owner enforced in app logic)
