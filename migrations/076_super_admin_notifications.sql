-- ============================================================================
--  UniGuard · 076 · Super Admin notifications (stored on the server + push)
--
--  Apply AFTER 075. Idempotent: safe to run more than once.
--
--  What it does
--    · notifications.audience = 'super_admin' marks a notification meant for
--      the Super Admin role. One row is written per active Super Admin, so the
--      normal per-user RLS, realtime feed, read/unread and "mark all read"
--      keep working unchanged.
--    · Created automatically by the database, never by the browser:
--        - a hotline change request is submitted          (needs approval)
--        - account events in audit_log: invited, role or barangay changed,
--          account updated / disabled / enabled / removed, unit member
--          invited, setup email failed
--      The Super Admin who made the change is not notified about it.
--    · Push: every such row is queued (push_status = 'pending'). The
--      admin-notify Edge Function sends it to the Super Admin's subscribed
--      phones. The database wakes the worker right away through pg_net when
--      Vault holds its URL and secret, and a pg_cron job retries every two
--      minutes. Without them the rows still appear in the app; only the push
--      waits. Setup: docs/DEPLOY.md, section "Super Admin push".
-- ============================================================================
begin;

-- ------------------------------------------------------------------ columns
alter table public.notifications add column if not exists audience          text not null default '';
alter table public.notifications add column if not exists target_profile_id uuid references public.profiles(id) on delete set null;
alter table public.notifications add column if not exists change_request_id uuid references public.change_requests(id) on delete set null;
alter table public.notifications add column if not exists push_status       text;
alter table public.notifications add column if not exists push_attempts     integer not null default 0;
alter table public.notifications add column if not exists push_next_at      timestamptz not null default now();
alter table public.notifications add column if not exists push_lease        uuid;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'notifications_push_status_check') then
    alter table public.notifications add constraint notifications_push_status_check
      check (push_status is null or push_status in ('pending','processing','sent','none','failed'));
  end if;
end $$;

create index if not exists notifications_push_ready_idx on public.notifications (push_next_at)
  where push_status in ('pending','processing');
create index if not exists notifications_audience_idx on public.notifications (user_id, created_at desc)
  where audience = 'super_admin';

-- push bookkeeping is the worker's business, never the browser's
create or replace function public.guard_notification_push_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and (
    new.push_status is distinct from old.push_status or new.push_attempts is distinct from old.push_attempts or
    new.push_next_at is distinct from old.push_next_at or new.push_lease is distinct from old.push_lease or
    new.audience is distinct from old.audience or new.user_id is distinct from old.user_id)
  then raise insufficient_privilege using message = 'Only read status can be changed on a notification'; end if;
  return new;
end $$;
drop trigger if exists notifications_guard_push on public.notifications;
create trigger notifications_guard_push before update on public.notifications
for each row execute function public.guard_notification_push_columns();

-- ------------------------------------------------------- wake the worker
-- Best effort: needs pg_net and two Vault secrets. Any problem is swallowed,
-- so creating a notification can never fail because push is not set up.
create or replace function public.kick_admin_notify()
returns void language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
  if to_regnamespace('net') is null or to_regnamespace('vault') is null then return; end if;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'uniguard_admin_notify_url'$q$ into v_url;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'uniguard_admin_notify_secret'$q$ into v_secret;
  if v_url is null or v_secret is null then return; end if;
  execute 'select net.http_post(url := $1, headers := $2, body := $3)'
    using v_url, jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret), '{}'::jsonb;
exception when others then
  raise notice 'admin-notify worker not called: %', sqlerrm;
end $$;
revoke all on function public.kick_admin_notify() from public, anon, authenticated;

-- The worker checks its bearer token against the same Vault secret, so no
-- Edge Function secret has to be set (that needs project-admin rights).
create or replace function public.admin_notify_token_ok(p_token text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_secret text;
begin
  if coalesce(p_token, '') = '' or to_regnamespace('vault') is null then return false; end if;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'uniguard_admin_notify_secret'$q$ into v_secret;
  return v_secret is not null and v_secret = p_token;
exception when others then
  return false;
end $$;
revoke all on function public.admin_notify_token_ok(text) from public, anon, authenticated;
grant execute on function public.admin_notify_token_ok(text) to service_role;

-- ---------------------------------------------- one row per Super Admin
create or replace function public.notify_super_admins(
  p_title text, p_body text, p_tone text, p_icon text, p_type text,
  p_actor uuid default null, p_target_profile uuid default null, p_change_request uuid default null
) returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into public.notifications (user_id, title, body, tone, icon, type, audience,
                                    target_profile_id, change_request_id, push_status)
  select p.id, left(coalesce(p_title, ''), 200), left(coalesce(p_body, ''), 500), coalesce(p_tone, 'advisory'),
         coalesce(p_icon, 'bell'), p_type, 'super_admin', p_target_profile, p_change_request, 'pending'
    from public.profiles p
   where p.role = 'lgu_ldrrmc' and p.is_super_admin and not p.disabled and p.removed_at is null
     and p.id is distinct from p_actor;
  get diagnostics n = row_count;
  if n > 0 then perform public.kick_admin_notify(); end if;
  return n;
end $$;
revoke all on function public.notify_super_admins(text,text,text,text,text,uuid,uuid,uuid) from public, anon, authenticated;

create or replace function public.sa_role_word(p_role text)
returns text language sql immutable as $$
  select case p_role when 'citizen' then 'Resident' when 'barangay_official' then 'Barangay official'
    when 'lgu_ldrrmc' then 'LDRRMO staff' when 'dispatch_team' then 'Dispatch staff' when 'super_admin' then 'Super Admin'
    else coalesce(replace(p_role, '_', ' '), 'unknown') end
$$;

-- ---------------------------------------------- change request submitted
create or replace function public.sa_notify_change_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending' then
    perform public.notify_super_admins(
      'Hotline ' || coalesce(nullif(new.action, ''), 'change') || ' request',
      coalesce(nullif(new.requester_name, ''), 'An official') ||
        case when coalesce(new.requester_barangay, '') <> '' then ' (Brgy. ' || new.requester_barangay || ')' else '' end ||
        ' is waiting for your approval.',
      'warning', 'doc', 'sa.change_request', new.requester_id, null, new.id);
  end if;
  return new;
end $$;
drop trigger if exists change_requests_notify_sa on public.change_requests;
create trigger change_requests_notify_sa after insert on public.change_requests
for each row execute function public.sa_notify_change_request();

-- ------------------------------------------------------- account events
create or replace function public.sa_notify_account_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.meta, '{}'::jsonb);
  who text; target text; title text; body text; tone text := 'advisory'; icon text := 'users';
