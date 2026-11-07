-- 231: reel_transcripts.pauses — silences in a recording, for suggested cuts (2026-11-01).
-- The reel-render worker runs ffmpeg silencedetect on the same audio it gives
-- whisper.cpp and stores [{ "s": 12.3, "e": 14.1 }] in source seconds. The clip
-- editor's Pauses panel offers them as cuts (packages/reels/src/editor/Pauses.tsx).

ALTER TABLE reel_transcripts ADD COLUMN IF NOT EXISTS pauses jsonb;
