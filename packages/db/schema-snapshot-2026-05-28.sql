--
-- PostgreSQL database dump
--

\restrict RNhBSRmK4YQpIcL5RRJG835ujGxpUnBlCyJI2PKGWKsdc4atl1eGdthXu4fPzsi

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA realtime;


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: handle_new_user_role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.handle_new_user_role() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF NEW.role IS NULL OR NEW.role = '' THEN
    NEW.role := 'authenticated';
  END IF;
  IF NEW.aud IS NULL OR NEW.aud = '' THEN
    NEW.aud := 'authenticated';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claim.sub', true),
    current_setting('request.jwt.claims', true)::json->>'sub'
  )::UUID;
$$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: artist_profiles_touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.artist_profiles_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: commerce_touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  details jsonb := '{}'::jsonb;
BEGIN
  IF meta ? 'interests' AND jsonb_typeof(meta->'interests') = 'array' THEN
    details := details || jsonb_build_object('interests', meta->'interests');
  END IF;

  IF meta ? 'signup_source' THEN
    details := details || jsonb_build_object('signup_source', meta->'signup_source');
  END IF;

  details := details || jsonb_build_object('signup_at', to_jsonb(NEW.created_at));

  INSERT INTO public.users (id, auth_user_id, email, display_name, signup_details, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.id,
    NEW.email,
    COALESCE(meta->>'display_name', split_part(NEW.email, '@', 1)),
    details,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    -- Preserve existing signup_details on conflict; only fill in if NULL.
    signup_details = COALESCE(public.users.signup_details, EXCLUDED.signup_details),
    updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: recalculate_reaction_counts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalculate_reaction_counts() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Update posts
  UPDATE posts p
  SET reaction_count = (
    SELECT COUNT(*)
    FROM reactions r
    WHERE r.reactable_type = 'post' AND r.reactable_id = p.id
  );

  -- Update meetings
  UPDATE meetings m
  SET reaction_count = (
    SELECT COUNT(*)
    FROM reactions r
    WHERE r.reactable_type = 'meeting' AND r.reactable_id = m.id
  );

  -- Update replies
  UPDATE replies r
  SET reaction_count = (
    SELECT COUNT(*)
    FROM reactions rx
    WHERE rx.reactable_type = 'reply' AND rx.reactable_id = r.id
  );

  RAISE NOTICE 'Reaction counts recalculated successfully';
END;
$$;


--
-- Name: update_availability_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_availability_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_event_pages_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_event_pages_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_poll_option_vote_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_poll_option_vote_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE poll_options SET vote_count = vote_count + 1 WHERE id = NEW.option_id;
    UPDATE question_polls SET vote_count = vote_count + 1, updated_at = NOW() WHERE id = NEW.poll_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE poll_options SET vote_count = vote_count - 1 WHERE id = OLD.option_id;
    UPDATE question_polls SET vote_count = vote_count - 1, updated_at = NOW() WHERE id = OLD.poll_id;
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: update_poll_response_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_poll_response_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE availability_polls
    SET response_count = response_count + 1,
        updated_at = NOW()
    WHERE id = NEW.poll_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE availability_polls
    SET response_count = response_count - 1,
        updated_at = NOW()
    WHERE id = OLD.poll_id;
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: update_reaction_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_reaction_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment reaction count
    IF NEW.reactable_type = 'post' THEN
      UPDATE posts SET reaction_count = reaction_count + 1 WHERE id = NEW.reactable_id;
    ELSIF NEW.reactable_type = 'meeting' THEN
      UPDATE meetings SET reaction_count = reaction_count + 1 WHERE id = NEW.reactable_id;
    ELSIF NEW.reactable_type = 'reply' THEN
      UPDATE replies SET reaction_count = reaction_count + 1 WHERE id = NEW.reactable_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement reaction count
    IF OLD.reactable_type = 'post' THEN
      UPDATE posts SET reaction_count = reaction_count - 1 WHERE id = OLD.reactable_id;
    ELSIF OLD.reactable_type = 'meeting' THEN
      UPDATE meetings SET reaction_count = reaction_count - 1 WHERE id = OLD.reactable_id;
    ELSIF OLD.reactable_type = 'reply' THEN
      UPDATE replies SET reaction_count = reaction_count - 1 WHERE id = OLD.reactable_id;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;


--
-- Name: update_reading_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_reading_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_reply_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_reply_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment reply count and update activity
    IF NEW.parent_type = 'post' THEN
      UPDATE posts
      SET reply_count = reply_count + 1,
          last_activity_at = NEW.created_at
      WHERE id = NEW.parent_id;
    ELSIF NEW.parent_type = 'meeting' THEN
      UPDATE meetings
      SET reply_count = reply_count + 1,
          last_activity_at = NEW.created_at
      WHERE id = NEW.parent_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement reply count
    IF OLD.parent_type = 'post' THEN
      UPDATE posts SET reply_count = reply_count - 1 WHERE id = OLD.parent_id;
    ELSIF OLD.parent_type = 'meeting' THEN
      UPDATE meetings SET reply_count = reply_count - 1 WHERE id = OLD.parent_id;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;


--
-- Name: update_thread_activity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_thread_activity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Update the parent post or meeting
  IF NEW.parent_type = 'post' THEN
    UPDATE posts
    SET last_activity_at = NEW.created_at
    WHERE id = NEW.parent_id;
  ELSIF NEW.parent_type = 'meeting' THEN
    UPDATE meetings
    SET last_activity_at = NEW.created_at
    WHERE id = NEW.parent_id;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: user_belongs_to_org(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_belongs_to_org(check_org_id character varying) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = auth.uid()
      AND org_id = check_org_id
  );
$$;


--
-- Name: workshop_pages_touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.workshop_pages_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text NOT NULL,
    code_challenge_method auth.code_challenge_method NOT NULL,
    code_challenge text NOT NULL,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'stores metadata for pkce logins';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(14) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: app_schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_schema_migrations (
    filename text NOT NULL,
    checksum text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: artist_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.artist_profiles (
    user_id uuid NOT NULL,
    org_id character varying(50) NOT NULL,
    display_name character varying(120),
    pronouns character varying(40),
    city character varying(120),
    bio text,
    photo_url text,
    disciplines text[] DEFAULT '{}'::text[] NOT NULL,
    disciplines_other text,
    experience_level character varying(20),
    audience_description text,
    audience_value text,
    goals_seeking text,
    goals_offering text,
    aesthetic_notes text,
    features_requested text[] DEFAULT '{}'::text[] NOT NULL,
    template_preference character varying(20),
    palette_preference character varying(80),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    needs text[] DEFAULT '{}'::text[] NOT NULL,
    personal_philosophy text,
    aesthetic_keywords text[] DEFAULT '{}'::text[] NOT NULL,
    portfolio_url text,
    audience_types text[] DEFAULT '{}'::text[] NOT NULL,
    client_base text[] DEFAULT '{}'::text[] NOT NULL,
    goals_options text[] DEFAULT '{}'::text[] NOT NULL,
    mutual_aid_media boolean DEFAULT false NOT NULL,
    mutual_aid_authoring boolean DEFAULT false NOT NULL,
    features_other text,
    revenue_sharing_model character varying(50),
    overhead_commission character varying(20),
    member_dues_frequency character varying(20),
    financial_transparency_access character varying(30),
    primary_decision_method character varying(30),
    membership_roles text[] DEFAULT '{}'::text[] NOT NULL,
    dispute_resolution_process text,
    membership_admission character varying(30),
    inventory_tracking_system character varying(30),
    fulfillment_responsibility character varying(30),
    digital_presence_type text[] DEFAULT '{}'::text[] NOT NULL,
    admin_load_rotation character varying(30),
    minimal_viable_income character varying(50),
    emergency_fund_target character varying(20),
    growth_reinvestment character varying(20),
    sustainability_benchmarks text[] DEFAULT '{}'::text[] NOT NULL,
    shared_resource_categories text[] DEFAULT '{}'::text[] NOT NULL,
    bulk_buying_agreements text,
    mutual_aid_funds boolean DEFAULT false NOT NULL,
    skill_share_frequency character varying(20),
    work_trade_availability boolean DEFAULT false NOT NULL,
    biz_entity_type character varying(50),
    biz_entity_name character varying(120),
    biz_mission text,
    biz_legal_status character varying(50),
    biz_primary_revenue text[] DEFAULT '{}'::text[] NOT NULL,
    biz_capacity character varying(200),
    biz_pricing_philosophy character varying(50),
    biz_tools character varying(200),
    biz_fulfillment character varying(50),
    biz_inventory_management text,
    biz_desired_resources text[] DEFAULT '{}'::text[] NOT NULL,
    biz_revenue_sharing character varying(100),
    biz_skill_share text,
    biz_main_barrier text,
    biz_revenue_goal character varying(100),
    is_stub boolean DEFAULT true NOT NULL,
    social_links jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT artist_profiles_experience_level_check CHECK (((experience_level IS NULL) OR ((experience_level)::text = ANY ((ARRAY['starting_fresh'::character varying, 'established'::character varying])::text[])))),
    CONSTRAINT artist_profiles_template_preference_check CHECK (((template_preference IS NULL) OR ((template_preference)::text = ANY ((ARRAY['article'::character varying, 'event'::character varying, 'radio'::character varying, 'business'::character varying])::text[]))))
);


--
-- Name: artwork; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.artwork (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id character varying(50) NOT NULL,
    artist_user_id uuid NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    description_html text,
    year_created integer,
    medium text,
    style text,
    subject text,
    height_cm numeric(8,2),
    width_cm numeric(8,2),
    depth_cm numeric(8,2),
    weight_kg numeric(8,2),
    kind text DEFAULT 'original'::text NOT NULL,
    certificate_of_authenticity boolean DEFAULT true NOT NULL,
    provenance_notes text,
    status text DEFAULT 'draft'::text NOT NULL,
    primary_image_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT artwork_kind_check CHECK ((kind = ANY (ARRAY['original'::text, 'limited_edition'::text, 'open_edition'::text]))),
    CONSTRAINT artwork_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'available'::text, 'reserved'::text, 'sold'::text, 'archived'::text])))
);


--
-- Name: artwork_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.artwork_media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    artwork_id uuid NOT NULL,
    org_id character varying(50) NOT NULL,
    url text NOT NULL,
    nextcloud_file_id character varying(255),
    nextcloud_path character varying(500),
    alt text,
    role text DEFAULT 'detail'::text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT artwork_media_role_check CHECK ((role = ANY (ARRAY['hero'::text, 'detail'::text, 'scale'::text, 'wall'::text, 'video'::text])))
);


--
-- Name: artwork_variant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.artwork_variant (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    artwork_id uuid NOT NULL,
    org_id character varying(50) NOT NULL,
    sku text,
    label text,
    price_minor bigint NOT NULL,
    currency character(3) DEFAULT 'CAD'::bpchar NOT NULL,
    edition_number integer,
    edition_total integer,
    inventory_qty integer DEFAULT 1 NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT artwork_variant_inventory_qty_check CHECK ((inventory_qty >= 0)),
    CONSTRAINT artwork_variant_price_minor_check CHECK ((price_minor >= 0))
);


