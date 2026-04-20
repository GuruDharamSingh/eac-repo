-- Migration 017: Event Page Drawing
-- Adds drawing JSONB column for Excalidraw data on event pages

ALTER TABLE event_pages ADD COLUMN IF NOT EXISTS drawing JSONB DEFAULT NULL;
