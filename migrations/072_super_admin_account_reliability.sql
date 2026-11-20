begin;

alter table public.profiles add column if not exists sessions_revoked_at timestamptz;
alter table public.profiles add column if not exists invite_last_attempt_at timestamptz;
alter table public.profiles add column if not exists invite_last_failed boolean not null default false;

create or replace function public.account_session_blocked()
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.profiles p where p.id=auth.uid() and (
      p.disabled or (p.sessions_revoked_at is not null and not exists (
        select 1 from auth.sessions s where s.user_id=p.id
        and s.id::text = (nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'session_id')
      ))
    )
  );
$$;
revoke all on function public.account_session_blocked() from public, anon;
grant execute on function public.account_session_blocked() to authenticated;

-- PostgREST invokes this before table requests and security-definer RPCs.
create or replace function public.enforce_account_session()
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null and public.account_session_blocked() then
    raise insufficient_privilege using message='This account or session has been disabled. Sign in again if your account is active.';
  end if;
end $$;
revoke all on function public.enforce_account_session() from public;
grant execute on function public.enforce_account_session() to anon, authenticated, service_role;

do $$
declare saved_hook text;
begin
  if exists(select 1 from pg_roles where rolname='authenticator') then
    select split_part(c,'=',2) into saved_hook
    from pg_db_role_setting s join pg_roles r on r.oid=s.setrole
    cross join lateral unnest(s.setconfig) c
    where r.rolname='authenticator' and c like 'pgrst.db_pre_request=%'
      and (s.setdatabase=0 or s.setdatabase=(select oid from pg_database where datname=current_database()))
    order by s.setdatabase desc limit 1;
    if saved_hook is null or saved_hook='public.enforce_account_session' then
      execute 'alter role authenticator set pgrst.db_pre_request to ''public.enforce_account_session''';
    else
      raise warning 'Keep the existing PostgREST pre-request hook and call public.enforce_account_session() from it before rollout';
    end if;
    perform pg_notify('pgrst','reload config');
  end if;
end $$;

-- Covers table reads through Realtime and other RLS entry points.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname='public' and rowsecurity loop
    execute format('drop policy if exists reject_revoked_session on public.%I',t.tablename);
    execute format('create policy reject_revoked_session on public.%I as restrictive for all to authenticated using (not (select public.account_session_blocked())) with check (not (select public.account_session_blocked()))',t.tablename);
  end loop;
  if exists (select 1 from pg_tables where schemaname='storage' and tablename='objects' and rowsecurity) then
    execute 'drop policy if exists reject_revoked_session on storage.objects';
    execute 'create policy reject_revoked_session on storage.objects as restrictive for all to authenticated using (not (select public.account_session_blocked())) with check (not (select public.account_session_blocked()))';
  end if;
end $$;

create or replace function public.revoke_disabled_account_sessions()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.disabled and not old.disabled then
    new.sessions_revoked_at:=now();
    delete from auth.sessions where user_id=new.id;
    update auth.users set banned_until='9999-12-30 00:00:00+00',updated_at=now()
      where id=new.id and (banned_until is null or banned_until<'9999-12-30 00:00:00+00');
  elsif old.disabled and not new.disabled then
    update auth.users set banned_until=null,updated_at=now()
      where id=new.id and banned_until='9999-12-30 00:00:00+00';
  elsif new.sessions_revoked_at is distinct from old.sessions_revoked_at and auth.uid() is not null then
    raise insufficient_privilege using message='Session revocation is managed by the server';
  end if;
  if auth.uid() is not null and not public.is_super_admin() and
    (new.invite_last_attempt_at is distinct from old.invite_last_attempt_at or new.invite_last_failed is distinct from old.invite_last_failed)
  then raise insufficient_privilege using message='Invitation status is managed by the Super Admin'; end if;
  return new;
end $$;
drop trigger if exists profiles_session_revocation on public.profiles;
create trigger profiles_session_revocation before update on public.profiles
for each row execute function public.revoke_disabled_account_sessions();

create or replace function public.admin_change_account_disabled(p_actor uuid,p_target uuid,p_disabled boolean)
returns public.profiles language plpgsql security definer set search_path=public as $$
declare actor public.profiles; target public.profiles;
begin
  perform pg_advisory_xact_lock(68001);
  select * into actor from public.profiles where id=p_actor and not disabled;
  select * into target from public.profiles where id=p_target and removed_at is null for update;
  if actor.id is null or target.id is null or p_actor=p_target or not (
    (actor.role='lgu_ldrrmc' and actor.is_super_admin) or
    (actor.role='dispatch_team' and actor.unit_role='unit_admin' and target.role='dispatch_team'
      and target.unit_role='member' and actor.dispatch_unit_id=target.dispatch_unit_id)
  ) then raise insufficient_privilege using message='You cannot change this account status'; end if;

  update public.profiles set disabled=p_disabled,updated_at=now()
  where id=p_target returning * into target;
  insert into public.audit_log(actor_id,action,entity,entity_id,meta)
    values(p_actor,case when p_disabled then 'user.disabled' else 'user.enabled' end,'profiles',p_target,'{}');
  return target;
