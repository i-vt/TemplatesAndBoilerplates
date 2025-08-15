--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5 (Ubuntu 17.5-1.pgdg24.04+1)
-- Dumped by pg_dump version 17.5 (Debian 17.5-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

DROP DATABASE myapp_auth;
--
-- Name: myapp_auth; Type: DATABASE; Schema: -; Owner: -
--

CREATE DATABASE myapp_auth WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'en_US.UTF-8';


\connect myapp_auth

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


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
-- Name: log_interaction(uuid, uuid, text, character varying, integer, inet, text, integer, integer, jsonb, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_interaction(p_user_id uuid, p_session_id uuid, p_path text, p_method character varying, p_status integer, p_ip inet, p_user_agent text, p_latency_ms integer, p_response_size_bytes integer, p_metadata jsonb, p_error boolean) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO interaction_log (
    user_id, session_id, path, method, status, ip, user_agent,
    latency_ms, response_size_bytes, metadata, error
  )
  VALUES (
    p_user_id, p_session_id, p_path, p_method, p_status, p_ip, p_user_agent,
    p_latency_ms, p_response_size_bytes, COALESCE(p_metadata, '{}'::jsonb), COALESCE(p_error, false)
  );
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: app_role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_role (
    id smallint NOT NULL,
    name text NOT NULL,
    description text
);


--
-- Name: app_role_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.app_role_id_seq
    AS smallint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: app_role_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.app_role_id_seq OWNED BY public.app_role.id;


--
-- Name: app_user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_user (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email public.citext NOT NULL,
    password_hash text NOT NULL,
    display_name text,
    is_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: auth_session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_session (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    ip inet,
    user_agent text,
    revoked_at timestamp with time zone
);


--
-- Name: interaction_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interaction_log (
    id bigint NOT NULL,
    user_id uuid,
    session_id uuid,
    path text NOT NULL,
    method character varying(10),
    status integer,
    ip inet,
    user_agent text,
    request_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    request_at timestamp with time zone DEFAULT now() NOT NULL,
    latency_ms integer,
    response_size_bytes integer,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    error boolean DEFAULT false NOT NULL
);


--
-- Name: interaction_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.interaction_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: interaction_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.interaction_log_id_seq OWNED BY public.interaction_log.id;


--
-- Name: login_attempt; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_attempt (
    id bigint NOT NULL,
    user_id uuid,
    email public.citext,
    success boolean NOT NULL,
    ip inet,
    user_agent text,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT login_attempt_email_or_user CHECK (((user_id IS NOT NULL) OR (email IS NOT NULL)))
);


--
-- Name: login_attempt_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.login_attempt_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: login_attempt_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.login_attempt_id_seq OWNED BY public.login_attempt.id;


--
-- Name: user_role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_role (
    user_id uuid NOT NULL,
    role_id smallint NOT NULL
);


--
-- Name: app_role id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_role ALTER COLUMN id SET DEFAULT nextval('public.app_role_id_seq'::regclass);


--
-- Name: interaction_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interaction_log ALTER COLUMN id SET DEFAULT nextval('public.interaction_log_id_seq'::regclass);


--
-- Name: login_attempt id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_attempt ALTER COLUMN id SET DEFAULT nextval('public.login_attempt_id_seq'::regclass);


--
-- Name: app_role app_role_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_role
    ADD CONSTRAINT app_role_name_key UNIQUE (name);


--
-- Name: app_role app_role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_role
    ADD CONSTRAINT app_role_pkey PRIMARY KEY (id);


--
-- Name: app_user app_user_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_email_key UNIQUE (email);


--
-- Name: app_user app_user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_pkey PRIMARY KEY (id);


--
-- Name: auth_session auth_session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_session
    ADD CONSTRAINT auth_session_pkey PRIMARY KEY (id);


--
-- Name: interaction_log interaction_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interaction_log
    ADD CONSTRAINT interaction_log_pkey PRIMARY KEY (id);


--
-- Name: login_attempt login_attempt_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_attempt
    ADD CONSTRAINT login_attempt_pkey PRIMARY KEY (id);


--
-- Name: user_role user_role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role
    ADD CONSTRAINT user_role_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: auth_session_expires_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_session_expires_idx ON public.auth_session USING btree (expires_at);


--
-- Name: auth_session_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_session_user_idx ON public.auth_session USING btree (user_id);


--
-- Name: interaction_log_request_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX interaction_log_request_at_idx ON public.interaction_log USING btree (request_at DESC);


--
-- Name: interaction_log_session_request_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX interaction_log_session_request_at_idx ON public.interaction_log USING btree (session_id, request_at DESC);


--
-- Name: interaction_log_user_request_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX interaction_log_user_request_at_idx ON public.interaction_log USING btree (user_id, request_at DESC);


--
-- Name: login_attempt_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX login_attempt_created_at_idx ON public.login_attempt USING btree (created_at DESC);


--
-- Name: login_attempt_user_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX login_attempt_user_created_at_idx ON public.login_attempt USING btree (user_id, created_at DESC);


--
-- Name: app_user app_user_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER app_user_set_updated_at BEFORE UPDATE ON public.app_user FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: auth_session auth_session_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_session
    ADD CONSTRAINT auth_session_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user(id) ON DELETE CASCADE;


--
-- Name: interaction_log interaction_log_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interaction_log
    ADD CONSTRAINT interaction_log_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.auth_session(id) ON DELETE SET NULL;


--
-- Name: interaction_log interaction_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interaction_log
    ADD CONSTRAINT interaction_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user(id) ON DELETE SET NULL;


--
-- Name: login_attempt login_attempt_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_attempt
    ADD CONSTRAINT login_attempt_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user(id) ON DELETE SET NULL;


--
-- Name: user_role user_role_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role
    ADD CONSTRAINT user_role_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.app_role(id) ON DELETE CASCADE;


--
-- Name: user_role user_role_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role
    ADD CONSTRAINT user_role_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--
