begin;

-- B-01. Omitted notes leave the previous value. The edit form can clear notes by submitting an empty string.
create or replace function public.update_equipment(
  p_equipment_id  uuid,
  p_identifier    text  default null,
  p_custom_label  text  default null,
  p_condition     text  default null,
  p_notes         text  default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_row  public.dispatch_equipment;
  v_role text;
  v_unit uuid;
  v_brgy uuid;
  v_name text;
begin
  if not public.is_active_user() or public.account_is_removed() or public.account_session_blocked() then
    raise insufficient_privilege using message = 'Sign in with an active account to edit equipment';
  end if;
  if p_condition is not null and p_condition not in ('ready','needs_repair','missing','out_of_service','unknown') then
    raise exception 'Invalid condition';
  end if;

  select * into v_row from public.dispatch_equipment where id = p_equipment_id;
  if v_row.id is null then
    raise exception 'That equipment does not exist';
  end if;

  select role, dispatch_unit_id, barangay_id, coalesce(full_name, '')
    into v_role, v_unit, v_brgy, v_name
    from public.profiles where id = auth.uid();

  -- Permission: LGU, the unit's admin, or the barangay's official.
  if v_role <> 'lgu_ldrrmc' then
    if v_row.owner_unit_id is not null then
      if v_role <> 'dispatch_team' or not public.is_unit_admin() or v_row.owner_unit_id is distinct from v_unit then
        raise exception 'Only the LGU or this unit''s admin may edit this equipment';
      end if;
    else
      if v_role <> 'barangay_official' or v_row.owner_barangay_id is distinct from v_brgy then
        raise exception 'Only the LGU or this barangay''s official may edit this equipment';
      end if;
    end if;
  end if;

  update public.dispatch_equipment
     set identifier   = coalesce(nullif(left(coalesce(trim(p_identifier),   ''), 200),   ''), identifier),
         custom_label = coalesce(nullif(left(coalesce(trim(p_custom_label), ''), 200),   ''), custom_label),
         condition    = coalesce(p_condition, condition),
         notes        = coalesce(left(trim(p_notes), 1000), notes),
         updated_at   = now()
   where id = p_equipment_id;

  perform public.write_audit('equipment.updated', 'dispatch_equipment', p_equipment_id,
    jsonb_build_object(
      'identifier',   p_identifier,
      'custom_label', p_custom_label,
      'condition',    p_condition,
      'notes',        left(trim(p_notes), 500),
      'by', v_name));

  return jsonb_build_object('id', p_equipment_id, 'at', now());
end;
$$;

revoke all on function public.update_equipment(uuid, text, text, text, text) from public, anon;
grant execute on function public.update_equipment(uuid, text, text, text, text) to authenticated;

-- B-05. The review screen belongs to active LGU accounts. Use the caller's reports policies.
create or replace view public.others_hazard_review with (security_invoker = true) as
  select hazard_other_text as description,
         count(*)          as occurrences,
         max(created_at)   as latest_at
    from public.reports
   where lower(trim(hazard_type)) = 'others'
     and (select public.is_lgu())
     and (select public.is_active_user())
     and not (select public.account_is_removed())
     and not (select public.account_session_blocked())
     and hazard_other_text is not null
     and length(trim(hazard_other_text)) > 0
   group by lower(trim(hazard_other_text)), hazard_other_text
   order by occurrences desc, latest_at desc;

revoke all on public.others_hazard_review from public, anon;
grant select on public.others_hazard_review to authenticated;

-- B-06. Apply account restrictions to newer RLS tables as well as older ones.
do $$
declare
  target record;
  guard record;
begin
  for target in select tablename from pg_tables where schemaname = 'public' and rowsecurity loop
    for guard in select * from (values
      ('reject_removed_account', 'account_is_removed'),
      ('reject_revoked_session', 'account_session_blocked')
    ) as guards(policy_name, check_function) loop
      if not exists (
        select 1 from pg_policies where schemaname = 'public' and tablename = target.tablename
         and policyname = guard.policy_name
      ) then
        execute format(
          'create policy %I on public.%I as restrictive for all to authenticated using (not (select public.%I())) with check (not (select public.%I()))',
          guard.policy_name, target.tablename, guard.check_function, guard.check_function
        );
      end if;
    end loop;
  end loop;
end;
$$;

-- B-07. Retire the obsolete signature and restore the current queue if an old file was replayed.
drop function if exists public.lgu_verify_overdue_report(uuid);
drop policy if exists "reports_lgu_escalation_read" on public.reports;

create or replace view public.lgu_escalation_queue
with (security_invoker = true) as
select
  r.id, r.code, r.hazard_type, r.barangay, r.barangay_id,
  r.severity, r.description, r.status,
  r.created_at,
  extract(epoch from (now() - r.created_at)) / 60.0 as minutes_since_submission,
  'overdue'::text as escalation_status
from public.reports r
where r.status = 'reported'
  and r.created_at <= now() - interval '1 hour'
order by r.created_at asc;

comment on view public.lgu_escalation_queue is
  'Reports still unverified 1 hour after submission, computed at read time. security_invoker: each caller sees only the reports RLS lets them read (the LGU sees all).';

revoke all on public.lgu_escalation_queue from public, anon;
grant select on public.lgu_escalation_queue to authenticated;

-- B-08, B-09, B-14. Validate relief inputs and keep a failed void atomic.
create or replace function public.save_relief_item(
  p_id text,p_name text,p_category text,p_unit text,p_stock integer,p_reorder integer,
  p_location text,p_supplier text,p_version timestamptz default null
)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_mdrrmo_duty_staff() then raise insufficient_privilege; end if;
  if coalesce(btrim(p_name),'')='' or p_stock is null or p_stock<0 or p_reorder is null or p_reorder<0 then
    raise exception 'Enter an item name and non-negative stock and reorder quantities';
  end if;
  if p_category is null or p_category not in ('Food','Water','Medical','Equipment','Shelter','Shelter Supplies','Hygiene') then
    raise invalid_parameter_value using message = 'Choose a valid relief stock category';
  end if;
  if p_version is null then
    insert into public.relief_inventory(id,name,category,unit,stock,reorder,location,supplier,created_by)
    values (p_id,btrim(p_name),p_category,coalesce(nullif(btrim(p_unit),''),'units'),
      p_stock,p_reorder,btrim(p_location),btrim(p_supplier),auth.uid())
    on conflict(id) do nothing;
    if not found then return; end if;
  else
    update public.relief_inventory set name=btrim(p_name),category=p_category,
      unit=coalesce(nullif(btrim(p_unit),''),'units'),stock=p_stock,reorder=p_reorder,
      location=btrim(p_location),supplier=btrim(p_supplier),updated_at=clock_timestamp()
    where id=p_id and updated_at=p_version;
    if not found then raise exception 'This item changed. Reopen it and check the current stock before editing.'; end if;
  end if;
  perform public.write_audit('relief.item_saved','relief_inventory',null,jsonb_build_object('item_id',p_id,'stock',p_stock));
end $$;

create or replace function public.record_relief_stock_distribution(
  p_id text,p_item text,p_qty integer,p_barangay text,p_family text
)
returns void language plpgsql security definer set search_path=public as $$
declare item public.relief_inventory; locality public.barangays; staff_name text;
begin
  if public.account_session_blocked() or not (
    public.is_mdrrmo_duty_staff() or public.is_official()
  ) then raise insufficient_privilege; end if;
  begin
    select * into strict locality from public.barangays where name = p_barangay;
  exception
    when no_data_found then
      raise invalid_parameter_value using message = 'Choose a valid barangay';
    when too_many_rows then
      raise invalid_parameter_value using message = 'This barangay name matches more than one record. Ask an administrator to check the directory.';
  end;
  if public.is_official() and public.my_barangay_id() is distinct from locality.id then
    raise insufficient_privilege using message='You can only record distributions for your own barangay';
  end if;
  if p_qty is null or p_qty<=0 then raise exception 'Enter a positive whole quantity'; end if;
  select * into item from public.relief_inventory where id=p_item for update;
  if item.id is null then raise exception 'Stock item not found'; end if;
  select full_name into staff_name from public.profiles where id=auth.uid();
  insert into public.relief_distribution_log(id,item_id,item_name,qty,barangay,family,distributed_by,created_by)
  values(p_id,p_item,item.name,p_qty,locality.name,coalesce(btrim(p_family),''),staff_name,auth.uid())
  on conflict(id) do nothing;
  if not found then return; end if;
  if item.stock<p_qty then raise exception 'Insufficient stock. Available quantity: %',item.stock; end if;
  update public.relief_inventory set stock=stock-p_qty,updated_at=clock_timestamp() where id=p_item;
  perform public.write_audit('relief.distribution_recorded','relief_distribution_log',null,
    jsonb_build_object('record_id',p_id,'item_id',p_item,'quantity',p_qty,'barangay_id',locality.id));
end $$;

create or replace function public.void_relief_stock_distribution(p_id text)
returns void language plpgsql security definer set search_path=public as $$
declare entry public.relief_distribution_log;
begin
  if not public.is_mdrrmo_duty_staff() then raise insufficient_privilege; end if;
  select * into entry from public.relief_distribution_log where id=p_id for update;
  if entry.id is null then raise exception 'Distribution not found'; end if;
  if entry.voided_at is not null then return; end if;
  if entry.item_id is null then raise exception 'The original stock item no longer exists'; end if;
  update public.relief_inventory set stock=stock+entry.qty, updated_at=clock_timestamp()
    where id=entry.item_id and stock::bigint+entry.qty between 0 and 2147483647;
  if not found then raise exception 'Voiding this distribution would put stock outside its supported range'; end if;
  update public.relief_distribution_log set voided_at=now(),voided_by=auth.uid() where id=p_id;
  perform public.write_audit('relief.distribution_voided','relief_distribution_log',null,
    jsonb_build_object('record_id',p_id,'item_id',entry.item_id,'quantity',entry.qty));
end $$;

-- B-10. Use the account disable sentinel from 072 for removals as well.
create or replace function public.remove_staff_account(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(68001);
  if not public.is_super_admin() or public.account_session_blocked() or auth.uid() = p_user_id then
    raise exception 'Another active Super Admin must remove this account';
  end if;
  update public.profiles
     set disabled = true, removed_at = now(), role = 'citizen', is_super_admin = false,
         dispatch_unit_id = null, unit_role = '', barangay_id = null, barangay = '', updated_at = now()
   where id = p_user_id and removed_at is null;
  if not found then
    if exists (select 1 from public.profiles where id = p_user_id and removed_at is not null) then
      return;
    end if;
    raise exception 'Account not found';
  end if;
  update auth.users set banned_until = '9999-12-30 00:00:00+00', updated_at = now() where id = p_user_id;
  delete from auth.sessions where user_id = p_user_id;
  perform public.write_audit('user.removed', 'profiles', p_user_id, '{}'::jsonb);
end $$;

revoke all on function public.remove_staff_account(uuid) from public, anon;
grant execute on function public.remove_staff_account(uuid) to authenticated;
update auth.users u
   set banned_until = '9999-12-30 00:00:00+00', updated_at = now()
  from public.profiles p
 where u.id = p.id and p.removed_at is not null
   and u.banned_until = '9999-12-31 00:00:00+00';

-- B-13. Only active accounts can submit client diagnostics.
create or replace function public.log_client_error(p_message text, p_context jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active_user() or public.account_session_blocked() or public.account_is_removed() then
    raise insufficient_privilege using message = 'Sign in with an active account to send diagnostics';
  end if;
  insert into public.client_errors (user_id, message, context, user_agent)
  values (auth.uid(), left(coalesce(p_message, 'unknown'), 500), coalesce(p_context, '{}'::jsonb), '');
end;
$$;
revoke all on function public.log_client_error(text, jsonb) from public, anon;
grant execute on function public.log_client_error(text, jsonb) to authenticated;

-- Staff may notify the allowed audience once per road-work post.
create or replace function public.fanout_road_work(p_post_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_post public.road_work_posts;
  v_barangay_id uuid;
  v_inserted int;
begin
  if not public.is_active_user() or public.account_session_blocked() or public.account_is_removed()
     or not (public.is_lgu() or public.is_official()) then
    raise insufficient_privilege using message = 'Only active LGU or barangay staff may notify residents of road work';
  end if;
  select * into v_post from public.road_work_posts where id = p_post_id for update;
  if not found then return 0; end if;

  v_barangay_id := v_post.barangay_id;
  if v_barangay_id is null and not v_post.citywide then
    select id into v_barangay_id from public.barangays where name = v_post.barangay;
  end if;
  if public.is_official() and (v_post.citywide or v_barangay_id is null or v_barangay_id is distinct from public.my_barangay_id()) then
    raise insufficient_privilege using message = 'You can only notify your own barangay';
  end if;

  insert into public.notifications (user_id, title, body, tone, icon, type, road_work_id)
  select p.id, v_post.title, left(coalesce(v_post.description, ''), 240), 'warning', 'road', 'road_work', v_post.id
    from public.profiles p
   where not p.disabled and p.removed_at is null and (v_post.citywide or p.barangay_id = v_barangay_id)
     and not exists (select 1 from public.notifications n where n.user_id = p.id and n.road_work_id = v_post.id);
  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;
revoke all on function public.fanout_road_work(uuid) from public, anon;
grant execute on function public.fanout_road_work(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
