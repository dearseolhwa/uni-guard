-- ============================================================================
--  UniGuard · 063 · Scheduled maintenance jobs
--
--  Two jobs were documented but never scheduled, so they never ran:
--
--    · refresh_overdue_reports()  every 5 minutes (051)
--      Stores the "overdue, needs the LGU" escalation on reports left
--      unverified for an hour. Without it the flag is only worked out on
--      screen and never saved, so the escalation queue and analytics miss it.
--
--    · cleanup_rate_limits()      nightly at 04:00 (009)
--      Prunes rate-limit buckets older than a day so the table stops growing.
--
--  Uses pg_cron (Supabase: Database → Extensions → pg_cron). The migration
--  enables it when it can; if the project does not allow that, it prints a
--  notice and changes nothing, and you can enable pg_cron and run this again.
--
--  Safe to re-run: the jobs are replaced, never duplicated. Run after 062.
-- ============================================================================

do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron could not be enabled here (%). Enable it under Database → Extensions, then run 063 again.', sqlerrm;
    return;
  end;

  -- replace, never duplicate
  begin
    perform cron.unschedule(jobid) from cron.job
     where jobname in ('uniguard-overdue-reports', 'uniguard-cleanup');
  exception when others then null;
  end;

  if to_regprocedure('public.refresh_overdue_reports()') is not null then
    perform cron.schedule('uniguard-overdue-reports', '*/5 * * * *', 'select public.refresh_overdue_reports()');
  else
    raise notice 'refresh_overdue_reports() not found (run 051 first); that job was not scheduled.';
  end if;

  if to_regprocedure('public.cleanup_rate_limits()') is not null then
    perform cron.schedule('uniguard-cleanup', '0 4 * * *', 'select public.cleanup_rate_limits()');
  else
    raise notice 'cleanup_rate_limits() not found (run 009 first); that job was not scheduled.';
  end if;
end $$;

-- check:  select jobname, schedule, command, active from cron.job where jobname like 'uniguard-%';