begin
  select coalesce(nullif(full_name, ''), email) into who from public.profiles where id = new.actor_id;
  who := coalesce(who, 'The system');
  if new.entity = 'profiles' and new.entity_id is not null then
    select coalesce(nullif(full_name, ''), email) into target from public.profiles where id = new.entity_id;
  end if;
  target := coalesce(target, m->>'email', 'an account');

  case new.action
    when 'user.invited' then
      title := 'New account invited';
      body := who || ' invited ' || coalesce(m->>'email', target) || ' as ' || public.sa_role_word(coalesce(m->>'role', 'barangay_official')) || '.';
    when 'unit.member_invited' then
      title := 'Unit member invited'; body := who || ' invited ' || coalesce(m->>'email', target) || ' to a dispatch unit.';
    when 'user.role_changed' then
      title := 'Role changed'; icon := 'shield';
      body := who || ' changed ' || target || '''s role to ' || public.sa_role_word(m->>'to') || '.';
    when 'user.account_updated' then
      title := 'Account updated';
      body := who || ' updated ' || target || ' (' || public.sa_role_word(m->>'role') || ').';
    when 'user.barangay_changed' then
      title := 'Barangay changed'; body := who || ' moved ' || target || ' to ' || coalesce(nullif(m->>'name', ''), 'no barangay') || '.';
    when 'user.disabled' then
      title := 'Account disabled'; tone := 'warning'; icon := 'shield'; body := who || ' disabled ' || target || '.';
    when 'user.enabled' then
      title := 'Account enabled'; icon := 'shield'; body := who || ' enabled ' || target || ' again.';
    when 'user.removed' then
      title := 'Account removed'; tone := 'warning'; icon := 'x'; body := who || ' removed ' || target || '.';
    when 'user.invitation_retry_failed' then
      title := 'Setup email failed'; tone := 'warning'; icon := 'alert';
      body := 'The setup email to ' || target || ' could not be sent. Check the address or try again.';
    else return new;
  end case;

  perform public.notify_super_admins(title, body, tone, icon, 'sa.account', new.actor_id,
    case when new.entity = 'profiles' then new.entity_id end, null);
  return new;
end $$;
drop trigger if exists audit_log_notify_sa on public.audit_log;
create trigger audit_log_notify_sa after insert on public.audit_log
for each row when (new.action in ('user.invited','unit.member_invited','user.role_changed','user.account_updated',
  'user.barangay_changed','user.disabled','user.enabled','user.removed','user.invitation_retry_failed'))
execute function public.sa_notify_account_event();

-- ------------------------------------------------------- the push queue
create or replace function public.claim_admin_push(p_limit integer default 50)
returns setof public.notifications language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.notifications n
     set push_status = 'processing', push_lease = gen_random_uuid(), push_attempts = n.push_attempts + 1,
         push_next_at = now() + interval '2 minutes'
   where n.id in (
     select id from public.notifications
      where audience = 'super_admin' and push_status in ('pending', 'processing') and push_next_at <= now()
      order by created_at limit greatest(1, least(coalesce(p_limit, 50), 200))
      for update skip locked)
  returning n.*;
end $$;

create or replace function public.finish_admin_push(p_id uuid, p_lease uuid, p_outcome text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.notifications set
    push_status = case
      when p_outcome in ('sent', 'none') then p_outcome
      when p_outcome = 'retry' and push_attempts < 4 then 'pending'
      else 'failed' end,
    push_next_at = case when p_outcome = 'retry' then now() + make_interval(mins => power(2, push_attempts)::int) else push_next_at end,
    push_lease = null
  where id = p_id and push_lease = p_lease;
end $$;
revoke all on function public.claim_admin_push(integer) from public, anon, authenticated;
revoke all on function public.finish_admin_push(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_admin_push(integer) to service_role;
grant execute on function public.finish_admin_push(uuid, uuid, text) to service_role;

-- retries: every two minutes when pg_cron is available (skipped quietly otherwise)
do $$
begin
  if to_regnamespace('cron') is not null then
    perform cron.unschedule(jobid) from cron.job where jobname = 'uniguard-admin-notify';
    perform cron.schedule('uniguard-admin-notify', '*/2 * * * *', 'select public.kick_admin_notify()');
  else
    raise notice 'pg_cron is not enabled: Super Admin push retries are not scheduled (new pushes are still sent right away when pg_net is set up).';
  end if;
exception when others then
  raise notice 'Super Admin push retry job not scheduled: %', sqlerrm;
end $$;

commit;

-- Verify:
--   select title, body, push_status from public.notifications where audience = 'super_admin' order by created_at desc limit 10;
