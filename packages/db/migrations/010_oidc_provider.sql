-- Migration 010: OIDC Provider Tables
-- Stores authorization codes for the custom OIDC bridge

CREATE TABLE IF NOT EXISTS oidc_codes (
  code VARCHAR(255) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id VARCHAR(255) NOT NULL,
  redirect_uri TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for cleanup
CREATE INDEX IF NOT EXISTS idx_oidc_codes_expires_at ON oidc_codes(expires_at);
