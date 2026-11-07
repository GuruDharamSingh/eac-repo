-- 232: reel_transcripts.peaks — the recording's sound level for the timeline waveform (2026-11-01).
-- The reel-render worker reads the 16 kHz mono WAV it extracts for whisper.cpp
-- and stores { "rate": 20, "data": "<base64>" }: one byte per 1/20 s, the
-- loudest sample in that span on a dB scale (0 = 48 dB under the recording's
-- own peak or quieter, 255 = its peak). Written as soon as the audio is out,
-- before the words, so the waveform shows while whisper runs.
-- packages/reels/src/editor/Timeline.tsx draws it on the Recording row.

ALTER TABLE reel_transcripts ADD COLUMN IF NOT EXISTS peaks jsonb;
