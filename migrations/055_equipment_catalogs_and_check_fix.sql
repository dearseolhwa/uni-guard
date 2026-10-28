-- ============================================================================
--  UniGuard · 055 · Equipment catalogs for PNP / Rescue / Hospital,
--                   readiness-check fix, catalog RPC returns category
--
--  1) CATALOGS
--     After 054 only BFP and Barangay had catalog rows in production; PNP,
--     Rescue and Hospital unit admins still saw only "Other (custom)".
--     These are the rows from seed/003_dispatch_units.sql (the original
--     design, never run), now with a category. Re-runs only update
--     category; existing checklists are kept.
--
--  2) BARANGAY ROWS BACK TO 'General'
--     The first draft of 054 grouped Barangay's Megaphone under
--     Communications, which made the barangay form show a Category field
--     defaulting to a one-item list. 054 now skips Barangay; this resets any
--     database where the first draft already ran.
--
--  3) record_equipment_check SAVED THE CONDITION AS THE LEVEL
--     040 inserted p_condition into equipment_checks.level, so the "Level
--     (fuel / pressure / etc.)" a responder typed was thrown away. Same
--     signature, same permission checks; level now stores p_level, and a
--     null condition gets the friendly error instead of a NOT NULL failure.
--     The audit entry also records the checklist items.
--
--  4) list_equipment_catalog_by_owner returns category too (054 column).
--
--  Safe to re-run. Run after 054.
-- ============================================================================

-- 1) ------------------------------------------------------------- catalogs
do $$
begin
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public' and tablename = 'equipment_catalog'
       and indexname = 'equipment_catalog_type_label_key'
  ) then
    create unique index equipment_catalog_type_label_key
      on public.equipment_catalog (unit_type, label);
  end if;
end $$;

insert into public.equipment_catalog (unit_type, label, category, checklist)
select v.unit_type, v.label, v.category, v.checklist::jsonb
  from (values
    -- PNP
    ('PNP', 'Patrol Car',          'Vehicles',                   '["Fuel level","Radio battery","Lights and siren","First-aid kit"]'::text),
    ('PNP', 'Motorcycle',          'Vehicles',                   '["Fuel level","Tyres","Lights","Radio battery"]'::text),
    ('PNP', 'Radios',              'Communications',             '["Battery","Channel scan","Antenna","Speaker"]'::text),
    ('PNP', 'Barriers and Cones',  'Traffic and crowd control',  '["Count","Reflective condition","Stands","Bag"]'::text),
    ('PNP', 'Crowd-Control Kit',   'Traffic and crowd control',  '["Vests","Megaphone","Baton","Whistle"]'::text),
    -- Rescue Unit
    ('Rescue', 'Rescue Boat',         'Vehicles',          '["Engine start","Fuel level","Life vests","Paddles","Hull"]'::text),
    ('Rescue', 'Extrication Tools',   'Rescue equipment',  '["Hydraulic pump","Cutter","Spreader","Ram","Hoses"]'::text),
    ('Rescue', 'Rope and Rappel Set', 'Rescue equipment',  '["Rope integrity","Carabiners","Harnesses","Descenders","Anchors"]'::text),
    ('Rescue', 'Stretcher',           'Rescue equipment',  '["Straps","Frame","Wheels","Cleanliness"]'::text),
    ('Rescue', 'First-Aid Kit',       'Rescue equipment',  '["Bandages","Antiseptics","Medicines list","Triage tags"]'::text),
    -- Hospital
    ('Hospital', 'Ambulance',     'Vehicles',  '["Fuel level","Tyres","Stretcher","Oxygen tank","Defibrillator"]'::text),
    ('Hospital', 'ER Beds',       'Medical',   '["Available count","Bedding","Monitors","Oxygen outlets"]'::text),
    ('Hospital', 'ICU Beds',      'Medical',   '["Available count","Ventilators","Monitors","Power"]'::text),
    ('Hospital', 'Oxygen',        'Medical',   '["Cylinder count","Pressure","Backup supply","Flow meters"]'::text),
    ('Hospital', 'Blood Supply',  'Medical',   '["A+","A-","B+","B-","AB+","AB-","O+","O-","Storage temp"]'::text)
  ) as v(unit_type, label, category, checklist)
on conflict (unit_type, label) do update set category = excluded.category;

-- 2) ---------------------------------------------- Barangay back to General
update public.equipment_catalog set category = 'General'
 where unit_type = 'Barangay' and category is distinct from 'General';

-- 3) ------------------------------------------------ record_equipment_check
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
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  if p_condition is null or p_condition not in ('ready','needs_repair','missing','out_of_service','unknown') then
    raise exception 'Invalid condition';
  end if;

  select * into v_row from public.dispatch_equipment where id = p_equipment_id;
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

revoke all on function public.record_equipment_check(uuid, text, text, text, text, jsonb) from public;
grant execute on function public.record_equipment_check(uuid, text, text, text, text, jsonb) to authenticated;

-- 4) ------------------------------------- list_equipment_catalog_by_owner
create or replace function public.list_equipment_catalog_by_owner(
  p_owner_unit_id     uuid default null,
  p_owner_barangay_id uuid default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_unit_row public.dispatch_units;
  v_type     text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  if (p_owner_unit_id is null and p_owner_barangay_id is null)
     or (p_owner_unit_id is not null and p_owner_barangay_id is not null) then
    raise exception 'Pick exactly one owner: a unit OR a barangay';
  end if;

  if p_owner_unit_id is not null then
    select * into v_unit_row from public.dispatch_units where id = p_owner_unit_id;
    if v_unit_row.id is null then
      raise exception 'That unit does not exist';
    end if;
    v_type := v_unit_row.unit_type;
  else
    v_type := 'Barangay';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'unit_type', c.unit_type, 'label', c.label,
      'category', c.category, 'checklist', c.checklist
    ) order by c.category, c.label)
    from public.equipment_catalog c
    where c.unit_type = v_type
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_equipment_catalog_by_owner(uuid, uuid) from public;
grant execute on function public.list_equipment_catalog_by_owner(uuid, uuid) to authenticated;
