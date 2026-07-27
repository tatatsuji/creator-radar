-- Phase 1: Candidate video enrichment (additive)

alter table public.channels
  add column if not exists subscriber_count bigint;

alter table public.videos
  add column if not exists description text,
  add column if not exists view_count bigint,
  add column if not exists like_count bigint,
  add column if not exists comment_count bigint,
  add column if not exists tags text[],
  add column if not exists content_features jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'channels_subscriber_count_nonneg'
  ) then
    alter table public.channels
      add constraint channels_subscriber_count_nonneg
      check (subscriber_count is null or subscriber_count >= 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'videos_view_count_nonneg'
  ) then
    alter table public.videos
      add constraint videos_view_count_nonneg
      check (view_count is null or view_count >= 0);
  end if;
end $$;

create index if not exists idx_videos_content_features
  on public.videos using gin (content_features);