end $$;
revoke all on function public.admin_change_account_disabled(uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.admin_change_account_disabled(uuid,uuid,boolean) to service_role;

-- Existing disabled accounts also lose their previously issued sessions.
update public.profiles set sessions_revoked_at=now() where disabled and removed_at is null;
delete from auth.sessions s using public.profiles p where p.id=s.user_id and p.disabled;
update auth.users u set banned_until='9999-12-30 00:00:00+00',updated_at=now()
from public.profiles p where p.id=u.id and p.disabled and p.removed_at is null
and (u.banned_until is null or u.banned_until<'9999-12-30 00:00:00+00');

create or replace function public.admin_edit_staff_account(
  p_target uuid,p_name text,p_phone text,p_role text,p_barangay uuid,p_unit uuid,p_unit_role text
) returns public.profiles language plpgsql security definer set search_path=public as $$
declare target public.profiles; saved public.profiles; scope_name text := '';
begin
  perform pg_advisory_xact_lock(68001);
  if not public.is_super_admin() or public.account_session_blocked() then
    raise insufficient_privilege using message='Only an active Super Admin may edit accounts';
  end if;
  select * into target from public.profiles where id=p_target and removed_at is null for update;
  if target.id is null then raise exception 'Account not found'; end if;
  if p_role is null or p_role not in ('citizen','barangay_official','dispatch_team','lgu_ldrrmc','super_admin')
    or coalesce(btrim(p_name),'')='' then raise exception 'A valid name and role are required'; end if;
  if p_target=auth.uid() and p_role<>'super_admin' then raise exception 'Another Super Admin must change your role'; end if;
  if p_role not in ('citizen','barangay_official') then p_barangay:=null; end if;
  if p_role='barangay_official' and p_barangay is null then raise exception 'Choose a barangay'; end if;
  if p_barangay is not null then
    select name into scope_name from public.barangays where id=p_barangay;
    if not found then raise exception 'Barangay not found'; end if;
  end if;
  if p_role='dispatch_team' then
    if p_unit_role is null or p_unit_role not in ('member','unit_admin') or not exists (
      select 1 from public.dispatch_units where id=p_unit and
        (active or (target.role='dispatch_team' and target.dispatch_unit_id=p_unit and target.unit_role=p_unit_role))
    ) then raise exception 'Choose a valid unit and unit role'; end if;
  else p_unit:=null; p_unit_role:=''; end if;
  update public.profiles set full_name=btrim(p_name),phone=coalesce(btrim(p_phone),''),
    role=case when p_role='super_admin' then 'lgu_ldrrmc' else p_role end,
    is_super_admin=p_role='super_admin',barangay_id=p_barangay,barangay=scope_name,
    dispatch_unit_id=p_unit,unit_role=p_unit_role,updated_at=now()
  where id=p_target returning * into saved;
  perform public.write_audit('user.account_updated','profiles',p_target,
    jsonb_build_object('previous_role',case when target.is_super_admin then 'super_admin' else target.role end,
      'role',p_role,'barangay_id',p_barangay,'dispatch_unit_id',p_unit,'unit_role',p_unit_role));
  return saved;
end $$;
revoke all on function public.admin_edit_staff_account(uuid,text,text,text,uuid,uuid,text) from public, anon;
grant execute on function public.admin_edit_staff_account(uuid,text,text,text,uuid,uuid,text) to authenticated;

create or replace function public.admin_account_directory(p_search text,p_role text,p_status text,p_page int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  if not public.is_super_admin() or public.account_session_blocked() then
    raise insufficient_privilege using message='Only an active Super Admin may search accounts';
  end if;
  with accounts as (
    select p.id,p.full_name,p.email,p.phone,p.role,p.is_super_admin,p.disabled,p.barangay,p.barangay_id,
      p.dispatch_unit_id,p.unit_role,p.created_at,
      case when p.is_super_admin then 'super_admin' else p.role end as role_key,
      case when u.invited_at is null then null when u.last_sign_in_at is not null then 'accepted'
        when p.invite_last_failed then 'failed' else 'pending' end as invitation_status
    from public.profiles p left join auth.users u on u.id=p.id where p.removed_at is null
  ), filtered as (
    select * from accounts a where (p_role='all' or a.role_key=p_role)
      and (p_status='all' or a.disabled=(p_status='disabled'))
      and strpos(lower(concat_ws(' ',a.full_name,a.email,a.barangay)),lower(coalesce(btrim(p_search),'')))>0
  ), paged as (
    select * from filtered order by created_at desc,id limit 25 offset (greatest(coalesce(p_page,1),1)::bigint-1)*25
  )
  select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id) from paged p),'[]'),
    'matched',(select count(*) from filtered),'total',(select count(*) from accounts),
    'disabled',(select count(*) from accounts where disabled),
    'counts',coalesce((select jsonb_object_agg(role_key,n) from (select role_key,count(*) n from accounts group by role_key) grouped),'{}'))
  into result;
  return result;
end $$;
revoke all on function public.admin_account_directory(text,text,text,int) from public, anon;
grant execute on function public.admin_account_directory(text,text,text,int) to authenticated;

create or replace function public.admin_reserve_invitation_retry(p_target uuid)
returns text language plpgsql security definer set search_path=public as $$
declare recipient text;
begin
  if not public.is_super_admin() or public.account_session_blocked() then raise insufficient_privilege; end if;
  update public.profiles p set invite_last_attempt_at=now()
    from auth.users u where p.id=p_target and u.id=p.id and p.removed_at is null and not p.disabled
      and u.invited_at is not null and u.last_sign_in_at is null
      and (p.invite_last_attempt_at is null or p.invite_last_attempt_at < now()-interval '1 minute')
    returning u.email into recipient;
  if recipient is null then raise exception 'Only pending invitations can be resent. Wait a minute between attempts.'; end if;
  return recipient;
end $$;
revoke all on function public.admin_reserve_invitation_retry(uuid) from public, anon;
grant execute on function public.admin_reserve_invitation_retry(uuid) to authenticated;

commit;
