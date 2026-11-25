begin;

-- An escort can be seen by active PNP staff regardless of the distribution's barangay.
create or replace function public.my_active_pnp_unit()
returns uuid language sql stable security definer set search_path = public as $$
  select u.id from public.profiles p join public.dispatch_units u on u.id = p.dispatch_unit_id
  where p.id = auth.uid() and p.role = 'dispatch_team' and not p.disabled and p.removed_at is null
    and u.active and u.unit_type = 'PNP' and not public.account_session_blocked();
$$;
revoke all on function public.my_active_pnp_unit() from public, anon;
grant execute on function public.my_active_pnp_unit() to authenticated;

drop policy if exists relief_distributions_pnp_escort_read on public.relief_distributions;
create policy relief_distributions_pnp_escort_read on public.relief_distributions
for select to authenticated using (active and (select public.my_active_pnp_unit()) is not null
  and (escort_status = 'requested' or (escort_status = 'confirmed' and escort_unit_id = (select public.my_active_pnp_unit()))));

create or replace function public.request_relief_escort(p_distribution_id uuid, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row public.relief_distributions;
  v_role text;
begin
  if not public.is_active_user() or public.account_is_removed() or public.account_session_blocked() then
    raise insufficient_privilege using message = 'Sign in with an active staff account to request an escort.';
  end if;
  select role into v_role from public.profiles where id = auth.uid();
  if not public.is_mdrrmo_duty_staff() and v_role is distinct from 'barangay_official' then
    raise insufficient_privilege using message = 'Only MDRRMO duty staff or barangay officials may request an escort.';
  end if;

  select * into v_row from public.relief_distributions where id = p_distribution_id for update;
  if v_row.id is null or (v_role = 'barangay_official'
       and (v_row.barangay_id is null or v_row.barangay_id is distinct from public.my_barangay_id())) then
    raise insufficient_privilege using message = 'This distribution is unavailable to your account.';
  end if;
  if not v_row.active then raise exception 'Only active distributions can have an escort.'; end if;
  if v_row.escort_status <> 'none' then
    return jsonb_build_object('id', p_distribution_id, 'escort_status', v_row.escort_status);
  end if;

  update public.relief_distributions set escort_status = 'requested', escort_note = left(btrim(coalesce(p_note,'')), 1000)
  where id = p_distribution_id;

  insert into public.notifications (user_id,title,body,tone,icon,type)
  select p.id, 'Relief escort requested',
         left(concat_ws(' · ', v_row.title, nullif(v_row.barangay,'')), 240),
         'warning', 'shield', 'relief_escort'
  from public.profiles p join public.dispatch_units u on u.id = p.dispatch_unit_id
  where p.role = 'dispatch_team' and not p.disabled and p.removed_at is null and u.active and u.unit_type = 'PNP';

  perform public.write_audit('relief.escort_requested','relief_distributions',p_distribution_id,
    jsonb_build_object('note',left(coalesce(p_note,''),500)));
  return jsonb_build_object('id',p_distribution_id,'escort_status','requested');
end;
$$;

create or replace function public.confirm_relief_escort(p_distribution_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row public.relief_distributions;
  v_unit uuid := public.my_active_pnp_unit();
begin
  if v_unit is null then
    raise insufficient_privilege using message = 'Only an active PNP unit member may confirm an escort.';
  end if;
  select * into v_row from public.relief_distributions where id = p_distribution_id for update;
  if v_row.id is null or not v_row.active then raise exception 'This distribution is unavailable.'; end if;
  if v_row.escort_status = 'confirmed' and v_row.escort_unit_id = v_unit then
    return jsonb_build_object('id',p_distribution_id,'escort_status','confirmed','unit_id',v_unit);
  end if;
  if v_row.escort_status <> 'requested' then raise exception 'This distribution has no pending escort request.'; end if;

  update public.relief_distributions set escort_status = 'confirmed', escort_unit_id = v_unit
  where id = p_distribution_id;
  insert into public.notifications (user_id,title,body,tone,icon,type)
  select p.id,'Relief escort confirmed',left(v_row.title,240),'prepared','shield','relief_escort'
  from public.profiles p where not p.disabled and p.removed_at is null and (
    (p.role = 'lgu_ldrrmc' and not p.is_super_admin)
    or (p.role = 'barangay_official' and p.barangay_id = v_row.barangay_id)
  );
  perform public.write_audit('relief.escort_confirmed','relief_distributions',p_distribution_id,jsonb_build_object('unit_id',v_unit));
  return jsonb_build_object('id',p_distribution_id,'escort_status','confirmed','unit_id',v_unit);
end;
$$;

-- Schedule edits keep their existing permissions. Escort state is controlled by the two RPCs.
create or replace function public.guard_relief_escort_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' and (
    (tg_op = 'INSERT' and (new.escort_status <> 'none' or new.escort_unit_id is not null or new.escort_note <> ''))
    or (tg_op = 'UPDATE' and row(new.escort_status,new.escort_note,new.escort_unit_id)
          is distinct from row(old.escort_status,old.escort_note,old.escort_unit_id))
  ) then
    raise insufficient_privilege using message = 'Use the escort request or confirmation action to change escort details.';
  end if;
  return new;
end;
$$;
drop trigger if exists relief_distributions_guard_escort on public.relief_distributions;
create trigger relief_distributions_guard_escort before insert or update on public.relief_distributions
for each row execute function public.guard_relief_escort_fields();

-- Restore the recorded booking state before enforcing the invariant on new writes.
update public.dispatch_equipment e set status = 'deployed'
where e.status <> 'deployed' and exists (
  select 1 from public.dispatch_equipment_use b where b.equipment_id = e.id and b.released_at is null
);

create or replace function public.guard_booked_equipment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_booked boolean;
begin
  select exists (select 1 from public.dispatch_equipment_use where equipment_id = old.id and released_at is null)
  into v_booked;
  if tg_op = 'DELETE' then
    if v_booked then
      raise exception 'This equipment is deployed. Release it before removing it.';
    end if;
    if exists (select 1 from public.equipment_checks where equipment_id = old.id) then
      raise exception 'This equipment has a service history. Retire it to preserve the readiness checks.';
    end if;
    return old;
  end if;
  if v_booked and (new.status <> 'deployed' or new.condition is distinct from old.condition) then
    raise exception 'This equipment is deployed. Complete or decline its dispatch before changing its readiness or status.';
  end if;
  if new.status = 'deployed' and old.status <> 'deployed' and not v_booked then
    raise exception 'Dispatch assigns the Deployed status.';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_booked_equipment() from public, anon, authenticated;
drop trigger if exists dispatch_equipment_guard_booking on public.dispatch_equipment;
create trigger dispatch_equipment_guard_booking
before update of status, condition or delete on public.dispatch_equipment
for each row execute function public.guard_booked_equipment();

drop policy if exists equipment_checks_read on public.equipment_checks;
create policy equipment_checks_read on public.equipment_checks for select to authenticated using (
  (select public.is_active_user()) and (
    (select public.is_lgu()) or exists (
      select 1 from public.dispatch_equipment e where e.id = equipment_id and (
        ((select public.is_official()) and e.owner_barangay_id = (select public.my_barangay_id()))
        or ((select public.is_dispatch()) and e.owner_unit_id = (select public.my_unit_id()))
      )
    )
  )
);

-- Recover historical scope from the audit ledger first. Match the name only
-- when a single current barangay has that name.
alter table public.relief_distribution_log add column if not exists barangay_id uuid references public.barangays(id);
with recovered as (
  select a.meta->>'record_id' as record_id, min(b.id::text)::uuid as barangay_id
  from public.audit_log a join public.barangays b on b.id::text = a.meta->>'barangay_id'
  where a.action = 'relief.distribution_recorded'
  group by a.meta->>'record_id' having count(distinct b.id) = 1
)
update public.relief_distribution_log d set barangay_id = r.barangay_id
from recovered r where d.id = r.record_id and d.barangay_id is null;

with unique_names as (
  select name, min(id::text)::uuid as id from public.barangays group by name having count(*) = 1
)
update public.relief_distribution_log d set barangay_id = b.id
from unique_names b where d.barangay_id is null and d.barangay = b.name;

create index if not exists relief_distribution_barangay_id_idx on public.relief_distribution_log(barangay_id, distributed_at desc);
drop policy if exists "relief_dist_log read" on public.relief_distribution_log;
create policy "relief_dist_log read" on public.relief_distribution_log for select to authenticated using (
  (select public.is_active_user()) and ((select public.is_lgu())
    or ((select public.is_official()) and barangay_id = (select public.my_barangay_id())))
);

create or replace function public.read_relief_stock()
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'inventory',coalesce((select jsonb_agg(to_jsonb(i) order by i.name,i.id) from public.relief_inventory i),'[]'),
    'records',coalesce((select jsonb_agg(to_jsonb(d) || jsonb_build_object('barangay',coalesce(b.name,d.barangay))
                                       order by d.distributed_at desc,d.id)
      from public.relief_distribution_log d left join public.barangays b on b.id = d.barangay_id
      where d.voided_at is null),'[]')
  );
