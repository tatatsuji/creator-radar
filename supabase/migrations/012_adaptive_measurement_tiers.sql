-- Phase 11: Adaptive Measurement tiers (critical/high/normal/low/archive).
alter table public.measurement_schedule
  drop constraint if exists measurement_schedule_tier_check;

alter table public.measurement_schedule
  add constraint measurement_schedule_tier_check
    check (
      measurement_tier in (
        'critical',
        'high',
        'normal',
        'low',
        'archive',
        'hot',
        'active',
        'cold'
      )
    );
