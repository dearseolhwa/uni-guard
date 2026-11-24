-- Migration 047 · one-hour LGU escalation for unverified barangay reports.
-- Replaying this file after 051 must not replace the current queue or RPC.
do $migration$
begin
  if to_regprocedure('public.lgu_verify_overdue_report(uuid,text)') is not null then
    return;
  end if;

/* ---------------------------------------------------------------------------
   1. escalation_status column on reports
   ---------------------------------------------------------------------------
   Adds an explicit, persisted escalation flag to the reports table so the
   LGU dashboard can read it directly without recomputing on every render.
   The trigger in step 2 keeps it in sync with the report's verification
   status and created_at.
*/
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS escalation_status text NOT NULL DEFAULT 'pending'
  CHECK (escalation_status IN ('pending','overdue','verified','cancelled'));

COMMENT ON COLUMN public.reports.escalation_status IS
  'pending = within the 1-hour barangay verification window; overdue = the window elapsed and the LGU verification queue should surface it; verified = the report has been verified (by the barangay official or LGU); cancelled = the report was rejected/archived and is no longer eligible for escalation.';

/* ---------------------------------------------------------------------------
   2. trigger that flips escalation_status to 'overdue' on the 1-hour boundary
   ---------------------------------------------------------------------------
   A Postgres trigger fires on every INSERT/UPDATE on reports. When the
   report's status is still 'reported' AND created_at is more than 1 hour
   ago AND escalation_status is still 'pending', it flips to 'overdue'.
   Once the report is verified (status moves past 'verified'/'resolved'),
   it becomes 'verified' and stays that way. Rejected/archived reports
   become 'cancelled'.
*/
CREATE OR REPLACE FUNCTION public.ug_refresh_escalation_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  age_hours numeric;
BEGIN
  age_hours := EXTRACT(EPOCH FROM (now() - COALESCE(NEW.created_at, now()))) / 3600.0;

  IF NEW.status IN ('rejected') THEN
    NEW.escalation_status := 'cancelled';
  ELSIF NEW.status IN ('verified','dispatched','resolved') THEN
    NEW.escalation_status := 'verified';
  ELSIF NEW.status = 'reported' AND age_hours >= 1.0 THEN
    -- exactly at the 1-hour boundary: surface to LGU
    NEW.escalation_status := 'overdue';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reports_escalation ON public.reports;
CREATE TRIGGER trg_reports_escalation
  BEFORE INSERT OR UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.ug_refresh_escalation_status();

/* ---------------------------------------------------------------------------
   3. backfill the column on existing rows
   ---------------------------------------------------------------------------
   The trigger only fires on new writes, so existing rows need a one-shot
   backfill that applies the same rules. Idempotent — re-running the UPDATE
   leaves rows in the same state because the trigger enforces the rule on
   subsequent writes.
*/
UPDATE public.reports
   SET escalation_status = CASE
     WHEN status IN ('rejected') THEN 'cancelled'
     WHEN status IN ('verified','dispatched','resolved') THEN 'verified'
     WHEN status = 'reported' AND EXTRACT(EPOCH FROM (now() - created_at)) / 3600.0 >= 1.0 THEN 'overdue'
     ELSE 'pending'
   END
WHERE escalation_status IS NULL OR escalation_status = 'pending';

/* ---------------------------------------------------------------------------
   4. lgu_escalation_queue view
   ---------------------------------------------------------------------------
   A read-only view that the LGU dashboard can read directly. Returns every
   report whose escalation_status is 'overdue' (i.e. the 1-hour window has
   elapsed without a barangay verification) along with the columns the LGU
   verification screen needs.
*/
CREATE OR REPLACE VIEW public.lgu_escalation_queue WITH (security_invoker = true) AS
SELECT
  r.id, r.code, r.hazard_type, r.barangay, r.barangay_id,
  r.severity, r.description, r.status,
  r.created_at,
  EXTRACT(EPOCH FROM (now() - r.created_at)) / 60.0 AS minutes_since_submission,
  r.escalation_status
FROM public.reports r
WHERE r.escalation_status = 'overdue'
ORDER BY r.created_at ASC;

COMMENT ON VIEW public.lgu_escalation_queue IS
  'Reports that the Barangay Official has not verified within 1 hour of submission. Surfaced to the LGU as a fallback verification queue. The original barangay official can still verify later.';

-- This compatibility signature is removed by 051.
create or replace function public.lgu_verify_overdue_report(p_report_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_report public.reports;
begin
  if not public.is_active_user() or not public.is_lgu() or public.is_super_admin() then
    raise insufficient_privilege using message = 'Only LGU duty staff can verify overdue reports';
  end if;
  select * into v_report from public.reports where id = p_report_id for update;
  if not found then raise no_data_found using message = 'Report not found'; end if;
  if v_report.status in ('verified','dispatched','resolved') then
    return jsonb_build_object('ok', true, 'already_verified', true, 'report_id', p_report_id);
  end if;
  if v_report.status <> 'reported' or v_report.created_at > now() - interval '1 hour' then
    raise exception 'This report is not waiting for overdue verification';
  end if;
  return public.lgu_verify_report(p_report_id, 'Overdue: waiting for barangay verification for 1 hour')
    || jsonb_build_object('ok', true, 'report_id', p_report_id);
end;
$$;

revoke all on function public.lgu_verify_overdue_report(uuid) from public, anon;
grant execute on function public.lgu_verify_overdue_report(uuid) to authenticated;
drop policy if exists "reports_lgu_escalation_read" on public.reports;
revoke all on public.lgu_escalation_queue from public, anon;
grant select on public.lgu_escalation_queue to authenticated;
end;
$migration$;
