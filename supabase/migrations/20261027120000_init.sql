-- Stenotipisi / Astraea — Supabase schema for Vercel serverless API
-- API uses the service role key; RLS denies direct anon/authenticated client access.

create extension if not exists "pgcrypto";

-- Whole JSON collections (mirrors former database/*.json files)
create table if not exists public.app_collections (
  name text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Durable MFA challenge tokens (replaces in-memory Map)
create table if not exists public.mfa_challenges (
  token text primary key,
  user_id text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists mfa_challenges_expires_at_idx
  on public.mfa_challenges (expires_at);

-- Auth sessions (replaces insecure local-{userId} tokens)
create table if not exists public.auth_sessions (
  token text primary key,
  user_id text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists auth_sessions_user_id_idx
  on public.auth_sessions (user_id);

-- Password reset tokens
create table if not exists public.password_resets (
  token text primary key,
  user_id text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists password_resets_user_id_idx
  on public.password_resets (user_id);

-- Audit trail (also kept in app_collections for parity; this table is canonical for queries)
create table if not exists public.audit_trail (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists audit_trail_created_at_idx
  on public.audit_trail (created_at desc);

alter table public.app_collections enable row level security;
alter table public.mfa_challenges enable row level security;
alter table public.auth_sessions enable row level security;
alter table public.password_resets enable row level security;
alter table public.audit_trail enable row level security;

-- No policies for anon/authenticated — service role bypasses RLS.