--
-- Name: auction_lot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auction_lot (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    artwork_variant_id uuid NOT NULL,
    org_id character varying(50) NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    starting_bid_minor bigint NOT NULL,
    reserve_minor bigint,
    buy_now_minor bigint,
    bid_increment_minor bigint DEFAULT 1000 NOT NULL,
    anti_snipe_minutes integer DEFAULT 5 NOT NULL,
    current_bid_minor bigint,
    current_bid_id uuid,
    bid_count integer DEFAULT 0 NOT NULL,
    currency character(3) DEFAULT 'CAD'::bpchar NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL,
    winner_user_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT auction_lot_anti_snipe_minutes_check CHECK ((anti_snipe_minutes >= 0)),
    CONSTRAINT auction_lot_bid_increment_minor_check CHECK ((bid_increment_minor > 0)),
    CONSTRAINT auction_lot_buy_now_minor_check CHECK (((buy_now_minor IS NULL) OR (buy_now_minor >= 0))),
    CONSTRAINT auction_lot_reserve_minor_check CHECK (((reserve_minor IS NULL) OR (reserve_minor >= 0))),
    CONSTRAINT auction_lot_starting_bid_minor_check CHECK ((starting_bid_minor >= 0)),
    CONSTRAINT auction_lot_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'live'::text, 'ended'::text, 'cancelled'::text, 'sold'::text, 'passed'::text])))
);


--
-- Name: availability_poll_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.availability_poll_options (
    id character varying(21) NOT NULL,
    poll_id character varying(21) NOT NULL,
    slot_at timestamp with time zone NOT NULL,
    duration_minutes integer,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: availability_poll_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.availability_poll_responses (
    id character varying(21) NOT NULL,
    poll_id character varying(21) NOT NULL,
    option_id character varying(21) NOT NULL,
    user_id uuid NOT NULL,
    availability character varying(20) DEFAULT 'yes'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT availability_poll_responses_availability_check CHECK (((availability)::text = ANY ((ARRAY['yes'::character varying, 'no'::character varying, 'maybe'::character varying])::text[])))
);


--
-- Name: availability_polls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.availability_polls (
    id character varying(21) NOT NULL,
    thread_id character varying(21) NOT NULL,
    created_by uuid NOT NULL,
    title text,
    description text,
    closes_at timestamp with time zone,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    response_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT availability_polls_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'closed'::character varying])::text[])))
);


--
-- Name: availability_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.availability_responses (
    id character varying(21) NOT NULL,
    poll_id character varying(21) NOT NULL,
    user_id uuid,
    user_name character varying(255),
    user_email character varying(255),
    user_timezone character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE availability_responses; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.availability_responses IS 'Individual participant responses to availability polls';


--
-- Name: COLUMN availability_responses.user_timezone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.availability_responses.user_timezone IS 'IANA timezone identifier (e.g., America/New_York, Europe/London)';


--
-- Name: availability_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.availability_slots (
    response_id character varying(21) NOT NULL,
    time_slot timestamp with time zone NOT NULL,
    availability character varying(10) NOT NULL,
    CONSTRAINT availability_slots_availability_check CHECK (((availability)::text = ANY ((ARRAY['yes'::character varying, 'no'::character varying, 'maybe'::character varying])::text[])))
);


--
-- Name: TABLE availability_slots; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.availability_slots IS 'Specific time slot availability (yes/no/maybe) for each response';


--
-- Name: COLUMN availability_slots.availability; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.availability_slots.availability IS 'yes = available, no = not available, maybe = tentatively available';


--
-- Name: bid; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bid (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lot_id uuid NOT NULL,
    bidder_id uuid NOT NULL,
    amount_minor bigint NOT NULL,
    max_amount_minor bigint,
    is_max_bid boolean DEFAULT false NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    client_ip inet,
    user_agent text,
    placed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bid_amount_minor_check CHECK ((amount_minor > 0)),
    CONSTRAINT bid_check CHECK (((max_amount_minor IS NULL) OR (max_amount_minor >= amount_minor))),
    CONSTRAINT bid_status_check CHECK ((status = ANY (ARRAY['active'::text, 'outbid'::text, 'winning'::text, 'retracted'::text])))
);


--
-- Name: bookmarks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookmarks (
    id character varying(21) NOT NULL,
    user_id uuid NOT NULL,
    thread_id character varying(21) NOT NULL,
    reply_id character varying(21),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cart; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cart (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token text NOT NULL,
    user_id uuid,
    currency character(3) DEFAULT 'CAD'::bpchar NOT NULL,
    expires_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cart_line; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cart_line (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cart_id uuid NOT NULL,
    artwork_variant_id uuid NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price_minor bigint NOT NULL,
    currency character(3) NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cart_line_quantity_check CHECK ((quantity > 0))
);


--
-- Name: commerce_order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_order (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    number text NOT NULL,
    customer_id uuid,
    customer_email text NOT NULL,
    customer_name text,
    status text DEFAULT 'pending_payment'::text NOT NULL,
    payment_method text DEFAULT 'etransfer'::text NOT NULL,
    payment_reference text,
    payment_instructions text,
    payment_due_at timestamp with time zone,
    payment_confirmed_at timestamp with time zone,
    payment_confirmed_by uuid,
    payment_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    subtotal_minor bigint DEFAULT 0 NOT NULL,
    shipping_minor bigint DEFAULT 0 NOT NULL,
    tax_minor bigint DEFAULT 0 NOT NULL,
    total_minor bigint DEFAULT 0 NOT NULL,
    currency character(3) DEFAULT 'CAD'::bpchar NOT NULL,
    shipping_address jsonb,
    billing_address jsonb,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    paid_at timestamp with time zone,
    fulfilled_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    CONSTRAINT commerce_order_payment_method_check CHECK ((payment_method = ANY (ARRAY['etransfer'::text, 'stripe'::text, 'manual'::text]))),
    CONSTRAINT commerce_order_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending_payment'::text, 'awaiting_etransfer'::text, 'payment_received'::text, 'paid'::text, 'fulfilled'::text, 'completed'::text, 'cancelled'::text, 'refunded'::text])))
);


--
-- Name: commerce_order_line; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_order_line (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    artwork_variant_id uuid,
    artwork_id uuid,
    artist_user_id uuid,
    org_id character varying(50),
    description text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price_minor bigint NOT NULL,
    artist_share_minor bigint,
    gallery_share_minor bigint,
    currency character(3) NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT commerce_order_line_quantity_check CHECK ((quantity > 0))
);


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts (
    id text NOT NULL,
    org_id text NOT NULL,
    email text NOT NULL,
    name text,
    message text,
    status text DEFAULT 'new'::text NOT NULL,
    source text,
    created_at timestamp with time zone DEFAULT now(),
    user_id uuid,
    CONSTRAINT contacts_status_check CHECK ((status = ANY (ARRAY['new'::text, 'contacted'::text, 'joined'::text])))
);


--
-- Name: content_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_drafts (
    id character varying(21) NOT NULL,
    user_id uuid NOT NULL,
    org_id character varying(50) NOT NULL,
    content_type character varying(20) NOT NULL,
    title text DEFAULT ''::text,
    slug character varying(255) DEFAULT ''::character varying,
    body text DEFAULT ''::text,
    excerpt text DEFAULT ''::text,
    visibility character varying(20) DEFAULT 'PUBLIC'::character varying,
    meeting_data jsonb DEFAULT '{}'::jsonb,
    media_refs jsonb DEFAULT '[]'::jsonb,
    integration_settings jsonb DEFAULT '{}'::jsonb,
    current_step integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT content_drafts_content_type_check CHECK (((content_type)::text = 'thread'::text))
);


--
-- Name: email_template_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_template_settings (
    id text NOT NULL,
    org_id text NOT NULL,
    template_key text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by text,
    updated_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id character varying(21) NOT NULL,
    org_id character varying(50),
    user_id uuid NOT NULL,
    action character varying(50) NOT NULL,
    resource_type character varying(50),
    resource_id character varying(21),
    data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: extensions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.extensions (
    id uuid NOT NULL,
    type text,
    settings jsonb,
    tenant_external_id text,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL
);


--
-- Name: flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flags (
    id character varying(21) NOT NULL,
    target_kind character varying(20) NOT NULL,
    target_id character varying(50) NOT NULL,
    reporter_id uuid NOT NULL,
    reason character varying(50),
    details text,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT flags_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'resolved'::character varying, 'dismissed'::character varying])::text[]))),
    CONSTRAINT flags_target_kind_check CHECK (((target_kind)::text = ANY ((ARRAY['thread'::character varying, 'reply'::character varying, 'user'::character varying])::text[])))
);


--
-- Name: guest_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guest_submissions (
    id character varying(21) NOT NULL,
    thread_id character varying(21),
    kind character varying(20) NOT NULL,
    name text,
    email character varying(255),
    message text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip_address inet,
    user_agent text,
    origin_domain text,
    linked_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT guest_submissions_kind_check CHECK (((kind)::text = ANY ((ARRAY['rsvp'::character varying, 'interest'::character varying, 'contact'::character varying, 'question'::character varying])::text[])))
);


--
-- Name: guestbook_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guestbook_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id text DEFAULT 'inner_group'::text NOT NULL,
    user_id text,
    display_name text,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inquiry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inquiry (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    artwork_id uuid NOT NULL,
    org_id character varying(50) NOT NULL,
    customer_email text NOT NULL,
    customer_name text,
    customer_user_id uuid,
    kind text DEFAULT 'question'::text NOT NULL,
    offer_amount_minor bigint,
    currency character(3),
    message text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone,
    CONSTRAINT inquiry_kind_check CHECK ((kind = ANY (ARRAY['question'::text, 'reserve_request'::text, 'make_offer'::text]))),
    CONSTRAINT inquiry_status_check CHECK ((status = ANY (ARRAY['open'::text, 'accepted'::text, 'declined'::text, 'expired'::text])))
);


--
-- Name: landing_inquiries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.landing_inquiries (
    id bigint NOT NULL,
    org_id text DEFAULT 'elkdonis'::text NOT NULL,
    prompt text NOT NULL,
    answer text NOT NULL,
    ip_hash text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: landing_inquiries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.landing_inquiries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: landing_inquiries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.landing_inquiries_id_seq OWNED BY public.landing_inquiries.id;


--
-- Name: marketplace_artists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketplace_artists (
    user_id uuid NOT NULL,
    org_id character varying(50) NOT NULL,
    payout_email text NOT NULL,
    payout_method text DEFAULT 'etransfer'::text NOT NULL,
    commission_rate numeric(5,2) DEFAULT 30.00 NOT NULL,
    default_currency character(3) DEFAULT 'CAD'::bpchar NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    bio_html text,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT marketplace_artists_payout_method_check CHECK ((payout_method = ANY (ARRAY['etransfer'::text, 'manual'::text]))),
    CONSTRAINT marketplace_artists_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text])))
);


--
-- Name: media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media (
    id character varying(21) NOT NULL,
    org_id character varying(50) NOT NULL,
    uploaded_by uuid NOT NULL,
    attached_to_type character varying(20),
    attached_to_id character varying(21),
    nextcloud_file_id character varying(255) NOT NULL,
    url text NOT NULL,
    type character varying(20),
    filename character varying(255),
    size_bytes integer,
    mime_type character varying(100),
    caption text,
    alt_text text,
    created_at timestamp with time zone DEFAULT now(),
    nextcloud_path text DEFAULT ''::text NOT NULL,
    nextcloud_synced boolean DEFAULT true,
    CONSTRAINT media_attached_to_type_check CHECK (((attached_to_type)::text = ANY ((ARRAY['thread'::character varying, 'reply'::character varying])::text[]))),
    CONSTRAINT media_check CHECK ((((attached_to_type IS NOT NULL) AND (attached_to_id IS NOT NULL)) OR ((attached_to_type IS NULL) AND (attached_to_id IS NULL)))),
    CONSTRAINT media_type_check CHECK (((type)::text = ANY ((ARRAY['image'::character varying, 'video'::character varying, 'audio'::character varying, 'document'::character varying])::text[])))
);


