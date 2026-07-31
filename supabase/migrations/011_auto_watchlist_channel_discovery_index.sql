-- Phase 4: speed up Auto Watchlist metrics queries on candidate_discoveries.
create index if not exists idx_candidate_discoveries_channel_discovered
  on public.candidate_discoveries (channel_id, discovered_at desc)
  where channel_id is not null;