$$;

-- One persistent notification per item per low-stock period. A restock above the
-- threshold allows the next drop to notify again. No open browser is required.
alter table public.relief_inventory add column if not exists low_stock_notified boolean not null default false;
create or replace function public.notify_relief_low_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.stock > new.reorder then
    new.low_stock_notified := false;
  elsif tg_op = 'INSERT' or not old.low_stock_notified or (old.stock > 0 and new.stock = 0) then
    insert into public.notifications (user_id,title,body,tone,icon,type)
    select p.id, case when new.stock = 0 then 'Relief item out of stock' else 'Relief stock needs attention' end,
           left(format('%s · %s %s remaining · reorder point %s',new.name,new.stock,new.unit,new.reorder),240),
           'warning','alert','relief_low_stock'
    from public.profiles p
    where p.role = 'lgu_ldrrmc' and not p.is_super_admin and not p.disabled and p.removed_at is null;
    new.low_stock_notified := true;
  else
    new.low_stock_notified := true;
  end if;
  return new;
end;
$$;
revoke all on function public.notify_relief_low_stock() from public, anon, authenticated;
drop trigger if exists relief_inventory_low_stock_alert on public.relief_inventory;
create trigger relief_inventory_low_stock_alert before insert or update of stock, reorder on public.relief_inventory
for each row execute function public.notify_relief_low_stock();

