-- Run in Supabase SQL editor after creating the project.
-- Creates a private bucket for transcript binaries.

insert into storage.buckets (id, name, public)
values ('transcript-files', 'transcript-files', false)
on conflict (id) do nothing;

-- Service role bypasses RLS; keep anon/authenticated denied by default.
