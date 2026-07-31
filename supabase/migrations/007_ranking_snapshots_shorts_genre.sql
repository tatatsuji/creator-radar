-- Allow shorts as a ranking snapshot genre filter value.
alter table public.ranking_snapshots
  drop constraint if exists ranking_snapshots_genre_check;

alter table public.ranking_snapshots
  add constraint ranking_snapshots_genre_check
  check (genre in (
    'all', 'entertainment', 'music', 'game', 'education',
    'news', 'howto', 'sports', 'other', 'shorts'
  ));
