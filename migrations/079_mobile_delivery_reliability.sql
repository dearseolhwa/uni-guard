begin;

alter table public.push_subscriptions
  add column if not exists renewal_token_hash text,
  add column if not exists renewal_session_id text;

-- Only supported push provider addresses can be registered by these RPCs.
create or replace function public.mobile_push_address_valid(p_endpoint text, p_p256dh text, p_auth text)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select coalesce(length(p_endpoint) <= 2048
    and p_endpoint ~ '^https://(fcm[.]googleapis[.]com|android[.]googleapis[.]com|([a-z0-9-]+[.])?push[.]services[.]mozilla[.]com|[a-z0-9-]+[.]push[.]apple[.]com|[a-z0-9-]+[.]notify[.]windows[.]com)/[^[:space:][:cntrl:]]+$'
    and p_p256dh ~ '^[A-Za-z0-9_-]{87}=?$'
    and p_auth ~ '^[A-Za-z0-9_-]{22}={0,2}$', false);
$$;

-- An endpoint belongs to one account. A different account must subscribe
-- again on the device, which invalidates the old browser subscription.
create or replace function public.sync_mobile_push_device(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text,
  p_renewal_token uuid, p_previous_endpoint text default null
)
returns boolean language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_user uuid := auth.uid();
  v_session text := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'session_id';
  v_hash text := encode(sha256(convert_to(p_renewal_token::text, 'UTF8')), 'hex');
  v_saved uuid;
begin
  if not public.is_active_user() or public.account_session_blocked() then
    raise insufficient_privilege using message = 'Sign in with an active account to register this device';
  end if;
  if p_renewal_token is null or not public.mobile_push_address_valid(p_endpoint,p_p256dh,p_auth) then
    raise invalid_parameter_value using message = 'Invalid push subscription';
  end if;
  insert into public.push_subscriptions(user_id, endpoint, p256dh, auth, user_agent, renewal_token_hash, renewal_session_id)
  values (v_user, p_endpoint, p_p256dh, p_auth, left(coalesce(p_user_agent,''),200), v_hash, v_session)
  on conflict (endpoint) do update
    set p256dh=excluded.p256dh, auth=excluded.auth, user_agent=excluded.user_agent,
        renewal_token_hash=excluded.renewal_token_hash, renewal_session_id=excluded.renewal_session_id
    where push_subscriptions.user_id=v_user
  returning id into v_saved;
  if v_saved is null then return false; end if;
  if p_previous_endpoint is distinct from p_endpoint then
    delete from public.push_subscriptions where user_id=v_user and endpoint=p_previous_endpoint;
  end if;
  return true;
end;
$$;

-- The worker can replace one existing endpoint without storing a login JWT.
-- The proof is device-specific and cannot create rows or change their owner.
create or replace function public.renew_mobile_push_device(
  p_previous_endpoint text, p_renewal_token uuid, p_endpoint text, p_p256dh text, p_auth text
)
returns boolean language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_hash text := encode(sha256(convert_to(p_renewal_token::text, 'UTF8')), 'hex');
begin
  if p_renewal_token is null or not public.mobile_push_address_valid(p_endpoint,p_p256dh,p_auth) then
    return false;
  end if;
  update public.push_subscriptions s
     set endpoint=p_endpoint, p256dh=p_p256dh, auth=p_auth
    from public.profiles p
   where s.endpoint=p_previous_endpoint and s.renewal_token_hash=v_hash
     and p.id=s.user_id and not p.disabled
     and exists (
       select 1 from auth.sessions a where a.user_id=s.user_id and a.id::text=s.renewal_session_id
     );
  return found;
exception when unique_violation then
  return false;
end;
$$;
revoke all on function public.sync_mobile_push_device(text,text,text,text,uuid,text) from public, anon;
grant execute on function public.sync_mobile_push_device(text,text,text,text,uuid,text) to authenticated;
revoke all on function public.renew_mobile_push_device(text,uuid,text,text,text) from public;
grant execute on function public.renew_mobile_push_device(text,uuid,text,text,text) to anon, authenticated;

-- A per-alert recipient lease serializes retries and records provider acceptance.
create table if not exists public.advisory_sms_deliveries (
  alert_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  lease_id uuid not null,
  lease_until timestamptz not null,
  sent_at timestamptz,
  primary key (alert_id,user_id)
);
alter table public.advisory_sms_deliveries enable row level security;
revoke all on public.advisory_sms_deliveries from public, anon, authenticated;

create or replace function public.claim_advisory_sms(p_alert_id uuid, p_user_id uuid)
returns uuid language sql security definer set search_path = public, pg_catalog as $$
  insert into public.advisory_sms_deliveries(alert_id,user_id,lease_id,lease_until)
  select p_alert_id,p.id,gen_random_uuid(),now()+interval '5 minutes'
  from public.profiles p where p.id=p_user_id and not p.disabled
  on conflict (alert_id,user_id) do update set lease_id=excluded.lease_id, lease_until=excluded.lease_until
    where advisory_sms_deliveries.sent_at is null and advisory_sms_deliveries.lease_until <= now()
  returning lease_id;
$$;

create or replace function public.finish_advisory_sms(p_alert_id uuid,p_user_id uuid,p_lease_id uuid,p_sent boolean)
returns void language sql security definer set search_path = public, pg_catalog as $$
  update public.advisory_sms_deliveries
     set sent_at=case when p_sent then now() end, lease_until=now()
   where alert_id=p_alert_id and user_id=p_user_id and lease_id=p_lease_id and sent_at is null;
$$;
revoke all on function public.claim_advisory_sms(uuid,uuid) from public, anon, authenticated;
revoke all on function public.finish_advisory_sms(uuid,uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.claim_advisory_sms(uuid,uuid) to service_role;
grant execute on function public.finish_advisory_sms(uuid,uuid,uuid,boolean) to service_role;

notify pgrst, 'reload schema';
commit;
