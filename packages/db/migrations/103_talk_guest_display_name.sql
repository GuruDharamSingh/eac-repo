-- Let a member choose the name their Talk guest account posts under.
--
-- Until now the name on a chat message was derived from the member's profile
-- on every post (display name, falling back to their email address — which is
-- a poor thing to broadcast to a room). A chosen name has to outrank that, and
-- outranking it needs a way to tell "the member picked this" from "we derived
-- this", or the next post would quietly overwrite their choice with the
-- profile value again.
--
-- name_is_custom: the member set display_name deliberately. While false,
--   display_name is only a cache of whatever we last told Talk, and is
--   refreshed from the profile freely.

ALTER TABLE talk_guest_sessions
  ADD COLUMN IF NOT EXISTS name_is_custom BOOLEAN NOT NULL DEFAULT FALSE;