update public.relief_inventory set stock = stock where stock <= reorder and not low_stock_notified;

create or replace function public.set_equipment_status(
  p_equipment_id uuid,
  p_status       text,
  p_condition    text default null,
  p_notes        text default ''
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.dispatch_equipment;
  v_role text;
  v_unit uuid;
  v_brgy uuid;
begin
  if not public.is_active_user() or public.account_is_removed() or public.account_session_blocked() then raise exception 'You must be signed in'; end if;
  if p_status is null or p_status not in ('available','maintenance','unavailable') then
    raise exception 'Choose Available, Maintenance or Unavailable. Dispatch assigns the Deployed status.';
  end if;
  if p_condition is not null and p_condition not in ('ready','needs_repair','missing','out_of_service','unknown') then
    raise exception 'Invalid condition';
  end if;

  select * into v_row from public.dispatch_equipment where id = p_equipment_id for update;
  if v_row.id is null then raise exception 'That equipment does not exist'; end if;

  select role, barangay_id, dispatch_unit_id into v_role, v_brgy, v_unit
    from public.profiles where id = auth.uid();

  if v_role <> 'lgu_ldrrmc' then
    if v_row.owner_unit_id is not null then
      if v_role <> 'dispatch_team' or v_row.owner_unit_id is distinct from v_unit then
        raise exception 'Not your equipment';
      end if;
    else
      if v_role <> 'barangay_official' or v_row.owner_barangay_id is distinct from v_brgy then
        raise exception 'Not your equipment';
      end if;
    end if;
  end if;

  if v_row.status = 'deployed' or exists (
    select 1 from public.dispatch_equipment_use where equipment_id = p_equipment_id and released_at is null
  ) then
    raise exception 'This equipment is deployed. Complete or decline its dispatch before changing its readiness or status.';
  end if;

  update public.dispatch_equipment
     set status = p_status,
         condition = coalesce(p_condition, condition),
         notes = left(coalesce(p_notes, ''), 500)
   where id = p_equipment_id;

  perform public.write_audit('equipment.status_set', 'dispatch_equipment', p_equipment_id,
    jsonb_build_object('status', p_status, 'condition', p_condition));

  return jsonb_build_object('id', p_equipment_id, 'status', p_status);
end;
$$;

create or replace function public.record_equipment_check(
  p_equipment_id uuid,
  p_condition    text,
  p_level        text default '',
  p_notes        text default '',
  p_photo        text default null,
  p_items        jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.dispatch_equipment;
  v_role text;
  v_unit uuid;
  v_brgy uuid;
  v_id uuid;
begin
  if not public.is_active_user() or public.account_is_removed() or public.account_session_blocked() then
    raise exception 'You must be signed in';
  end if;
  if p_condition is null or p_condition not in ('ready','needs_repair','missing','out_of_service','unknown') then
    raise exception 'Invalid condition';
  end if;

  select * into v_row from public.dispatch_equipment where id = p_equipment_id for update;
  if v_row.id is null then
    raise exception 'That equipment does not exist';
  end if;

  select role, barangay_id, dispatch_unit_id
    into v_role, v_brgy, v_unit
    from public.profiles where id = auth.uid();

  -- Either a unit member checking their own unit's equipment, or the
  -- barangay official checking their own barangay's equipment, or the LGU.
  if v_role <> 'lgu_ldrrmc' then
    if v_row.owner_unit_id is not null then
      if v_role <> 'dispatch_team' or v_row.owner_unit_id is distinct from v_unit then
        raise exception 'You can only check your own unit''s equipment';
      end if;
    else
      if v_role <> 'barangay_official' or v_row.owner_barangay_id is distinct from v_brgy then
        raise exception 'You can only check your own barangay''s equipment';
      end if;
    end if;
  end if;

  if v_row.status = 'deployed' or exists (
    select 1 from public.dispatch_equipment_use where equipment_id = p_equipment_id and released_at is null
  ) then
    raise exception 'This equipment is deployed. Complete or decline its dispatch before changing its readiness or status.';
  end if;

  insert into public.equipment_checks (equipment_id, checked_by, condition, level, notes, photo, items)
  values (p_equipment_id, auth.uid(), p_condition, left(coalesce(p_level, ''), 200), left(coalesce(p_notes, ''), 500), p_photo, coalesce(p_items, '[]'::jsonb))
  returning id into v_id;

  -- stamp the equipment row with the latest condition + last_checked_at so
  -- the dispatch picker can filter against it.
  update public.dispatch_equipment
     set condition = p_condition,
         last_checked_at = now(),
         status = case when p_condition in ('needs_repair','missing','out_of_service') then 'maintenance'
                       when status = 'available' then 'available' else status end
   where id = p_equipment_id;

  perform public.write_audit('equipment.checked', 'dispatch_equipment', p_equipment_id,
    jsonb_build_object('condition', p_condition, 'level', p_level,
      'items', coalesce(p_items, '[]'::jsonb)));

  return jsonb_build_object('id', v_id, 'condition', p_condition, 'checked_at', now());
end;
$$;

create or replace function public.record_relief_stock_distribution(
  p_id text,p_item text,p_qty integer,p_barangay text,p_family text
)
returns void language plpgsql security definer set search_path=public as $$
declare item public.relief_inventory; locality public.barangays; staff_name text;
begin
  if not public.is_active_user() or public.account_is_removed() or public.account_session_blocked() or not (
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
  insert into public.relief_distribution_log(id,item_id,item_name,qty,barangay,barangay_id,family,distributed_by,created_by)
  values(p_id,p_item,item.name,p_qty,locality.name,locality.id,coalesce(btrim(p_family),''),staff_name,auth.uid())
  on conflict(id) do nothing;
  if not found then return; end if;
  if item.stock<p_qty then raise exception 'Insufficient stock. Available quantity: %',item.stock; end if;
  update public.relief_inventory set stock=stock-p_qty,updated_at=clock_timestamp() where id=p_item;
  perform public.write_audit('relief.distribution_recorded','relief_distribution_log',null,
    jsonb_build_object('record_id',p_id,'item_id',p_item,'quantity',p_qty,'barangay_id',locality.id));
end $$;

-- Restore publication membership for projects that skipped optional setup.
do $$
declare v_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables) then
    return;
  end if;
  foreach v_table in array array['relief_distributions','dispatch_equipment','equipment_checks','dispatch_equipment_use'] loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime'
          and schemaname='public' and tablename=v_table) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end;
$$;

commit;