--
-- Name: moderation_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.moderation_log (
    id character varying(21) NOT NULL,
    moderator_id uuid NOT NULL,
    action character varying(50) NOT NULL,
    target_kind character varying(20) NOT NULL,
    target_id character varying(50) NOT NULL,
    reason text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: nextcloud_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nextcloud_events (
    id character varying(21) NOT NULL,
    event_type character varying(50) NOT NULL,
    nextcloud_id character varying(255) NOT NULL,
    resource_type character varying(50),
    resource_id character varying(21),
    data jsonb,
    processed boolean DEFAULT false,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE nextcloud_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.nextcloud_events IS 'Webhook events from Nextcloud for data synchronization';


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id character varying(21) NOT NULL,
    user_id uuid NOT NULL,
    kind character varying(40) NOT NULL,
    thread_id character varying(21),
    reply_id character varying(21),
    actor_id uuid,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: oidc_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oidc_codes (
    code character varying(255) NOT NULL,
    user_id uuid NOT NULL,
    client_id character varying(255) NOT NULL,
    redirect_uri text,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    nonce text,
    code_challenge text,
    code_challenge_method character varying(10)
);


--
-- Name: org_site_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_site_sections (
    org_id character varying(50) NOT NULL,
    section_key text NOT NULL,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(100) NOT NULL,
    description text,
    nextcloud_folder_id character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    nextcloud_folder_path character varying(500),
    nextcloud_public_share_token character varying(255),
    blog_password_hash character varying(128),
    blog_password_salt character varying(64),
    is_cms_site boolean DEFAULT false NOT NULL,
    cms_allowed_orgs text[] DEFAULT '{}'::text[] NOT NULL,
    subdomain_confirmed boolean DEFAULT true NOT NULL,
    layout_mode character varying(20) DEFAULT 'default'::character varying NOT NULL,
    silex_project_path character varying(500),
    silex_published_path character varying(500),
    silex_published_at timestamp with time zone,
    CONSTRAINT organizations_layout_mode_check CHECK (((layout_mode)::text = ANY ((ARRAY['default'::character varying, 'silex'::character varying])::text[])))
);


--
-- Name: payout; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payout (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    artist_user_id uuid NOT NULL,
    order_id uuid,
    amount_minor bigint NOT NULL,
    currency character(3) NOT NULL,
    method text DEFAULT 'etransfer'::text NOT NULL,
    reference text,
    status text DEFAULT 'pending'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    CONSTRAINT payout_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'received'::text, 'failed'::text])))
);


--
-- Name: poll_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.poll_options (
    id character varying(21) NOT NULL,
    poll_id character varying(21) NOT NULL,
    label text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    vote_count integer DEFAULT 0 NOT NULL
);


--
-- Name: TABLE poll_options; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.poll_options IS 'Answer options for question polls';


--
-- Name: poll_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.poll_votes (
    id character varying(21) NOT NULL,
    poll_id character varying(21) NOT NULL,
    option_id character varying(21) NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE poll_votes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.poll_votes IS 'Individual user votes on poll options';


--
-- Name: question_poll_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question_poll_options (
    id character varying(21) NOT NULL,
    poll_id character varying(21) NOT NULL,
    label text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    vote_count integer DEFAULT 0 NOT NULL
);


--
-- Name: question_poll_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question_poll_votes (
    id character varying(21) NOT NULL,
    poll_id character varying(21) NOT NULL,
    option_id character varying(21) NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: question_polls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question_polls (
    id character varying(21) NOT NULL,
    thread_id character varying(21) NOT NULL,
    created_by uuid NOT NULL,
    question text NOT NULL,
    multi_select boolean DEFAULT false NOT NULL,
    closes_at timestamp with time zone,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    total_votes integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT question_polls_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'closed'::character varying])::text[])))
);


--
-- Name: reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reactions (
    id character varying(21) NOT NULL,
    thread_id character varying(21) NOT NULL,
    reply_id character varying(21),
    user_id uuid NOT NULL,
    kind character varying(20) DEFAULT 'like'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reading_books; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reading_books (
    id character varying(21) NOT NULL,
    org_id character varying(50) NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    author text,
    description text,
    language text DEFAULT 'en'::text,
    source_type character varying(20) DEFAULT 'manual'::character varying NOT NULL,
    rights_status character varying(30) DEFAULT 'unknown'::character varying NOT NULL,
    source_media_id character varying(21),
    source_url text,
    cover_media_id character varying(21),
    nextcloud_source_path text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reading_books_rights_status_check CHECK (((rights_status)::text = ANY ((ARRAY['public_domain'::character varying, 'licensed'::character varying, 'member_private'::character varying, 'link_only'::character varying, 'unknown'::character varying])::text[]))),
    CONSTRAINT reading_books_source_type_check CHECK (((source_type)::text = ANY ((ARRAY['pdf'::character varying, 'epub'::character varying, 'audio'::character varying, 'manual'::character varying, 'link'::character varying])::text[])))
);


--
-- Name: reading_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reading_groups (
    id character varying(21) NOT NULL,
    org_id character varying(50) NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    visibility character varying(20) DEFAULT 'PUBLIC'::character varying NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    default_interval_days integer DEFAULT 7 NOT NULL,
    default_time_zone text DEFAULT 'America/Toronto'::text,
    nextcloud_folder_path text,
    created_by uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reading_groups_default_interval_days_check CHECK ((default_interval_days > 0)),
    CONSTRAINT reading_groups_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'paused'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT reading_groups_visibility_check CHECK (((visibility)::text = ANY ((ARRAY['PUBLIC'::character varying, 'ORGANIZATION'::character varying, 'INVITE_ONLY'::character varying])::text[])))
);


--
-- Name: reading_newsletter_issues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reading_newsletter_issues (
    id character varying(21) NOT NULL,
    org_id character varying(50) NOT NULL,
    program_id character varying(21) NOT NULL,
    unit_id character varying(21),
    source_snapshot_id character varying(21),
    title text NOT NULL,
    subject text NOT NULL,
    body_text text,
    body_html text,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    scheduled_for timestamp with time zone,
    sent_at timestamp with time zone,
    created_by uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reading_newsletter_issues_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'review'::character varying, 'scheduled'::character varying, 'sent'::character varying, 'archived'::character varying])::text[])))
);


