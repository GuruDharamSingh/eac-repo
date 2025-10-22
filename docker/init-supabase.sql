-- Create required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create auth schema
CREATE SCHEMA IF NOT EXISTS auth;

-- Create realtime schema
CREATE SCHEMA IF NOT EXISTS realtime;

-- Create storage schema (for future use)
CREATE SCHEMA IF NOT EXISTS storage;

-- Grant permissions to postgres user
GRANT ALL ON SCHEMA auth TO postgres;
GRANT ALL ON SCHEMA realtime TO postgres;
GRANT ALL ON SCHEMA storage TO postgres;

-- Set search path to include auth schema
ALTER DATABASE elkdonis_dev SET search_path TO public, auth;

-- Create a basic users table in public schema to link with auth.users
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id UUID UNIQUE,
    display_name TEXT,
    email TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);