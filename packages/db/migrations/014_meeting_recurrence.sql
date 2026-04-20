-- Migration 014: Add recurrence columns to meetings table
-- These columns were defined in schemas.ts but never added via migration

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS recurrence_pattern VARCHAR(20)
    CHECK (recurrence_pattern IN ('DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM')),
  ADD COLUMN IF NOT EXISTS recurrence_custom_rule TEXT;