--
-- Name: reading_note_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reading_note_snapshots (
    id character varying(21) NOT NULL,
    org_id character varying(50) NOT NULL,
    unit_id character varying(21) NOT NULL,
    source_document_url text,
    source_nextcloud_path text,
    body text DEFAULT ''::text NOT NULL,
    highlights jsonb DEFAULT '[]'::jsonb NOT NULL,
    captured_by uuid,
    captured_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: reading_programs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reading_programs (
    id character varying(21) NOT NULL,
    org_id character varying(50) NOT NULL,
    group_id character varying(21) NOT NULL,
    book_id character varying(21) NOT NULL,
    thread_id character varying(21),
    title text NOT NULL,
    slug text NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    visibility character varying(20) DEFAULT 'ORGANIZATION'::character varying NOT NULL,
    starts_on date,
    interval_days integer DEFAULT 7 NOT NULL,
    meeting_time time without time zone,
    time_zone text DEFAULT 'America/Toronto'::text,
    newsletter_enabled boolean DEFAULT true NOT NULL,
    nextcloud_folder_path text,
    created_by uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reading_programs_interval_days_check CHECK ((interval_days > 0)),
    CONSTRAINT reading_programs_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'active'::character varying, 'completed'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT reading_programs_visibility_check CHECK (((visibility)::text = ANY ((ARRAY['PUBLIC'::character varying, 'ORGANIZATION'::character varying, 'INVITE_ONLY'::character varying])::text[])))
);


--
-- Name: reading_resources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reading_resources (
    id character varying(21) NOT NULL,
    org_id character varying(50) NOT NULL,
    unit_id character varying(21) NOT NULL,
    kind character varying(20) NOT NULL,
    title text NOT NULL,
    url text,
    media_id character varying(21),
    nextcloud_path text,
    display_order integer DEFAULT 0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reading_resources_kind_check CHECK (((kind)::text = ANY ((ARRAY['youtube'::character varying, 'audio'::character varying, 'pdf'::character varying, 'link'::character varying, 'document'::character varying, 'note'::character varying])::text[])))
);


--
-- Name: reading_units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reading_units (
    id character varying(21) NOT NULL,
    org_id character varying(50) NOT NULL,
    program_id character varying(21) NOT NULL,
    sequence integer NOT NULL,
    title text NOT NULL,
    label text,
    locator text,
    starts_on date,
    meeting_thread_id character varying(21),
    discussion_thread_id character varying(21),
    notes_document_url text,
    notes_nextcloud_path text,
    newsletter_issue_id character varying(21),
    estimated_minutes integer,
    status character varying(20) DEFAULT 'planned'::character varying NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reading_units_sequence_check CHECK ((sequence > 0)),
    CONSTRAINT reading_units_status_check CHECK (((status)::text = ANY ((ARRAY['planned'::character varying, 'open'::character varying, 'completed'::character varying, 'skipped'::character varying])::text[])))
);


--
-- Name: replies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.replies (
    id character varying(21) NOT NULL,
    thread_id character varying(21) NOT NULL,
    parent_reply_id character varying(21),
    session_id character varying(21),
    user_id uuid NOT NULL,
    content text NOT NULL,
    reaction_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    edited_at timestamp with time zone
);


--
-- Name: reservation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    artwork_variant_id uuid NOT NULL,
    cart_id uuid,
    expires_at timestamp with time zone NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reservation_status_check CHECK ((status = ANY (ARRAY['active'::text, 'released'::text, 'converted'::text])))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


--
-- Name: site_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_config (
    org_id character varying(50) NOT NULL,
    key character varying(100) NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id uuid NOT NULL,
    name text,
    external_id text,
    jwt_secret text,
    max_concurrent_users integer DEFAULT 200 NOT NULL,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL,
    max_events_per_second integer DEFAULT 100 NOT NULL,
    postgres_cdc_default text DEFAULT 'postgres_cdc_rls'::text,
    max_bytes_per_second integer DEFAULT 100000 NOT NULL,
    max_channels_per_client integer DEFAULT 100 NOT NULL,
    max_joins_per_second integer DEFAULT 500 NOT NULL,
    suspend boolean DEFAULT false,
    jwt_jwks jsonb
);


--
-- Name: thread_orgs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.thread_orgs (
    thread_id text NOT NULL,
    org_id text NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    added_by uuid
);


--
-- Name: thread_references; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.thread_references (
    id text NOT NULL,
    thread_id text NOT NULL,
    references_thread_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT thread_references_no_self CHECK ((thread_id <> references_thread_id))
);


--
-- Name: thread_revisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.thread_revisions (
    id text NOT NULL,
    thread_id text NOT NULL,
    prior_kind text NOT NULL,
    snapshot jsonb NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_by uuid
);


--
-- Name: thread_rsvps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.thread_rsvps (
    thread_id character varying(21) NOT NULL,
    user_id uuid NOT NULL,
    status character varying(20) DEFAULT 'yes'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT thread_rsvps_status_check CHECK (((status)::text = ANY ((ARRAY['yes'::character varying, 'no'::character varying, 'maybe'::character varying, 'waitlist'::character varying])::text[])))
);


--
-- Name: thread_topics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.thread_topics (
    thread_id character varying(21) NOT NULL,
    topic_id character varying(21) NOT NULL
);


--
-- Name: threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.threads (
    id character varying(21) NOT NULL,
    org_id character varying(50) NOT NULL,
    author_id uuid NOT NULL,
    kind character varying(20) NOT NULL,
    title text NOT NULL,
    slug character varying(255) NOT NULL,
    body text,
    excerpt text,
    drawing jsonb,
    status character varying(20) DEFAULT 'published'::character varying NOT NULL,
    visibility character varying(20) DEFAULT 'PUBLIC'::character varying NOT NULL,
    share_to_network boolean DEFAULT false NOT NULL,
    pinned boolean DEFAULT false NOT NULL,
    locked boolean DEFAULT false NOT NULL,
    section character varying(30),
    scheduled_at timestamp with time zone,
    duration_minutes integer,
    location text,
    is_online boolean DEFAULT false,
    meeting_url text,
    attendee_limit integer,
    recurrence_pattern character varying(20),
    recurrence_custom_rule text,
    recurrence_until timestamp with time zone,
    is_rsvp_enabled boolean DEFAULT false NOT NULL,
    rsvp_deadline timestamp with time zone,
    min_attendees integer,
    notify_on_min_attendees boolean DEFAULT false NOT NULL,
    min_attendees_notified boolean DEFAULT false NOT NULL,
    nextcloud_file_id character varying(255),
    nextcloud_talk_token character varying(255),
    nextcloud_recording_id character varying(255),
    nextcloud_last_sync timestamp with time zone,
    document_url text,
    video_url text,
    show_in_live_feed boolean DEFAULT false NOT NULL,
    view_count integer DEFAULT 0 NOT NULL,
    reply_count integer DEFAULT 0 NOT NULL,
    reaction_count integer DEFAULT 0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_meeting boolean DEFAULT false NOT NULL,
    price numeric(10,2),
    currency character varying(3) DEFAULT 'USD'::character varying,
    sessions jsonb DEFAULT '[]'::jsonb,
    nextcloud_doc_url text,
    format character varying(20) DEFAULT 'online'::character varying,
    CONSTRAINT threads_format_check CHECK (((format)::text = ANY ((ARRAY['in_person'::character varying, 'online'::character varying, 'hybrid'::character varying])::text[]))),
    CONSTRAINT threads_kind_check CHECK (((kind)::text = ANY ((ARRAY['meeting'::character varying, 'workshop'::character varying, 'event'::character varying, 'post'::character varying])::text[]))),
    CONSTRAINT threads_recurrence_pattern_check CHECK (((recurrence_pattern IS NULL) OR ((recurrence_pattern)::text = ANY ((ARRAY['DAILY'::character varying, 'WEEKLY'::character varying, 'MONTHLY'::character varying, 'CUSTOM'::character varying])::text[])))),
    CONSTRAINT threads_section_check CHECK (((section IS NULL) OR ((section)::text = ANY ((ARRAY['amrit_vela'::character varying, 'yoga'::character varying, 'gurdwara'::character varying])::text[])))),
    CONSTRAINT threads_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'published'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT threads_visibility_check CHECK (((visibility)::text = ANY ((ARRAY['PUBLIC'::character varying, 'ORGANIZATION'::character varying, 'INVITE_ONLY'::character varying])::text[])))
);


--
-- Name: COLUMN threads.is_online; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.threads.is_online IS 'DEPRECATED: use threads.format instead. Will be dropped after migration 038 code rollout.';


--
-- Name: COLUMN threads.price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.threads.price IS 'Optional price for kind=workshop/event. Null = free or not advertised.';


--
-- Name: COLUMN threads.sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.threads.sessions IS 'Optional array of sessions for kind=workshop. Each item: {id,title,scheduled_at,duration_minutes,location,meeting_url}';


--
-- Name: COLUMN threads.nextcloud_doc_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.threads.nextcloud_doc_url IS 'Optional link to a Nextcloud collaborative document attached to this thread.';


--
-- Name: topics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.topics (
    id character varying(21) NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    description text,
    parent_id character varying(21),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_organizations (
    user_id uuid NOT NULL,
    org_id character varying(50) NOT NULL,
    role character varying(20) DEFAULT 'member'::character varying,
    joined_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_organizations_role_check CHECK (((role)::text = ANY ((ARRAY['owner'::character varying, 'guide'::character varying, 'member'::character varying, 'viewer'::character varying])::text[])))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email character varying(255),
    display_name character varying(255),
    avatar_url text,
    bio text,
    is_admin boolean DEFAULT false,
    nextcloud_user_id character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    trust_level integer DEFAULT 0,
    last_seen_at timestamp with time zone DEFAULT now(),
    nextcloud_app_password character varying(500),
    nextcloud_synced boolean DEFAULT false,
    oidc_subject character varying(255),
    oidc_issuer character varying(500),
    nextcloud_oidc_synced boolean DEFAULT false,
    auth_user_id uuid NOT NULL,
    comment_color character varying(7),
    network_tier character varying(20) DEFAULT 'member'::character varying NOT NULL,
    signup_details jsonb,
    CONSTRAINT users_auth_user_id_matches_id CHECK ((auth_user_id = id)),
    CONSTRAINT users_network_tier_check CHECK (((network_tier)::text = ANY ((ARRAY['member'::character varying, 'host'::character varying, 'partner'::character varying])::text[]))),
    CONSTRAINT users_trust_level_check CHECK (((trust_level >= 0) AND (trust_level <= 4)))
);


--
-- Name: COLUMN users.nextcloud_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.nextcloud_user_id IS 'Nextcloud username (typically same as EAC user UUID)';


--
-- Name: COLUMN users.trust_level; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.trust_level IS 'Trust level: 0=new, 1=basic, 2=member, 3=regular, 4=leader/guide';


--
-- Name: COLUMN users.nextcloud_app_password; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.nextcloud_app_password IS 'Encrypted Nextcloud app password for API access (generated on first login)';


--
-- Name: COLUMN users.nextcloud_synced; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.nextcloud_synced IS 'Whether user account has been provisioned in Nextcloud';


--
-- Name: COLUMN users.oidc_subject; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.oidc_subject IS 'OIDC subject identifier (sub claim) for SSO mapping';


--
-- Name: COLUMN users.oidc_issuer; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.oidc_issuer IS 'OIDC issuer URL for multi-provider support';


--
-- Name: COLUMN users.nextcloud_oidc_synced; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.nextcloud_oidc_synced IS 'Whether user has been provisioned in Nextcloud via OIDC';


--
-- Name: user_profiles; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.user_profiles AS
 SELECT u.id,
    u.email,
    u.display_name,
    u.avatar_url,
    u.bio,
    u.is_admin,
    u.nextcloud_user_id,
    u.created_at,
    u.updated_at,
    u.trust_level,
    u.last_seen_at,
    u.nextcloud_app_password,
    u.nextcloud_synced,
    u.oidc_subject,
    u.oidc_issuer,
    u.nextcloud_oidc_synced,
    u.auth_user_id,
    au.email AS auth_email,
    au.created_at AS auth_created_at,
    au.last_sign_in_at,
    au.raw_user_meta_data
   FROM (public.users u
     LEFT JOIN auth.users au ON ((u.auth_user_id = au.id)));


--
-- Name: watches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.watches (
    thread_id character varying(21) NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: work_question_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_question_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question_id uuid NOT NULL,
    user_id text,
    display_name text,
    response text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: work_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id text DEFAULT 'inner_group'::text NOT NULL,
    question text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: workshop_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workshop_details (
    thread_id character varying(21) NOT NULL,
    instructor_bio text,
    pricing jsonb,
    capacity integer,
    materials text,
    prerequisites text,
    what_to_bring text,
    cover_image_url text,
    show_on_workshops_page boolean DEFAULT false NOT NULL,
    workshop_order integer,
    subtitle character varying(255),
    card_colour character varying(7),
    card_accent_colour character varying(7),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: workshop_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workshop_pages (
    thread_id character varying(21) NOT NULL,
    subtitle text,
    description_short text,
    discipline character varying(80),
    series_label character varying(80),
    level character varying(20),
    language character varying(60) DEFAULT 'English'::character varying NOT NULL,
    session_count integer,
    session_duration_hrs numeric(4,2),
    recurrence_label text,
    location_address text,
    accessibility_notes text,
    price_sliding_min numeric(10,2),
    price_member numeric(10,2),
    sliding_scale_note text,
    registration_url text,
    registration_deadline date,
    registration_status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    author_note text,
    cover_image_url text,
    gallery_image_urls jsonb DEFAULT '[]'::jsonb NOT NULL,
    promo_video_url text,
    seo_title text,
    seo_description character varying(160),
    og_image_url text,
    optional_sections jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    theme_overrides jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT workshop_pages_level_check CHECK (((level)::text = ANY ((ARRAY['all_levels'::character varying, 'beginner'::character varying, 'intermediate'::character varying, 'advanced'::character varying])::text[]))),
    CONSTRAINT workshop_pages_registration_status_check CHECK (((registration_status)::text = ANY ((ARRAY['open'::character varying, 'waitlist'::character varying, 'full'::character varying, 'closed'::character varying])::text[])))
);


--
-- Name: TABLE workshop_pages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.workshop_pages IS 'Template-filling data for workshop threads. One row per thread where kind=''workshop''. Owned by the template editor and the workshop CMS form. Separate from threads to keep the generic thread row lean.';


--
-- Name: workshop_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workshop_sessions (
    id character varying(21) NOT NULL,
    thread_id character varying(21) NOT NULL,
    session_number integer NOT NULL,
    topic text,
    scheduled_at timestamp with time zone,
    duration_minutes integer,
    notes jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: landing_inquiries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_inquiries ALTER COLUMN id SET DEFAULT nextval('public.landing_inquiries_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: app_schema_migrations app_schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_schema_migrations
    ADD CONSTRAINT app_schema_migrations_pkey PRIMARY KEY (filename);


--
-- Name: artist_profiles artist_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artist_profiles
    ADD CONSTRAINT artist_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: artwork_media artwork_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artwork_media
    ADD CONSTRAINT artwork_media_pkey PRIMARY KEY (id);


--
-- Name: artwork artwork_org_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artwork
    ADD CONSTRAINT artwork_org_id_slug_key UNIQUE (org_id, slug);


--
-- Name: artwork artwork_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artwork
    ADD CONSTRAINT artwork_pkey PRIMARY KEY (id);


--
-- Name: artwork_variant artwork_variant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artwork_variant
    ADD CONSTRAINT artwork_variant_pkey PRIMARY KEY (id);


--
-- Name: auction_lot auction_lot_artwork_variant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auction_lot
    ADD CONSTRAINT auction_lot_artwork_variant_id_key UNIQUE (artwork_variant_id);


--
-- Name: auction_lot auction_lot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auction_lot
    ADD CONSTRAINT auction_lot_pkey PRIMARY KEY (id);


--
-- Name: availability_poll_options availability_poll_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_poll_options
    ADD CONSTRAINT availability_poll_options_pkey PRIMARY KEY (id);


--
-- Name: availability_poll_responses availability_poll_responses_option_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_poll_responses
    ADD CONSTRAINT availability_poll_responses_option_id_user_id_key UNIQUE (option_id, user_id);


--
-- Name: availability_poll_responses availability_poll_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_poll_responses
    ADD CONSTRAINT availability_poll_responses_pkey PRIMARY KEY (id);


--
-- Name: availability_polls availability_polls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_polls
    ADD CONSTRAINT availability_polls_pkey PRIMARY KEY (id);


--
-- Name: availability_responses availability_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_responses
    ADD CONSTRAINT availability_responses_pkey PRIMARY KEY (id);


--
-- Name: availability_slots availability_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_slots
    ADD CONSTRAINT availability_slots_pkey PRIMARY KEY (response_id, time_slot);


--
-- Name: bid bid_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bid
    ADD CONSTRAINT bid_pkey PRIMARY KEY (id);


--
-- Name: bookmarks bookmarks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_pkey PRIMARY KEY (id);


--
-- Name: cart_line cart_line_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_line
    ADD CONSTRAINT cart_line_pkey PRIMARY KEY (id);


--
-- Name: cart cart_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart
    ADD CONSTRAINT cart_pkey PRIMARY KEY (id);


--
-- Name: cart cart_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart
    ADD CONSTRAINT cart_token_key UNIQUE (token);


--
-- Name: commerce_order_line commerce_order_line_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_order_line
    ADD CONSTRAINT commerce_order_line_pkey PRIMARY KEY (id);


--
-- Name: commerce_order commerce_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_order
    ADD CONSTRAINT commerce_order_number_key UNIQUE (number);


--
-- Name: commerce_order commerce_order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_order
    ADD CONSTRAINT commerce_order_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: content_drafts content_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_drafts
    ADD CONSTRAINT content_drafts_pkey PRIMARY KEY (id);


--
-- Name: email_template_settings email_template_settings_org_id_template_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_template_settings
    ADD CONSTRAINT email_template_settings_org_id_template_key_key UNIQUE (org_id, template_key);


--
-- Name: email_template_settings email_template_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_template_settings
    ADD CONSTRAINT email_template_settings_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: extensions extensions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extensions
    ADD CONSTRAINT extensions_pkey PRIMARY KEY (id);


--
-- Name: flags flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flags
    ADD CONSTRAINT flags_pkey PRIMARY KEY (id);


--
-- Name: guest_submissions guest_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guest_submissions
    ADD CONSTRAINT guest_submissions_pkey PRIMARY KEY (id);


--
-- Name: guestbook_entries guestbook_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guestbook_entries
    ADD CONSTRAINT guestbook_entries_pkey PRIMARY KEY (id);


--
-- Name: inquiry inquiry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiry
    ADD CONSTRAINT inquiry_pkey PRIMARY KEY (id);


--
-- Name: landing_inquiries landing_inquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_inquiries
    ADD CONSTRAINT landing_inquiries_pkey PRIMARY KEY (id);


--
-- Name: marketplace_artists marketplace_artists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_artists
    ADD CONSTRAINT marketplace_artists_pkey PRIMARY KEY (user_id);


--
-- Name: media media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_pkey PRIMARY KEY (id);


--
-- Name: moderation_log moderation_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_log
    ADD CONSTRAINT moderation_log_pkey PRIMARY KEY (id);


--
-- Name: nextcloud_events nextcloud_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nextcloud_events
    ADD CONSTRAINT nextcloud_events_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: oidc_codes oidc_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oidc_codes
    ADD CONSTRAINT oidc_codes_pkey PRIMARY KEY (code);


--
-- Name: org_site_sections org_site_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_site_sections
    ADD CONSTRAINT org_site_sections_pkey PRIMARY KEY (org_id, section_key);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: payout payout_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout
    ADD CONSTRAINT payout_pkey PRIMARY KEY (id);


--
-- Name: poll_options poll_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_options
    ADD CONSTRAINT poll_options_pkey PRIMARY KEY (id);


--
-- Name: poll_votes poll_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_votes
    ADD CONSTRAINT poll_votes_pkey PRIMARY KEY (id);


--
-- Name: question_poll_options question_poll_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_poll_options
    ADD CONSTRAINT question_poll_options_pkey PRIMARY KEY (id);


--
-- Name: question_poll_votes question_poll_votes_option_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_poll_votes
    ADD CONSTRAINT question_poll_votes_option_id_user_id_key UNIQUE (option_id, user_id);


--
-- Name: question_poll_votes question_poll_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_poll_votes
    ADD CONSTRAINT question_poll_votes_pkey PRIMARY KEY (id);


--
-- Name: question_polls question_polls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_polls
    ADD CONSTRAINT question_polls_pkey PRIMARY KEY (id);


--
-- Name: reactions reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_pkey PRIMARY KEY (id);


--
-- Name: reading_books reading_books_org_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_books
    ADD CONSTRAINT reading_books_org_id_slug_key UNIQUE (org_id, slug);


--
-- Name: reading_books reading_books_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_books
    ADD CONSTRAINT reading_books_pkey PRIMARY KEY (id);


--
-- Name: reading_groups reading_groups_org_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_groups
    ADD CONSTRAINT reading_groups_org_id_key UNIQUE (org_id);


--
-- Name: reading_groups reading_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_groups
    ADD CONSTRAINT reading_groups_pkey PRIMARY KEY (id);


--
-- Name: reading_groups reading_groups_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_groups
    ADD CONSTRAINT reading_groups_slug_key UNIQUE (slug);


--
-- Name: reading_newsletter_issues reading_newsletter_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_newsletter_issues
    ADD CONSTRAINT reading_newsletter_issues_pkey PRIMARY KEY (id);


--
-- Name: reading_note_snapshots reading_note_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_note_snapshots
    ADD CONSTRAINT reading_note_snapshots_pkey PRIMARY KEY (id);


--
-- Name: reading_programs reading_programs_org_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_programs
    ADD CONSTRAINT reading_programs_org_id_slug_key UNIQUE (org_id, slug);


--
-- Name: reading_programs reading_programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_programs
    ADD CONSTRAINT reading_programs_pkey PRIMARY KEY (id);


--
-- Name: reading_resources reading_resources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_resources
    ADD CONSTRAINT reading_resources_pkey PRIMARY KEY (id);


--
-- Name: reading_units reading_units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_units
    ADD CONSTRAINT reading_units_pkey PRIMARY KEY (id);


--
-- Name: reading_units reading_units_program_id_sequence_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_units
    ADD CONSTRAINT reading_units_program_id_sequence_key UNIQUE (program_id, sequence);


--
-- Name: replies replies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.replies
    ADD CONSTRAINT replies_pkey PRIMARY KEY (id);


--
-- Name: reservation reservation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation
    ADD CONSTRAINT reservation_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: site_config site_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_config
    ADD CONSTRAINT site_config_pkey PRIMARY KEY (org_id, key);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: thread_orgs thread_orgs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_orgs
    ADD CONSTRAINT thread_orgs_pkey PRIMARY KEY (thread_id, org_id);


--
-- Name: thread_references thread_references_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_references
    ADD CONSTRAINT thread_references_pkey PRIMARY KEY (id);


--
-- Name: thread_references thread_references_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_references
    ADD CONSTRAINT thread_references_unique UNIQUE (thread_id, references_thread_id);


--
-- Name: thread_revisions thread_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_revisions
    ADD CONSTRAINT thread_revisions_pkey PRIMARY KEY (id);


--
-- Name: thread_rsvps thread_rsvps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_rsvps
    ADD CONSTRAINT thread_rsvps_pkey PRIMARY KEY (thread_id, user_id);


--
-- Name: thread_topics thread_topics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_topics
    ADD CONSTRAINT thread_topics_pkey PRIMARY KEY (thread_id, topic_id);


--
-- Name: threads threads_org_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_org_id_slug_key UNIQUE (org_id, slug);


--
-- Name: threads threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_pkey PRIMARY KEY (id);


--
-- Name: topics topics_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_name_key UNIQUE (name);


--
-- Name: topics topics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_pkey PRIMARY KEY (id);


--
-- Name: topics topics_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_slug_key UNIQUE (slug);


--
-- Name: user_organizations user_organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_organizations
    ADD CONSTRAINT user_organizations_pkey PRIMARY KEY (user_id, org_id);


--
-- Name: users users_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_auth_user_id_key UNIQUE (auth_user_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: watches watches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watches
    ADD CONSTRAINT watches_pkey PRIMARY KEY (thread_id, user_id);


--
-- Name: work_question_responses work_question_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_question_responses
    ADD CONSTRAINT work_question_responses_pkey PRIMARY KEY (id);


--
-- Name: work_questions work_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_questions
    ADD CONSTRAINT work_questions_pkey PRIMARY KEY (id);


--
-- Name: workshop_details workshop_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workshop_details
    ADD CONSTRAINT workshop_details_pkey PRIMARY KEY (thread_id);


--
-- Name: workshop_pages workshop_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workshop_pages
    ADD CONSTRAINT workshop_pages_pkey PRIMARY KEY (thread_id);


--
-- Name: workshop_sessions workshop_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workshop_sessions
    ADD CONSTRAINT workshop_sessions_pkey PRIMARY KEY (id);


--
-- Name: workshop_sessions workshop_sessions_thread_id_session_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workshop_sessions
    ADD CONSTRAINT workshop_sessions_thread_id_session_number_key UNIQUE (thread_id, session_number);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: schema_migrations_version_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX schema_migrations_version_idx ON auth.schema_migrations USING btree (version);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: bookmarks_unique_on_reply; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX bookmarks_unique_on_reply ON public.bookmarks USING btree (user_id, reply_id) WHERE (reply_id IS NOT NULL);


--
-- Name: bookmarks_unique_on_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX bookmarks_unique_on_thread ON public.bookmarks USING btree (user_id, thread_id) WHERE (reply_id IS NULL);


--
-- Name: extensions_tenant_external_id_type_index; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX extensions_tenant_external_id_type_index ON public.extensions USING btree (tenant_external_id, type);


--
-- Name: idx_artist_profiles_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artist_profiles_org ON public.artist_profiles USING btree (org_id);


--
-- Name: idx_artwork_artist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artwork_artist ON public.artwork USING btree (artist_user_id);


--
-- Name: idx_artwork_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artwork_created ON public.artwork USING btree (created_at DESC);


--
-- Name: idx_artwork_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artwork_kind ON public.artwork USING btree (kind);


--
-- Name: idx_artwork_media_artwork; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artwork_media_artwork ON public.artwork_media USING btree (artwork_id);


--
-- Name: idx_artwork_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artwork_org ON public.artwork USING btree (org_id);


--
-- Name: idx_artwork_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artwork_status ON public.artwork USING btree (status) WHERE (status = 'available'::text);


--
-- Name: idx_artwork_variant_artwork; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artwork_variant_artwork ON public.artwork_variant USING btree (artwork_id);


--
-- Name: idx_artwork_variant_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artwork_variant_org ON public.artwork_variant USING btree (org_id);


--
-- Name: idx_auction_lot_end; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auction_lot_end ON public.auction_lot USING btree (end_at) WHERE (status = ANY (ARRAY['scheduled'::text, 'live'::text]));


--
-- Name: idx_auction_lot_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auction_lot_org ON public.auction_lot USING btree (org_id);


--
-- Name: idx_auction_lot_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auction_lot_status ON public.auction_lot USING btree (status);


--
-- Name: idx_availability_options_poll; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_availability_options_poll ON public.availability_poll_options USING btree (poll_id);


--
-- Name: idx_availability_polls_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_availability_polls_thread ON public.availability_polls USING btree (thread_id);


--
-- Name: idx_availability_responses_poll; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_availability_responses_poll ON public.availability_poll_responses USING btree (poll_id);


--
-- Name: idx_availability_responses_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_availability_responses_user ON public.availability_poll_responses USING btree (user_id);


--
-- Name: idx_bid_bidder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bid_bidder ON public.bid USING btree (bidder_id);


--
-- Name: idx_bid_lot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bid_lot ON public.bid USING btree (lot_id, placed_at DESC);


--
-- Name: idx_bid_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bid_status ON public.bid USING btree (lot_id, status);


--
-- Name: idx_bookmarks_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookmarks_thread ON public.bookmarks USING btree (thread_id);


--
-- Name: idx_bookmarks_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookmarks_user ON public.bookmarks USING btree (user_id);


--
-- Name: idx_cart_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cart_expires ON public.cart USING btree (expires_at) WHERE (expires_at IS NOT NULL);


--
-- Name: idx_cart_line_cart; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cart_line_cart ON public.cart_line USING btree (cart_id);


--
-- Name: idx_cart_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cart_user ON public.cart USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_contacts_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_email ON public.contacts USING btree (email);


--
-- Name: idx_contacts_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_org ON public.contacts USING btree (org_id);


--
-- Name: idx_contacts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_status ON public.contacts USING btree (org_id, status);


--
-- Name: idx_contacts_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_user ON public.contacts USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_drafts_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drafts_updated ON public.content_drafts USING btree (updated_at DESC);


--
-- Name: idx_drafts_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drafts_user ON public.content_drafts USING btree (user_id);


--
-- Name: idx_email_template_settings_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_template_settings_org ON public.email_template_settings USING btree (org_id);


--
-- Name: idx_email_template_settings_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_template_settings_template ON public.email_template_settings USING btree (template_key);


--
-- Name: idx_events_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_created ON public.events USING btree (created_at DESC);


--
-- Name: idx_events_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_org ON public.events USING btree (org_id);


--
-- Name: idx_events_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_user ON public.events USING btree (user_id);


--
-- Name: idx_flags_open; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_flags_open ON public.flags USING btree (created_at DESC) WHERE ((status)::text = 'open'::text);


--
-- Name: idx_flags_reporter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_flags_reporter ON public.flags USING btree (reporter_id);


--
-- Name: idx_flags_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_flags_target ON public.flags USING btree (target_kind, target_id);


--
-- Name: idx_guest_submissions_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_guest_submissions_created ON public.guest_submissions USING btree (created_at DESC);


--
-- Name: idx_guest_submissions_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_guest_submissions_email ON public.guest_submissions USING btree (email) WHERE (email IS NOT NULL);


--
-- Name: idx_guest_submissions_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_guest_submissions_kind ON public.guest_submissions USING btree (kind);


--
-- Name: idx_guest_submissions_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_guest_submissions_thread ON public.guest_submissions USING btree (thread_id) WHERE (thread_id IS NOT NULL);


--
-- Name: idx_guestbook_entries_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_guestbook_entries_org ON public.guestbook_entries USING btree (org_id, created_at DESC);


--
-- Name: idx_inquiry_artwork; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inquiry_artwork ON public.inquiry USING btree (artwork_id);


--
-- Name: idx_inquiry_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inquiry_status ON public.inquiry USING btree (status);


--
-- Name: idx_landing_inquiries_org_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_landing_inquiries_org_created ON public.landing_inquiries USING btree (org_id, created_at DESC);


--
-- Name: idx_marketplace_artists_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketplace_artists_org ON public.marketplace_artists USING btree (org_id);


--
-- Name: idx_marketplace_artists_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketplace_artists_status ON public.marketplace_artists USING btree (status);


--
-- Name: idx_media_attached; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_attached ON public.media USING btree (attached_to_type, attached_to_id);


--
-- Name: idx_media_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_org ON public.media USING btree (org_id);


--
-- Name: idx_moderation_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_moderation_created ON public.moderation_log USING btree (created_at DESC);


--
-- Name: idx_moderation_moderator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_moderation_moderator ON public.moderation_log USING btree (moderator_id);


--
-- Name: idx_moderation_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_moderation_target ON public.moderation_log USING btree (target_kind, target_id);


--
-- Name: idx_nextcloud_events_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nextcloud_events_resource ON public.nextcloud_events USING btree (resource_type, resource_id);


--
-- Name: idx_nextcloud_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nextcloud_events_type ON public.nextcloud_events USING btree (event_type, created_at);


--
-- Name: idx_nextcloud_events_unprocessed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nextcloud_events_unprocessed ON public.nextcloud_events USING btree (processed, created_at) WHERE (processed = false);


--
-- Name: idx_notifications_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_thread ON public.notifications USING btree (thread_id) WHERE (thread_id IS NOT NULL);


--
-- Name: idx_notifications_user_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id, created_at DESC) WHERE (read_at IS NULL);


--
-- Name: idx_oidc_codes_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oidc_codes_expires_at ON public.oidc_codes USING btree (expires_at);


--
-- Name: idx_oidc_codes_expires_at_nonce; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oidc_codes_expires_at_nonce ON public.oidc_codes USING btree (expires_at) WHERE (nonce IS NOT NULL);


--
-- Name: idx_order_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_created ON public.commerce_order USING btree (created_at DESC);


--
-- Name: idx_order_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_customer ON public.commerce_order USING btree (customer_id) WHERE (customer_id IS NOT NULL);


--
-- Name: idx_order_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_email ON public.commerce_order USING btree (customer_email);


--
-- Name: idx_order_line_artist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_line_artist ON public.commerce_order_line USING btree (artist_user_id);


--
-- Name: idx_order_line_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_line_order ON public.commerce_order_line USING btree (order_id);


--
-- Name: idx_order_line_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_line_org ON public.commerce_order_line USING btree (org_id);


--
-- Name: idx_order_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_status ON public.commerce_order USING btree (status);


--
-- Name: idx_org_site_sections_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_site_sections_org ON public.org_site_sections USING btree (org_id);


--
-- Name: idx_org_site_sections_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_site_sections_updated ON public.org_site_sections USING btree (org_id, updated_at DESC);


--
-- Name: idx_payout_artist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payout_artist ON public.payout USING btree (artist_user_id);


--
-- Name: idx_payout_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payout_status ON public.payout USING btree (status);


--
-- Name: idx_poll_options_poll; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_poll_options_poll ON public.poll_options USING btree (poll_id);


--
-- Name: idx_poll_votes_option; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_poll_votes_option ON public.poll_votes USING btree (option_id);


--
-- Name: idx_poll_votes_poll; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_poll_votes_poll ON public.poll_votes USING btree (poll_id);


--
-- Name: idx_poll_votes_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_poll_votes_unique ON public.poll_votes USING btree (poll_id, option_id, user_id);


--
-- Name: idx_poll_votes_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_poll_votes_user ON public.poll_votes USING btree (user_id);


--
-- Name: idx_question_options_poll; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_question_options_poll ON public.question_poll_options USING btree (poll_id);


--
-- Name: idx_question_polls_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_question_polls_thread ON public.question_polls USING btree (thread_id);


--
-- Name: idx_question_votes_poll; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_question_votes_poll ON public.question_poll_votes USING btree (poll_id);


--
-- Name: idx_question_votes_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_question_votes_user ON public.question_poll_votes USING btree (user_id);


--
-- Name: idx_reactions_reply; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reactions_reply ON public.reactions USING btree (reply_id) WHERE (reply_id IS NOT NULL);


--
-- Name: idx_reactions_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reactions_thread ON public.reactions USING btree (thread_id);


--
-- Name: idx_reactions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reactions_user ON public.reactions USING btree (user_id);


--
-- Name: idx_reading_books_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reading_books_org ON public.reading_books USING btree (org_id);


--
-- Name: idx_reading_books_rights; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reading_books_rights ON public.reading_books USING btree (rights_status);


--
-- Name: idx_reading_groups_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reading_groups_org ON public.reading_groups USING btree (org_id);


--
-- Name: idx_reading_groups_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reading_groups_status ON public.reading_groups USING btree (status);


--
-- Name: idx_reading_newsletter_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reading_newsletter_org ON public.reading_newsletter_issues USING btree (org_id, status);


--
-- Name: idx_reading_newsletter_program; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reading_newsletter_program ON public.reading_newsletter_issues USING btree (program_id, created_at DESC);


--
-- Name: idx_reading_note_snapshots_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reading_note_snapshots_org ON public.reading_note_snapshots USING btree (org_id, captured_at DESC);


--
-- Name: idx_reading_note_snapshots_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reading_note_snapshots_unit ON public.reading_note_snapshots USING btree (unit_id, captured_at DESC);


--
-- Name: idx_reading_programs_book; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reading_programs_book ON public.reading_programs USING btree (book_id);


--
-- Name: idx_reading_programs_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reading_programs_group ON public.reading_programs USING btree (group_id);


--
-- Name: idx_reading_programs_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reading_programs_org ON public.reading_programs USING btree (org_id);


--
-- Name: idx_reading_programs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reading_programs_status ON public.reading_programs USING btree (status);


--
-- Name: idx_reading_resources_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reading_resources_org ON public.reading_resources USING btree (org_id);


--
-- Name: idx_reading_resources_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reading_resources_unit ON public.reading_resources USING btree (unit_id, display_order);


--
-- Name: idx_reading_units_meeting; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reading_units_meeting ON public.reading_units USING btree (meeting_thread_id);


--
-- Name: idx_reading_units_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reading_units_org ON public.reading_units USING btree (org_id);


--
-- Name: idx_reading_units_program; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reading_units_program ON public.reading_units USING btree (program_id, sequence);


--
-- Name: idx_replies_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_replies_created ON public.replies USING btree (created_at DESC);


--
-- Name: idx_replies_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_replies_parent ON public.replies USING btree (parent_reply_id) WHERE (parent_reply_id IS NOT NULL);


--
-- Name: idx_replies_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_replies_session ON public.replies USING btree (session_id) WHERE (session_id IS NOT NULL);


--
-- Name: idx_replies_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_replies_thread ON public.replies USING btree (thread_id);


--
-- Name: idx_replies_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_replies_user ON public.replies USING btree (user_id);


--
-- Name: idx_reservation_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservation_active ON public.reservation USING btree (artwork_variant_id) WHERE (status = 'active'::text);


--
-- Name: idx_reservation_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservation_expires ON public.reservation USING btree (expires_at) WHERE (status = 'active'::text);


--
-- Name: idx_responses_poll; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_responses_poll ON public.availability_responses USING btree (poll_id);


--
-- Name: idx_responses_unique_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_responses_unique_user ON public.availability_responses USING btree (poll_id, user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_responses_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_responses_user ON public.availability_responses USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_site_config_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_config_org ON public.site_config USING btree (org_id);


--
-- Name: idx_slots_response; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slots_response ON public.availability_slots USING btree (response_id);


--
-- Name: idx_slots_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slots_time ON public.availability_slots USING btree (time_slot);


--
-- Name: idx_thread_orgs_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thread_orgs_org ON public.thread_orgs USING btree (org_id);


--
-- Name: idx_thread_references_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thread_references_target ON public.thread_references USING btree (references_thread_id);


--
-- Name: idx_thread_revisions_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thread_revisions_thread ON public.thread_revisions USING btree (thread_id, changed_at DESC);


--
-- Name: idx_thread_rsvps_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thread_rsvps_user ON public.thread_rsvps USING btree (user_id);


--
-- Name: idx_thread_topics_topic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thread_topics_topic ON public.thread_topics USING btree (topic_id);


--
-- Name: idx_threads_author; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threads_author ON public.threads USING btree (author_id);


--
-- Name: idx_threads_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threads_kind ON public.threads USING btree (kind);


--
-- Name: idx_threads_kind_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threads_kind_status ON public.threads USING btree (kind, status, published_at DESC);


--
-- Name: idx_threads_live_feed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threads_live_feed ON public.threads USING btree (show_in_live_feed) WHERE (show_in_live_feed = true);


--
-- Name: idx_threads_network; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threads_network ON public.threads USING btree (share_to_network, published_at DESC) WHERE ((share_to_network = true) AND ((status)::text = 'published'::text));


--
-- Name: idx_threads_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threads_org ON public.threads USING btree (org_id);


--
-- Name: idx_threads_pinned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threads_pinned ON public.threads USING btree (pinned) WHERE (pinned = true);


--
-- Name: idx_threads_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threads_published ON public.threads USING btree (published_at DESC) WHERE ((status)::text = 'published'::text);


--
-- Name: idx_threads_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threads_scheduled ON public.threads USING btree (scheduled_at) WHERE (scheduled_at IS NOT NULL);


--
-- Name: idx_threads_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threads_section ON public.threads USING btree (section) WHERE (section IS NOT NULL);


--
-- Name: idx_topics_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_topics_parent ON public.topics USING btree (parent_id);


--
-- Name: idx_users_auth_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_auth_user_id ON public.users USING btree (auth_user_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_last_seen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_last_seen ON public.users USING btree (last_seen_at DESC);


--
-- Name: idx_users_nextcloud_oidc_synced; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_nextcloud_oidc_synced ON public.users USING btree (nextcloud_oidc_synced) WHERE (nextcloud_oidc_synced = false);


--
-- Name: idx_users_nextcloud_synced; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_nextcloud_synced ON public.users USING btree (nextcloud_synced) WHERE (nextcloud_synced = true);


--
-- Name: idx_users_nextcloud_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_nextcloud_user ON public.users USING btree (nextcloud_user_id) WHERE (nextcloud_user_id IS NOT NULL);


--
-- Name: idx_users_nextcloud_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_nextcloud_user_id ON public.users USING btree (nextcloud_user_id) WHERE (nextcloud_user_id IS NOT NULL);


--
-- Name: idx_users_oidc_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_users_oidc_subject ON public.users USING btree (oidc_subject) WHERE (oidc_subject IS NOT NULL);


--
-- Name: idx_users_trust_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_trust_level ON public.users USING btree (trust_level);


--
-- Name: idx_watches_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_watches_user ON public.watches USING btree (user_id);


--
-- Name: idx_work_question_responses_question; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_question_responses_question ON public.work_question_responses USING btree (question_id, created_at DESC);


--
-- Name: idx_work_questions_org_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_questions_org_active ON public.work_questions USING btree (org_id, is_active, created_at DESC);


--
-- Name: idx_workshop_details_showcase; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workshop_details_showcase ON public.workshop_details USING btree (show_on_workshops_page, workshop_order) WHERE (show_on_workshops_page = true);


--
-- Name: idx_workshop_sessions_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workshop_sessions_thread ON public.workshop_sessions USING btree (thread_id);


--
-- Name: reactions_unique_on_reply; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX reactions_unique_on_reply ON public.reactions USING btree (reply_id, user_id, kind) WHERE (reply_id IS NOT NULL);


--
-- Name: reactions_unique_on_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX reactions_unique_on_thread ON public.reactions USING btree (thread_id, user_id, kind) WHERE (reply_id IS NULL);


--
-- Name: tenants_external_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tenants_external_id_index ON public.tenants USING btree (external_id);


--
-- Name: users_auth_user_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_auth_user_id_unique ON public.users USING btree (auth_user_id) WHERE (auth_user_id IS NOT NULL);


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


--
-- Name: users on_auth_user_created_role; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER on_auth_user_created_role BEFORE INSERT OR UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION auth.handle_new_user_role();


--
-- Name: artist_profiles trg_artist_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_artist_profiles_updated_at BEFORE UPDATE ON public.artist_profiles FOR EACH ROW EXECUTE FUNCTION public.artist_profiles_touch_updated_at();


--
-- Name: artwork trg_artwork_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_artwork_touch BEFORE UPDATE ON public.artwork FOR EACH ROW EXECUTE FUNCTION public.commerce_touch_updated_at();


--
-- Name: auction_lot trg_auction_lot_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auction_lot_touch BEFORE UPDATE ON public.auction_lot FOR EACH ROW EXECUTE FUNCTION public.commerce_touch_updated_at();


--
-- Name: cart trg_cart_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cart_touch BEFORE UPDATE ON public.cart FOR EACH ROW EXECUTE FUNCTION public.commerce_touch_updated_at();


--
-- Name: commerce_order trg_commerce_order_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_commerce_order_touch BEFORE UPDATE ON public.commerce_order FOR EACH ROW EXECUTE FUNCTION public.commerce_touch_updated_at();


--
-- Name: marketplace_artists trg_marketplace_artists_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_marketplace_artists_touch BEFORE UPDATE ON public.marketplace_artists FOR EACH ROW EXECUTE FUNCTION public.commerce_touch_updated_at();


--
-- Name: workshop_pages trg_workshop_pages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_workshop_pages_updated_at BEFORE UPDATE ON public.workshop_pages FOR EACH ROW EXECUTE FUNCTION public.workshop_pages_touch_updated_at();


--
-- Name: poll_votes trigger_poll_vote_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_poll_vote_count AFTER INSERT OR DELETE ON public.poll_votes FOR EACH ROW EXECUTE FUNCTION public.update_poll_option_vote_count();


--
-- Name: reading_books trigger_reading_books_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_reading_books_updated_at BEFORE UPDATE ON public.reading_books FOR EACH ROW EXECUTE FUNCTION public.update_reading_updated_at();


--
-- Name: reading_groups trigger_reading_groups_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_reading_groups_updated_at BEFORE UPDATE ON public.reading_groups FOR EACH ROW EXECUTE FUNCTION public.update_reading_updated_at();


--
-- Name: reading_newsletter_issues trigger_reading_newsletter_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_reading_newsletter_updated_at BEFORE UPDATE ON public.reading_newsletter_issues FOR EACH ROW EXECUTE FUNCTION public.update_reading_updated_at();


--
-- Name: reading_programs trigger_reading_programs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_reading_programs_updated_at BEFORE UPDATE ON public.reading_programs FOR EACH ROW EXECUTE FUNCTION public.update_reading_updated_at();


--
-- Name: reading_units trigger_reading_units_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_reading_units_updated_at BEFORE UPDATE ON public.reading_units FOR EACH ROW EXECUTE FUNCTION public.update_reading_updated_at();


--
-- Name: availability_responses trigger_responses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_responses_updated_at BEFORE UPDATE ON public.availability_responses FOR EACH ROW EXECUTE FUNCTION public.update_availability_updated_at();


--
-- Name: availability_responses trigger_update_poll_response_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_poll_response_count AFTER INSERT OR DELETE ON public.availability_responses FOR EACH ROW EXECUTE FUNCTION public.update_poll_response_count();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: artist_profiles artist_profiles_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artist_profiles
    ADD CONSTRAINT artist_profiles_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: artist_profiles artist_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artist_profiles
    ADD CONSTRAINT artist_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: artwork artwork_artist_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artwork
    ADD CONSTRAINT artwork_artist_user_id_fkey FOREIGN KEY (artist_user_id) REFERENCES public.users(id);


--
-- Name: artwork_media artwork_media_artwork_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artwork_media
    ADD CONSTRAINT artwork_media_artwork_id_fkey FOREIGN KEY (artwork_id) REFERENCES public.artwork(id) ON DELETE CASCADE;


--
-- Name: artwork_media artwork_media_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artwork_media
    ADD CONSTRAINT artwork_media_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: artwork artwork_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artwork
    ADD CONSTRAINT artwork_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: artwork artwork_primary_image_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artwork
    ADD CONSTRAINT artwork_primary_image_fk FOREIGN KEY (primary_image_id) REFERENCES public.artwork_media(id) ON DELETE SET NULL;


--
-- Name: artwork_variant artwork_variant_artwork_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artwork_variant
    ADD CONSTRAINT artwork_variant_artwork_id_fkey FOREIGN KEY (artwork_id) REFERENCES public.artwork(id) ON DELETE CASCADE;


--
-- Name: artwork_variant artwork_variant_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artwork_variant
    ADD CONSTRAINT artwork_variant_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: auction_lot auction_lot_artwork_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auction_lot
    ADD CONSTRAINT auction_lot_artwork_variant_id_fkey FOREIGN KEY (artwork_variant_id) REFERENCES public.artwork_variant(id) ON DELETE CASCADE;


--
-- Name: auction_lot auction_lot_current_bid_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auction_lot
    ADD CONSTRAINT auction_lot_current_bid_fk FOREIGN KEY (current_bid_id) REFERENCES public.bid(id) ON DELETE SET NULL;


--
-- Name: auction_lot auction_lot_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auction_lot
    ADD CONSTRAINT auction_lot_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: auction_lot auction_lot_winner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auction_lot
    ADD CONSTRAINT auction_lot_winner_user_id_fkey FOREIGN KEY (winner_user_id) REFERENCES public.users(id);


--
-- Name: availability_poll_options availability_poll_options_poll_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_poll_options
    ADD CONSTRAINT availability_poll_options_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES public.availability_polls(id) ON DELETE CASCADE;


--
-- Name: availability_poll_responses availability_poll_responses_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_poll_responses
    ADD CONSTRAINT availability_poll_responses_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.availability_poll_options(id) ON DELETE CASCADE;


--
-- Name: availability_poll_responses availability_poll_responses_poll_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_poll_responses
    ADD CONSTRAINT availability_poll_responses_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES public.availability_polls(id) ON DELETE CASCADE;


--
-- Name: availability_poll_responses availability_poll_responses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_poll_responses
    ADD CONSTRAINT availability_poll_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: availability_polls availability_polls_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_polls
    ADD CONSTRAINT availability_polls_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: availability_polls availability_polls_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_polls
    ADD CONSTRAINT availability_polls_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;


--
-- Name: availability_responses availability_responses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_responses
    ADD CONSTRAINT availability_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: availability_slots availability_slots_response_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_slots
    ADD CONSTRAINT availability_slots_response_id_fkey FOREIGN KEY (response_id) REFERENCES public.availability_responses(id) ON DELETE CASCADE;


--
-- Name: bid bid_bidder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bid
    ADD CONSTRAINT bid_bidder_id_fkey FOREIGN KEY (bidder_id) REFERENCES public.users(id);


--
-- Name: bid bid_lot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bid
    ADD CONSTRAINT bid_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES public.auction_lot(id) ON DELETE CASCADE;


--
-- Name: bookmarks bookmarks_reply_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_reply_id_fkey FOREIGN KEY (reply_id) REFERENCES public.replies(id) ON DELETE CASCADE;


--
-- Name: bookmarks bookmarks_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;


--
-- Name: bookmarks bookmarks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: cart_line cart_line_artwork_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_line
    ADD CONSTRAINT cart_line_artwork_variant_id_fkey FOREIGN KEY (artwork_variant_id) REFERENCES public.artwork_variant(id);


--
-- Name: cart_line cart_line_cart_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_line
    ADD CONSTRAINT cart_line_cart_id_fkey FOREIGN KEY (cart_id) REFERENCES public.cart(id) ON DELETE CASCADE;


--
-- Name: cart cart_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart
    ADD CONSTRAINT cart_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: commerce_order commerce_order_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_order
    ADD CONSTRAINT commerce_order_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(id);


--
-- Name: commerce_order_line commerce_order_line_artist_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_order_line
    ADD CONSTRAINT commerce_order_line_artist_user_id_fkey FOREIGN KEY (artist_user_id) REFERENCES public.users(id);


--
-- Name: commerce_order_line commerce_order_line_artwork_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_order_line
    ADD CONSTRAINT commerce_order_line_artwork_id_fkey FOREIGN KEY (artwork_id) REFERENCES public.artwork(id);


--
-- Name: commerce_order_line commerce_order_line_artwork_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_order_line
    ADD CONSTRAINT commerce_order_line_artwork_variant_id_fkey FOREIGN KEY (artwork_variant_id) REFERENCES public.artwork_variant(id);


--
-- Name: commerce_order_line commerce_order_line_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_order_line
    ADD CONSTRAINT commerce_order_line_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.commerce_order(id) ON DELETE CASCADE;


--
-- Name: commerce_order_line commerce_order_line_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_order_line
    ADD CONSTRAINT commerce_order_line_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: commerce_order commerce_order_payment_confirmed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_order
    ADD CONSTRAINT commerce_order_payment_confirmed_by_fkey FOREIGN KEY (payment_confirmed_by) REFERENCES public.users(id);


--
-- Name: contacts contacts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: content_drafts content_drafts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_drafts
    ADD CONSTRAINT content_drafts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: content_drafts content_drafts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_drafts
    ADD CONSTRAINT content_drafts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: events events_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: events events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: extensions extensions_tenant_external_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extensions
    ADD CONSTRAINT extensions_tenant_external_id_fkey FOREIGN KEY (tenant_external_id) REFERENCES public.tenants(external_id) ON DELETE CASCADE;


--
-- Name: flags flags_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flags
    ADD CONSTRAINT flags_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: flags flags_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flags
    ADD CONSTRAINT flags_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: guest_submissions guest_submissions_linked_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guest_submissions
    ADD CONSTRAINT guest_submissions_linked_user_id_fkey FOREIGN KEY (linked_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: guest_submissions guest_submissions_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guest_submissions
    ADD CONSTRAINT guest_submissions_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE SET NULL;


--
-- Name: inquiry inquiry_artwork_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiry
    ADD CONSTRAINT inquiry_artwork_id_fkey FOREIGN KEY (artwork_id) REFERENCES public.artwork(id) ON DELETE CASCADE;


--
-- Name: inquiry inquiry_customer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiry
    ADD CONSTRAINT inquiry_customer_user_id_fkey FOREIGN KEY (customer_user_id) REFERENCES public.users(id);


--
-- Name: inquiry inquiry_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiry
    ADD CONSTRAINT inquiry_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: landing_inquiries landing_inquiries_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_inquiries
    ADD CONSTRAINT landing_inquiries_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketplace_artists marketplace_artists_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_artists
    ADD CONSTRAINT marketplace_artists_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketplace_artists marketplace_artists_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_artists
    ADD CONSTRAINT marketplace_artists_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: media media_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: media media_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: moderation_log moderation_log_moderator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_log
    ADD CONSTRAINT moderation_log_moderator_id_fkey FOREIGN KEY (moderator_id) REFERENCES public.users(id);


--
-- Name: notifications notifications_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_reply_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_reply_id_fkey FOREIGN KEY (reply_id) REFERENCES public.replies(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: oidc_codes oidc_codes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oidc_codes
    ADD CONSTRAINT oidc_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: org_site_sections org_site_sections_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_site_sections
    ADD CONSTRAINT org_site_sections_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_site_sections org_site_sections_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_site_sections
    ADD CONSTRAINT org_site_sections_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: payout payout_artist_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout
    ADD CONSTRAINT payout_artist_user_id_fkey FOREIGN KEY (artist_user_id) REFERENCES public.users(id);


--
-- Name: payout payout_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout
    ADD CONSTRAINT payout_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.commerce_order(id) ON DELETE SET NULL;


--
-- Name: poll_votes poll_votes_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_votes
    ADD CONSTRAINT poll_votes_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.poll_options(id) ON DELETE CASCADE;


--
-- Name: poll_votes poll_votes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_votes
    ADD CONSTRAINT poll_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: question_poll_options question_poll_options_poll_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_poll_options
    ADD CONSTRAINT question_poll_options_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES public.question_polls(id) ON DELETE CASCADE;


--
-- Name: question_poll_votes question_poll_votes_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_poll_votes
    ADD CONSTRAINT question_poll_votes_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.question_poll_options(id) ON DELETE CASCADE;


--
-- Name: question_poll_votes question_poll_votes_poll_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_poll_votes
    ADD CONSTRAINT question_poll_votes_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES public.question_polls(id) ON DELETE CASCADE;


--
-- Name: question_poll_votes question_poll_votes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_poll_votes
    ADD CONSTRAINT question_poll_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: question_polls question_polls_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_polls
    ADD CONSTRAINT question_polls_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: question_polls question_polls_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_polls
    ADD CONSTRAINT question_polls_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;


--
-- Name: reactions reactions_reply_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_reply_id_fkey FOREIGN KEY (reply_id) REFERENCES public.replies(id) ON DELETE CASCADE;


--
-- Name: reactions reactions_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;


--
-- Name: reactions reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reading_books reading_books_cover_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_books
    ADD CONSTRAINT reading_books_cover_media_id_fkey FOREIGN KEY (cover_media_id) REFERENCES public.media(id) ON DELETE SET NULL;


--
-- Name: reading_books reading_books_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_books
    ADD CONSTRAINT reading_books_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: reading_books reading_books_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_books
    ADD CONSTRAINT reading_books_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: reading_books reading_books_source_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_books
    ADD CONSTRAINT reading_books_source_media_id_fkey FOREIGN KEY (source_media_id) REFERENCES public.media(id) ON DELETE SET NULL;


--
-- Name: reading_groups reading_groups_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_groups
    ADD CONSTRAINT reading_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: reading_groups reading_groups_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_groups
    ADD CONSTRAINT reading_groups_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: reading_newsletter_issues reading_newsletter_issues_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_newsletter_issues
    ADD CONSTRAINT reading_newsletter_issues_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: reading_newsletter_issues reading_newsletter_issues_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_newsletter_issues
    ADD CONSTRAINT reading_newsletter_issues_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: reading_newsletter_issues reading_newsletter_issues_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_newsletter_issues
    ADD CONSTRAINT reading_newsletter_issues_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.reading_programs(id) ON DELETE CASCADE;


--
-- Name: reading_newsletter_issues reading_newsletter_issues_source_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_newsletter_issues
    ADD CONSTRAINT reading_newsletter_issues_source_snapshot_id_fkey FOREIGN KEY (source_snapshot_id) REFERENCES public.reading_note_snapshots(id) ON DELETE SET NULL;


--
-- Name: reading_newsletter_issues reading_newsletter_issues_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_newsletter_issues
    ADD CONSTRAINT reading_newsletter_issues_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.reading_units(id) ON DELETE SET NULL;


--
-- Name: reading_note_snapshots reading_note_snapshots_captured_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_note_snapshots
    ADD CONSTRAINT reading_note_snapshots_captured_by_fkey FOREIGN KEY (captured_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: reading_note_snapshots reading_note_snapshots_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_note_snapshots
    ADD CONSTRAINT reading_note_snapshots_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: reading_note_snapshots reading_note_snapshots_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_note_snapshots
    ADD CONSTRAINT reading_note_snapshots_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.reading_units(id) ON DELETE CASCADE;


--
-- Name: reading_programs reading_programs_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_programs
    ADD CONSTRAINT reading_programs_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.reading_books(id) ON DELETE CASCADE;


--
-- Name: reading_programs reading_programs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_programs
    ADD CONSTRAINT reading_programs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: reading_programs reading_programs_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_programs
    ADD CONSTRAINT reading_programs_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.reading_groups(id) ON DELETE CASCADE;


--
-- Name: reading_programs reading_programs_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_programs
    ADD CONSTRAINT reading_programs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: reading_programs reading_programs_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_programs
    ADD CONSTRAINT reading_programs_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE SET NULL;


--
-- Name: reading_resources reading_resources_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_resources
    ADD CONSTRAINT reading_resources_media_id_fkey FOREIGN KEY (media_id) REFERENCES public.media(id) ON DELETE SET NULL;


--
-- Name: reading_resources reading_resources_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_resources
    ADD CONSTRAINT reading_resources_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: reading_resources reading_resources_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_resources
    ADD CONSTRAINT reading_resources_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.reading_units(id) ON DELETE CASCADE;


--
-- Name: reading_units reading_units_discussion_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_units
    ADD CONSTRAINT reading_units_discussion_thread_id_fkey FOREIGN KEY (discussion_thread_id) REFERENCES public.threads(id) ON DELETE SET NULL;


--
-- Name: reading_units reading_units_meeting_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_units
    ADD CONSTRAINT reading_units_meeting_thread_id_fkey FOREIGN KEY (meeting_thread_id) REFERENCES public.threads(id) ON DELETE SET NULL;


--
-- Name: reading_units reading_units_newsletter_issue_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_units
    ADD CONSTRAINT reading_units_newsletter_issue_fk FOREIGN KEY (newsletter_issue_id) REFERENCES public.reading_newsletter_issues(id) ON DELETE SET NULL;


--
-- Name: reading_units reading_units_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_units
    ADD CONSTRAINT reading_units_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: reading_units reading_units_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_units
    ADD CONSTRAINT reading_units_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.reading_programs(id) ON DELETE CASCADE;


--
-- Name: replies replies_parent_reply_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.replies
    ADD CONSTRAINT replies_parent_reply_id_fkey FOREIGN KEY (parent_reply_id) REFERENCES public.replies(id) ON DELETE CASCADE;


--
-- Name: replies replies_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.replies
    ADD CONSTRAINT replies_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.workshop_sessions(id) ON DELETE SET NULL;


--
-- Name: replies replies_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.replies
    ADD CONSTRAINT replies_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;


--
-- Name: replies replies_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.replies
    ADD CONSTRAINT replies_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: reservation reservation_artwork_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation
    ADD CONSTRAINT reservation_artwork_variant_id_fkey FOREIGN KEY (artwork_variant_id) REFERENCES public.artwork_variant(id) ON DELETE CASCADE;


--
-- Name: reservation reservation_cart_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation
    ADD CONSTRAINT reservation_cart_id_fkey FOREIGN KEY (cart_id) REFERENCES public.cart(id) ON DELETE SET NULL;


--
-- Name: site_config site_config_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_config
    ADD CONSTRAINT site_config_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: thread_orgs thread_orgs_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_orgs
    ADD CONSTRAINT thread_orgs_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: thread_orgs thread_orgs_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_orgs
    ADD CONSTRAINT thread_orgs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: thread_orgs thread_orgs_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_orgs
    ADD CONSTRAINT thread_orgs_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;


--
-- Name: thread_references thread_references_references_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_references
    ADD CONSTRAINT thread_references_references_thread_id_fkey FOREIGN KEY (references_thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;


--
-- Name: thread_references thread_references_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_references
    ADD CONSTRAINT thread_references_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;


--
-- Name: thread_revisions thread_revisions_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_revisions
    ADD CONSTRAINT thread_revisions_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: thread_revisions thread_revisions_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_revisions
    ADD CONSTRAINT thread_revisions_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;


--
-- Name: thread_rsvps thread_rsvps_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_rsvps
    ADD CONSTRAINT thread_rsvps_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;


--
-- Name: thread_rsvps thread_rsvps_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_rsvps
    ADD CONSTRAINT thread_rsvps_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: thread_topics thread_topics_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_topics
    ADD CONSTRAINT thread_topics_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;


--
-- Name: thread_topics thread_topics_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_topics
    ADD CONSTRAINT thread_topics_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id) ON DELETE CASCADE;


--
-- Name: threads threads_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: threads threads_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: topics topics_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.topics(id) ON DELETE SET NULL;


--
-- Name: user_organizations user_organizations_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_organizations
    ADD CONSTRAINT user_organizations_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_organizations user_organizations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_organizations
    ADD CONSTRAINT user_organizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: watches watches_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watches
    ADD CONSTRAINT watches_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;


--
-- Name: watches watches_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watches
    ADD CONSTRAINT watches_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: work_question_responses work_question_responses_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_question_responses
    ADD CONSTRAINT work_question_responses_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.work_questions(id) ON DELETE CASCADE;


--
-- Name: workshop_details workshop_details_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workshop_details
    ADD CONSTRAINT workshop_details_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;


--
-- Name: workshop_pages workshop_pages_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workshop_pages
    ADD CONSTRAINT workshop_pages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;


--
-- Name: workshop_sessions workshop_sessions_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workshop_sessions
    ADD CONSTRAINT workshop_sessions_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;


--
-- Name: availability_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.availability_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: availability_slots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


--
-- Name: supabase_realtime availability_responses; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.availability_responses;


--
-- Name: supabase_realtime availability_slots; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.availability_slots;


--
-- PostgreSQL database dump complete
--

\unrestrict RNhBSRmK4YQpIcL5RRJG835ujGxpUnBlCyJI2PKGWKsdc4atl1eGdthXu4fPzsi

