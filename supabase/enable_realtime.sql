-- Enable Realtime for messages and group_messages
-- Run this in: Supabase Dashboard → SQL Editor → New query
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE group_messages;
