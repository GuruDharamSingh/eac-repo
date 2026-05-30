time="2026-04-11T00:34:54Z" level=warning msg="/home/elkdonis/dev-enviroment/eac-repo/docker-compose.yml: the attribute `version` is obsolete, it will be ignored, please remove it to avoid potential confusion"
--
-- PostgreSQL database dump
--

\restrict hdUHa1kunoGfqc1FC6f7MeDrK60ScFBrMTIfZYh6Iu7Lne2LGHjCwUx2Lgxmuc2

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
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: get_current_user_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_current_user_id() RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN (
    SELECT id FROM public.users
    WHERE auth_user_id = auth.uid()
    LIMIT 1
  );
END;
$$;


--
-- Name: FUNCTION get_current_user_id(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_current_user_id() IS 'Gets the public.users.id for the currently authenticated user';


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.users (id, auth_user_id, email, display_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: availability_polls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.availability_polls (
    id character varying(21) NOT NULL,
    org_id character varying(50) NOT NULL,
    creator_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    start_date date NOT NULL,
    end_date date NOT NULL,
    earliest_time time without time zone NOT NULL,
    latest_time time without time zone NOT NULL,
    time_slot_duration integer DEFAULT 30 NOT NULL,
    nextcloud_poll_id character varying(255),
    nextcloud_calendar_proposal_id character varying(255),
    status character varying(20) DEFAULT 'open'::character varying,
    locked_time_slot timestamp with time zone,
    final_meeting_id character varying(21),
    allow_maybe boolean DEFAULT true,
    require_authentication boolean DEFAULT true,
    show_participants boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deadline timestamp with time zone,
    response_count integer DEFAULT 0,
    CONSTRAINT availability_polls_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'locked'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: TABLE availability_polls; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.availability_polls IS 'Polls for scheduling meetings by collecting availability from multiple participants';


--
-- Name: COLUMN availability_polls.time_slot_duration; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.availability_polls.time_slot_duration IS 'Duration of each time slot in minutes (e.g., 30 for 30-minute slots)';


--
-- Name: COLUMN availability_polls.locked_time_slot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.availability_polls.locked_time_slot IS 'When status=locked, this is the final chosen time';


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
-- Name: bookmarks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookmarks (
    user_id uuid NOT NULL,
    bookmarkable_type character varying(20) NOT NULL,
    bookmarkable_id character varying(21) NOT NULL,
    bookmarked_at timestamp with time zone DEFAULT now(),
    CONSTRAINT bookmarks_bookmarkable_type_check CHECK (((bookmarkable_type)::text = ANY ((ARRAY['post'::character varying, 'meeting'::character varying])::text[])))
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
    CONSTRAINT content_drafts_content_type_check CHECK (((content_type)::text = ANY ((ARRAY['post'::character varying, 'meeting'::character varying])::text[])))
);


--
-- Name: event_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_pages (
    id character varying(21) NOT NULL,
    meeting_id character varying(21) NOT NULL,
    org_id character varying(50) NOT NULL,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    colors jsonb DEFAULT '{}'::jsonb,
    table_data jsonb DEFAULT '[]'::jsonb,
    layout character varying(20) DEFAULT 'default'::character varying,
    is_published boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    drawing jsonb
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
    user_id uuid NOT NULL,
    flaggable_type character varying(20) NOT NULL,
    flaggable_id character varying(21) NOT NULL,
    reason character varying(30) NOT NULL,
    notes text,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT flags_flaggable_type_check CHECK (((flaggable_type)::text = ANY ((ARRAY['post'::character varying, 'meeting'::character varying, 'reply'::character varying])::text[]))),
    CONSTRAINT flags_reason_check CHECK (((reason)::text = ANY ((ARRAY['spam'::character varying, 'harassment'::character varying, 'inappropriate'::character varying, 'misinformation'::character varying, 'off_topic'::character varying, 'duplicate'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT flags_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'resolved'::character varying, 'dismissed'::character varying])::text[])))
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
    CONSTRAINT media_attached_to_type_check CHECK (((attached_to_type)::text = ANY ((ARRAY['meeting'::character varying, 'post'::character varying])::text[]))),
    CONSTRAINT media_check CHECK ((((attached_to_type IS NOT NULL) AND (attached_to_id IS NOT NULL)) OR ((attached_to_type IS NULL) AND (attached_to_id IS NULL)))),
    CONSTRAINT media_type_check CHECK (((type)::text = ANY ((ARRAY['image'::character varying, 'video'::character varying, 'audio'::character varying, 'document'::character varying])::text[])))
);


--
-- Name: meeting_attendees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meeting_attendees (
    meeting_id character varying(21) NOT NULL,
    user_id uuid NOT NULL,
    attendance_status character varying(20) DEFAULT 'registered'::character varying,
    registered_at timestamp with time zone DEFAULT now(),
    CONSTRAINT meeting_attendees_attendance_status_check CHECK (((attendance_status)::text = ANY ((ARRAY['registered'::character varying, 'attended'::character varying, 'absent'::character varying])::text[])))
);


--
-- Name: meeting_topics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meeting_topics (
    meeting_id character varying(21) NOT NULL,
    topic_id character varying(21) NOT NULL
);


--
-- Name: meetings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meetings (
    id character varying(21) NOT NULL,
    org_id character varying(50) NOT NULL,
    guide_id uuid NOT NULL,
    title text NOT NULL,
    slug character varying(255) NOT NULL,
    meeting_type character varying(20),
    description text,
    notes text,
    video_url text,
    scheduled_at timestamp with time zone,
    duration_minutes integer,
    location text,
    is_online boolean DEFAULT true,
    meeting_url text,
    status character varying(20) DEFAULT 'draft'::character varying,
    visibility character varying(20) DEFAULT 'PUBLIC'::character varying,
    nextcloud_file_id character varying(255),
    nextcloud_last_sync timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    published_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now(),
    view_count integer DEFAULT 0,
    reply_count integer DEFAULT 0,
    last_activity_at timestamp with time zone DEFAULT now(),
    is_pinned boolean DEFAULT false,
    is_locked boolean DEFAULT false,
    reaction_count integer DEFAULT 0,
    nextcloud_talk_token character varying(255),
    nextcloud_recording_id character varying(255),
    nextcloud_calendar_event_id character varying(255),
    nextcloud_calendar_synced boolean DEFAULT false,
    nextcloud_poll_id integer,
    nextcloud_poll_synced boolean DEFAULT false,
    is_rsvp_enabled boolean DEFAULT false,
    rsvp_deadline timestamp with time zone,
    attendee_limit integer,
    min_attendees integer,
    notify_on_min_attendees boolean DEFAULT false,
    min_attendees_notified boolean DEFAULT false,
    recurrence_pattern character varying(20),
    recurrence_custom_rule text,
    recurrence_until timestamp with time zone,
    show_in_live_feed boolean DEFAULT false,
    section character varying(30),
    show_on_workshops_page boolean DEFAULT false NOT NULL,
    workshop_order integer,
    subtitle character varying(255) DEFAULT NULL::character varying,
    card_colour character varying(7) DEFAULT NULL::character varying,
    card_accent_colour character varying(7) DEFAULT NULL::character varying,
    CONSTRAINT meetings_meeting_type_check CHECK (((meeting_type)::text = ANY ((ARRAY['sitting'::character varying, 'theatrical'::character varying, 'discussion'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT meetings_recurrence_pattern_check CHECK (((recurrence_pattern)::text = ANY ((ARRAY['DAILY'::character varying, 'WEEKLY'::character varying, 'MONTHLY'::character varying, 'CUSTOM'::character varying])::text[]))),
    CONSTRAINT meetings_section_check CHECK (((section)::text = ANY ((ARRAY['amrit_vela'::character varying, 'yoga'::character varying, 'gurdwara'::character varying])::text[]))),
    CONSTRAINT meetings_status_check CHECK (((status)::text = ANY ((ARRAY['scheduled'::character varying, 'completed'::character varying, 'draft'::character varying, 'published'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT meetings_visibility_check CHECK (((visibility)::text = ANY ((ARRAY['PUBLIC'::character varying, 'ORGANIZATION'::character varying, 'INVITE_ONLY'::character varying])::text[])))
);


--
-- Name: COLUMN meetings.scheduled_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.meetings.scheduled_at IS 'Primary scheduling field - date and time when meeting starts';


--
-- Name: COLUMN meetings.duration_minutes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.meetings.duration_minutes IS 'Meeting duration in minutes. End time = scheduled_at + duration_minutes';


--
-- Name: COLUMN meetings.nextcloud_talk_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.meetings.nextcloud_talk_token IS 'Nextcloud Talk room token for video chat';


--
-- Name: COLUMN meetings.nextcloud_recording_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.meetings.nextcloud_recording_id IS 'Nextcloud file ID of Talk recording';


--
-- Name: COLUMN meetings.nextcloud_calendar_event_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.meetings.nextcloud_calendar_event_id IS 'Nextcloud Calendar event UID for sync';


--
-- Name: COLUMN meetings.nextcloud_calendar_synced; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.meetings.nextcloud_calendar_synced IS 'Whether meeting is synced to Nextcloud Calendar';


--
-- Name: COLUMN meetings.nextcloud_poll_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.meetings.nextcloud_poll_id IS 'Nextcloud Polls ID for availability polling';


--
-- Name: COLUMN meetings.nextcloud_poll_synced; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.meetings.nextcloud_poll_synced IS 'Whether poll is synced to Nextcloud';


--
-- Name: moderation_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.moderation_log (
    id character varying(21) NOT NULL,
    moderator_id uuid NOT NULL,
    action character varying(30) NOT NULL,
    target_type character varying(20) NOT NULL,
    target_id character varying(21) NOT NULL,
    reason text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT moderation_log_action_check CHECK (((action)::text = ANY ((ARRAY['pin'::character varying, 'unpin'::character varying, 'lock'::character varying, 'unlock'::character varying, 'hide'::character varying, 'unhide'::character varying, 'delete'::character varying, 'restore'::character varying, 'move'::character varying, 'edit'::character varying, 'warn_user'::character varying, 'ban_user'::character varying])::text[]))),
    CONSTRAINT moderation_log_target_type_check CHECK (((target_type)::text = ANY ((ARRAY['post'::character varying, 'meeting'::character varying, 'reply'::character varying, 'user'::character varying])::text[])))
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
    actor_id uuid,
    notification_type character varying(30) NOT NULL,
    notifiable_type character varying(20) NOT NULL,
    notifiable_id character varying(21) NOT NULL,
    content text,
    metadata jsonb DEFAULT '{}'::jsonb,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT notifications_notifiable_type_check CHECK (((notifiable_type)::text = ANY ((ARRAY['post'::character varying, 'meeting'::character varying, 'reply'::character varying])::text[]))),
    CONSTRAINT notifications_notification_type_check CHECK (((notification_type)::text = ANY ((ARRAY['reply'::character varying, 'mention'::character varying, 'reaction'::character varying, 'watch_reply'::character varying, 'moderation'::character varying, 'system'::character varying, 'announcement'::character varying])::text[])))
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
    blog_password_salt character varying(64)
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
-- Name: post_topics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_topics (
    post_id character varying(21) NOT NULL,
    topic_id character varying(21) NOT NULL
);


--
-- Name: posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.posts (
    id character varying(21) NOT NULL,
    org_id character varying(50) NOT NULL,
    author_id uuid NOT NULL,
    title text NOT NULL,
    slug character varying(255) NOT NULL,
    body text,
    excerpt text,
    status character varying(20) DEFAULT 'draft'::character varying,
    visibility character varying(20) DEFAULT 'PUBLIC'::character varying,
    nextcloud_file_id character varying(255),
    nextcloud_last_sync timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    published_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now(),
    view_count integer DEFAULT 0,
    reply_count integer DEFAULT 0,
    last_activity_at timestamp with time zone DEFAULT now(),
    is_pinned boolean DEFAULT false,
    is_locked boolean DEFAULT false,
    reaction_count integer DEFAULT 0,
    nextcloud_synced boolean DEFAULT false,
    nextcloud_talk_token character varying(255),
    document_url text,
    is_rsvp_enabled boolean DEFAULT false,
    CONSTRAINT posts_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'published'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT posts_visibility_check CHECK (((visibility)::text = ANY ((ARRAY['PUBLIC'::character varying, 'ORGANIZATION'::character varying, 'INVITE_ONLY'::character varying])::text[])))
);


--
-- Name: question_polls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question_polls (
    id character varying(21) NOT NULL,
    org_id character varying(50) NOT NULL,
    creator_id uuid NOT NULL,
    question text NOT NULL,
    description text,
    poll_type character varying(20) DEFAULT 'single_choice'::character varying NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    show_results_before_vote boolean DEFAULT true,
    deadline timestamp with time zone,
    vote_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    closed_at timestamp with time zone,
    CONSTRAINT question_polls_poll_type_check CHECK (((poll_type)::text = ANY ((ARRAY['single_choice'::character varying, 'multi_choice'::character varying])::text[]))),
    CONSTRAINT question_polls_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'closed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: TABLE question_polls; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.question_polls IS 'Question-based polls with single or multiple choice options, publishable to the feed';


--
-- Name: COLUMN question_polls.poll_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.question_polls.poll_type IS 'single_choice = one answer only, multi_choice = select multiple';


--
-- Name: COLUMN question_polls.vote_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.question_polls.vote_count IS 'Total number of individual votes cast (auto-updated via trigger)';


--
-- Name: reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reactions (
    id character varying(21) NOT NULL,
    user_id uuid NOT NULL,
    reactable_type character varying(20) NOT NULL,
    reactable_id character varying(21) NOT NULL,
    reaction_type character varying(20) DEFAULT 'like'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT reactions_reactable_type_check CHECK (((reactable_type)::text = ANY ((ARRAY['post'::character varying, 'meeting'::character varying, 'reply'::character varying])::text[]))),
    CONSTRAINT reactions_reaction_type_check CHECK (((reaction_type)::text = ANY ((ARRAY['like'::character varying, 'upvote'::character varying, 'love'::character varying, 'insightful'::character varying])::text[])))
);


--
-- Name: replies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.replies (
    id character varying(21) NOT NULL,
    parent_type character varying(20) NOT NULL,
    parent_id character varying(21) NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    edited_at timestamp with time zone,
    reaction_count integer DEFAULT 0,
    CONSTRAINT replies_parent_type_check CHECK (((parent_type)::text = ANY ((ARRAY['meeting'::character varying, 'post'::character varying, 'reply'::character varying])::text[])))
);


--
-- Name: rsvp_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rsvp_responses (
    id text NOT NULL,
    meeting_id character varying(21) NOT NULL,
    org_id character varying(50) NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    message text,
    wants_reminder boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
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
    CONSTRAINT users_auth_user_id_matches_id CHECK ((auth_user_id = id)),
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
    user_id uuid NOT NULL,
    watchable_type character varying(20) NOT NULL,
    watchable_id character varying(21) NOT NULL,
    started_at timestamp with time zone DEFAULT now(),
    CONSTRAINT watches_watchable_type_check CHECK (((watchable_type)::text = ANY ((ARRAY['post'::character varying, 'meeting'::character varying])::text[])))
);


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
-- Name: bookmarks bookmarks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_pkey PRIMARY KEY (user_id, bookmarkable_type, bookmarkable_id);


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
-- Name: event_pages event_pages_meeting_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_pages
    ADD CONSTRAINT event_pages_meeting_id_key UNIQUE (meeting_id);


--
-- Name: event_pages event_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_pages
    ADD CONSTRAINT event_pages_pkey PRIMARY KEY (id);


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
-- Name: media media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_pkey PRIMARY KEY (id);


--
-- Name: meeting_attendees meeting_attendees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_attendees
    ADD CONSTRAINT meeting_attendees_pkey PRIMARY KEY (meeting_id, user_id);


--
-- Name: meeting_topics meeting_topics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_topics
    ADD CONSTRAINT meeting_topics_pkey PRIMARY KEY (meeting_id, topic_id);


--
-- Name: meetings meetings_org_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_org_id_slug_key UNIQUE (org_id, slug);


--
-- Name: meetings meetings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_pkey PRIMARY KEY (id);


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
-- Name: post_topics post_topics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_topics
    ADD CONSTRAINT post_topics_pkey PRIMARY KEY (post_id, topic_id);


--
-- Name: posts posts_org_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_org_id_slug_key UNIQUE (org_id, slug);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


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
-- Name: reactions reactions_user_id_reactable_type_reactable_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_user_id_reactable_type_reactable_id_key UNIQUE (user_id, reactable_type, reactable_id);


--
-- Name: replies replies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.replies
    ADD CONSTRAINT replies_pkey PRIMARY KEY (id);


--
-- Name: rsvp_responses rsvp_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rsvp_responses
    ADD CONSTRAINT rsvp_responses_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


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
    ADD CONSTRAINT watches_pkey PRIMARY KEY (user_id, watchable_type, watchable_id);


--
-- Name: extensions_tenant_external_id_type_index; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX extensions_tenant_external_id_type_index ON public.extensions USING btree (tenant_external_id, type);


--
-- Name: idx_attendees_meeting; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendees_meeting ON public.meeting_attendees USING btree (meeting_id);


--
-- Name: idx_attendees_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendees_user ON public.meeting_attendees USING btree (user_id);


--
-- Name: idx_bookmarks_bookmarkable; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookmarks_bookmarkable ON public.bookmarks USING btree (bookmarkable_type, bookmarkable_id);


--
-- Name: idx_bookmarks_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookmarks_user ON public.bookmarks USING btree (user_id, bookmarked_at DESC);


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
-- Name: idx_event_pages_is_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_pages_is_published ON public.event_pages USING btree (is_published);


--
-- Name: idx_event_pages_meeting_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_pages_meeting_id ON public.event_pages USING btree (meeting_id);


--
-- Name: idx_event_pages_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_pages_org_id ON public.event_pages USING btree (org_id);


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
-- Name: idx_flags_flaggable; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_flags_flaggable ON public.flags USING btree (flaggable_type, flaggable_id, status);


--
-- Name: idx_flags_resolved_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_flags_resolved_by ON public.flags USING btree (resolved_by, resolved_at DESC);


--
-- Name: idx_flags_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_flags_status ON public.flags USING btree (status, created_at) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_flags_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_flags_user ON public.flags USING btree (user_id, created_at DESC);


--
-- Name: idx_media_attached; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_attached ON public.media USING btree (attached_to_type, attached_to_id);


--
-- Name: idx_media_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_org ON public.media USING btree (org_id);


--
-- Name: idx_meetings_guide; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meetings_guide ON public.meetings USING btree (guide_id);


--
-- Name: idx_meetings_last_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meetings_last_activity ON public.meetings USING btree (last_activity_at DESC) WHERE ((status)::text = 'published'::text);


--
-- Name: idx_meetings_live_feed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meetings_live_feed ON public.meetings USING btree (org_id, show_in_live_feed, scheduled_at) WHERE ((show_in_live_feed = true) AND ((status)::text = 'published'::text));


--
-- Name: idx_meetings_nextcloud_calendar; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meetings_nextcloud_calendar ON public.meetings USING btree (nextcloud_calendar_event_id) WHERE (nextcloud_calendar_event_id IS NOT NULL);


--
-- Name: idx_meetings_nextcloud_poll; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meetings_nextcloud_poll ON public.meetings USING btree (nextcloud_poll_id) WHERE (nextcloud_poll_id IS NOT NULL);


--
-- Name: idx_meetings_nextcloud_talk; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meetings_nextcloud_talk ON public.meetings USING btree (nextcloud_talk_token) WHERE (nextcloud_talk_token IS NOT NULL);


--
-- Name: idx_meetings_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meetings_org ON public.meetings USING btree (org_id);


--
-- Name: idx_meetings_pinned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meetings_pinned ON public.meetings USING btree (org_id, is_pinned, last_activity_at DESC) WHERE ((status)::text = 'published'::text);


--
-- Name: idx_meetings_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meetings_published ON public.meetings USING btree (published_at DESC) WHERE ((status)::text = 'published'::text);


--
-- Name: idx_meetings_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meetings_scheduled ON public.meetings USING btree (scheduled_at DESC) WHERE ((scheduled_at IS NOT NULL) AND ((status)::text = 'published'::text));


--
-- Name: idx_meetings_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meetings_section ON public.meetings USING btree (org_id, section, scheduled_at);


--
-- Name: idx_meetings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meetings_status ON public.meetings USING btree (status);


--
-- Name: idx_meetings_upcoming; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meetings_upcoming ON public.meetings USING btree (scheduled_at) WHERE ((status)::text = 'published'::text);


--
-- Name: idx_meetings_visibility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meetings_visibility ON public.meetings USING btree (visibility) WHERE ((status)::text = 'published'::text);


--
-- Name: idx_meetings_workshop_showcase; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meetings_workshop_showcase ON public.meetings USING btree (show_on_workshops_page, workshop_order) WHERE (show_on_workshops_page = true);


--
-- Name: idx_moderation_log_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_moderation_log_action ON public.moderation_log USING btree (action, created_at DESC);


--
-- Name: idx_moderation_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_moderation_log_created ON public.moderation_log USING btree (created_at DESC);


--
-- Name: idx_moderation_log_moderator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_moderation_log_moderator ON public.moderation_log USING btree (moderator_id, created_at DESC);


--
-- Name: idx_moderation_log_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_moderation_log_target ON public.moderation_log USING btree (target_type, target_id, created_at DESC);


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
-- Name: idx_notifications_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_actor ON public.notifications USING btree (actor_id, created_at DESC);


--
-- Name: idx_notifications_notifiable; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_notifiable ON public.notifications USING btree (notifiable_type, notifiable_id);


--
-- Name: idx_notifications_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_unread ON public.notifications USING btree (user_id, created_at DESC) WHERE (read_at IS NULL);


--
-- Name: idx_notifications_user_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id, read_at, created_at DESC);


--
-- Name: idx_oidc_codes_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oidc_codes_expires_at ON public.oidc_codes USING btree (expires_at);


--
-- Name: idx_oidc_codes_expires_at_nonce; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oidc_codes_expires_at_nonce ON public.oidc_codes USING btree (expires_at) WHERE (nonce IS NOT NULL);


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
-- Name: idx_polls_creator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_polls_creator ON public.availability_polls USING btree (creator_id);


--
-- Name: idx_polls_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_polls_dates ON public.availability_polls USING btree (start_date, end_date);


--
-- Name: idx_polls_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_polls_org ON public.availability_polls USING btree (org_id);


--
-- Name: idx_polls_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_polls_status ON public.availability_polls USING btree (status) WHERE ((status)::text = 'open'::text);


--
-- Name: idx_posts_author; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_author ON public.posts USING btree (author_id);


--
-- Name: idx_posts_last_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_last_activity ON public.posts USING btree (last_activity_at DESC) WHERE ((status)::text = 'published'::text);


--
-- Name: idx_posts_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_org ON public.posts USING btree (org_id);


--
-- Name: idx_posts_pinned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_pinned ON public.posts USING btree (org_id, is_pinned, last_activity_at DESC) WHERE ((status)::text = 'published'::text);


--
-- Name: idx_posts_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_published ON public.posts USING btree (published_at DESC) WHERE ((status)::text = 'published'::text);


--
-- Name: idx_posts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_status ON public.posts USING btree (status);


--
-- Name: idx_posts_visibility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_visibility ON public.posts USING btree (visibility) WHERE ((status)::text = 'published'::text);


--
-- Name: idx_question_polls_creator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_question_polls_creator ON public.question_polls USING btree (creator_id);


--
-- Name: idx_question_polls_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_question_polls_org ON public.question_polls USING btree (org_id);


--
-- Name: idx_question_polls_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_question_polls_status ON public.question_polls USING btree (status) WHERE ((status)::text = 'open'::text);


--
-- Name: idx_reactions_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reactions_created ON public.reactions USING btree (created_at DESC);


--
-- Name: idx_reactions_reactable; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reactions_reactable ON public.reactions USING btree (reactable_type, reactable_id, reaction_type);


--
-- Name: idx_reactions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reactions_user ON public.reactions USING btree (user_id, created_at DESC);


--
-- Name: idx_replies_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_replies_created ON public.replies USING btree (created_at DESC);


--
-- Name: idx_replies_edited; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_replies_edited ON public.replies USING btree (edited_at DESC) WHERE (edited_at IS NOT NULL);


--
-- Name: idx_replies_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_replies_parent ON public.replies USING btree (parent_type, parent_id);


--
-- Name: idx_replies_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_replies_user ON public.replies USING btree (user_id);


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
-- Name: idx_rsvp_meeting; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rsvp_meeting ON public.rsvp_responses USING btree (meeting_id);


--
-- Name: idx_rsvp_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rsvp_org ON public.rsvp_responses USING btree (org_id, created_at DESC);


--
-- Name: idx_slots_response; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slots_response ON public.availability_slots USING btree (response_id);


--
-- Name: idx_slots_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slots_time ON public.availability_slots USING btree (time_slot);


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

CREATE INDEX idx_watches_user ON public.watches USING btree (user_id, started_at DESC);


--
-- Name: idx_watches_watchable; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_watches_watchable ON public.watches USING btree (watchable_type, watchable_id);


--
-- Name: tenants_external_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tenants_external_id_index ON public.tenants USING btree (external_id);


--
-- Name: users_auth_user_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_auth_user_id_unique ON public.users USING btree (auth_user_id) WHERE (auth_user_id IS NOT NULL);


--
-- Name: event_pages trigger_event_pages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_event_pages_updated_at BEFORE UPDATE ON public.event_pages FOR EACH ROW EXECUTE FUNCTION public.update_event_pages_updated_at();


--
-- Name: poll_votes trigger_poll_vote_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_poll_vote_count AFTER INSERT OR DELETE ON public.poll_votes FOR EACH ROW EXECUTE FUNCTION public.update_poll_option_vote_count();


--
-- Name: availability_polls trigger_polls_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_polls_updated_at BEFORE UPDATE ON public.availability_polls FOR EACH ROW EXECUTE FUNCTION public.update_availability_updated_at();


--
-- Name: question_polls trigger_question_polls_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_question_polls_updated_at BEFORE UPDATE ON public.question_polls FOR EACH ROW EXECUTE FUNCTION public.update_availability_updated_at();


--
-- Name: availability_responses trigger_responses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_responses_updated_at BEFORE UPDATE ON public.availability_responses FOR EACH ROW EXECUTE FUNCTION public.update_availability_updated_at();


--
-- Name: availability_responses trigger_update_poll_response_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_poll_response_count AFTER INSERT OR DELETE ON public.availability_responses FOR EACH ROW EXECUTE FUNCTION public.update_poll_response_count();


--
-- Name: reactions trigger_update_reaction_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_reaction_count AFTER INSERT OR DELETE ON public.reactions FOR EACH ROW EXECUTE FUNCTION public.update_reaction_count();


--
-- Name: replies trigger_update_reply_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_reply_count AFTER INSERT OR DELETE ON public.replies FOR EACH ROW EXECUTE FUNCTION public.update_reply_count();


--
-- Name: replies trigger_update_thread_activity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_thread_activity AFTER INSERT ON public.replies FOR EACH ROW EXECUTE FUNCTION public.update_thread_activity();


--
-- Name: availability_polls availability_polls_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_polls
    ADD CONSTRAINT availability_polls_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(id);


--
-- Name: availability_polls availability_polls_final_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_polls
    ADD CONSTRAINT availability_polls_final_meeting_id_fkey FOREIGN KEY (final_meeting_id) REFERENCES public.meetings(id);


--
-- Name: availability_polls availability_polls_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_polls
    ADD CONSTRAINT availability_polls_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: availability_responses availability_responses_poll_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_responses
    ADD CONSTRAINT availability_responses_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES public.availability_polls(id) ON DELETE CASCADE;


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
-- Name: bookmarks bookmarks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


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
-- Name: event_pages event_pages_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_pages
    ADD CONSTRAINT event_pages_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE CASCADE;


--
-- Name: event_pages event_pages_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_pages
    ADD CONSTRAINT event_pages_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


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
-- Name: flags flags_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flags
    ADD CONSTRAINT flags_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: flags flags_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flags
    ADD CONSTRAINT flags_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


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
-- Name: meeting_attendees meeting_attendees_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_attendees
    ADD CONSTRAINT meeting_attendees_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE CASCADE;


--
-- Name: meeting_attendees meeting_attendees_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_attendees
    ADD CONSTRAINT meeting_attendees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: meeting_topics meeting_topics_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_topics
    ADD CONSTRAINT meeting_topics_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE CASCADE;


--
-- Name: meeting_topics meeting_topics_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_topics
    ADD CONSTRAINT meeting_topics_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id) ON DELETE CASCADE;


--
-- Name: meetings meetings_guide_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_guide_id_fkey FOREIGN KEY (guide_id) REFERENCES public.users(id);


--
-- Name: meetings meetings_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: moderation_log moderation_log_moderator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_log
    ADD CONSTRAINT moderation_log_moderator_id_fkey FOREIGN KEY (moderator_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;


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
-- Name: poll_options poll_options_poll_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_options
    ADD CONSTRAINT poll_options_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES public.question_polls(id) ON DELETE CASCADE;


--
-- Name: poll_votes poll_votes_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_votes
    ADD CONSTRAINT poll_votes_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.poll_options(id) ON DELETE CASCADE;


--
-- Name: poll_votes poll_votes_poll_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_votes
    ADD CONSTRAINT poll_votes_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES public.question_polls(id) ON DELETE CASCADE;


--
-- Name: poll_votes poll_votes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_votes
    ADD CONSTRAINT poll_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: post_topics post_topics_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_topics
    ADD CONSTRAINT post_topics_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: post_topics post_topics_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_topics
    ADD CONSTRAINT post_topics_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id) ON DELETE CASCADE;


--
-- Name: posts posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: posts posts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: question_polls question_polls_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_polls
    ADD CONSTRAINT question_polls_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(id);


--
-- Name: question_polls question_polls_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_polls
    ADD CONSTRAINT question_polls_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: reactions reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: replies replies_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.replies
    ADD CONSTRAINT replies_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: rsvp_responses rsvp_responses_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rsvp_responses
    ADD CONSTRAINT rsvp_responses_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE CASCADE;


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
-- Name: watches watches_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watches
    ADD CONSTRAINT watches_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users Profiles are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles are viewable by everyone" ON public.users FOR SELECT USING (true);


--
-- Name: users Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING ((auth.uid() = auth_user_id)) WITH CHECK ((auth.uid() = auth_user_id));


--
-- Name: meeting_attendees Users can view attendees in their orgs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view attendees in their orgs" ON public.meeting_attendees FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.meetings m
  WHERE (((m.id)::text = (meeting_attendees.meeting_id)::text) AND public.user_belongs_to_org(m.org_id)))));


--
-- Name: meetings Users can view meetings in their orgs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view meetings in their orgs" ON public.meetings FOR SELECT USING (public.user_belongs_to_org(org_id));


--
-- Name: notifications Users can view own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: watches Users can view own watches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own watches" ON public.watches FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: availability_responses Users can view poll responses in their orgs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view poll responses in their orgs" ON public.availability_responses FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.availability_polls ap
  WHERE (((ap.id)::text = (availability_responses.poll_id)::text) AND public.user_belongs_to_org(ap.org_id)))));


--
-- Name: availability_slots Users can view poll slots in their orgs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view poll slots in their orgs" ON public.availability_slots FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.availability_responses ar
     JOIN public.availability_polls ap ON (((ap.id)::text = (ar.poll_id)::text)))
  WHERE (((ar.id)::text = (availability_slots.response_id)::text) AND public.user_belongs_to_org(ap.org_id)))));


--
-- Name: posts Users can view posts in their orgs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view posts in their orgs" ON public.posts FOR SELECT USING (public.user_belongs_to_org(org_id));


--
-- Name: reactions Users can view reactions in their orgs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view reactions in their orgs" ON public.reactions FOR SELECT USING (
CASE
    WHEN ((reactable_type)::text = 'post'::text) THEN (EXISTS ( SELECT 1
       FROM public.posts p
      WHERE (((p.id)::text = (reactions.reactable_id)::text) AND public.user_belongs_to_org(p.org_id))))
    WHEN ((reactable_type)::text = 'meeting'::text) THEN (EXISTS ( SELECT 1
       FROM public.meetings m
      WHERE (((m.id)::text = (reactions.reactable_id)::text) AND public.user_belongs_to_org(m.org_id))))
    ELSE true
END);


--
-- Name: replies Users can view replies in their orgs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view replies in their orgs" ON public.replies FOR SELECT USING (
CASE
    WHEN ((parent_type)::text = 'post'::text) THEN (EXISTS ( SELECT 1
       FROM public.posts p
      WHERE (((p.id)::text = (replies.parent_id)::text) AND public.user_belongs_to_org(p.org_id))))
    WHEN ((parent_type)::text = 'meeting'::text) THEN (EXISTS ( SELECT 1
       FROM public.meetings m
      WHERE (((m.id)::text = (replies.parent_id)::text) AND public.user_belongs_to_org(m.org_id))))
    ELSE true
END);


--
-- Name: availability_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.availability_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: availability_slots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;

--
-- Name: meeting_attendees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meeting_attendees ENABLE ROW LEVEL SECURITY;

--
-- Name: meetings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

--
-- Name: reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: replies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.replies ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: watches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.watches ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict hdUHa1kunoGfqc1FC6f7MeDrK60ScFBrMTIfZYh6Iu7Lne2LGHjCwUx2Lgxmuc2

