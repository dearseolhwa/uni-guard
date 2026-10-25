-- ============================================================================
--  UniGuard · 050 · Equipment management (Add / Edit / Remove / Retire)
--
--  Per-team equipment tracking already exists (catalog, readiness checks,
--  status, deploy on dispatch, auto-release on Done). What was missing was
--  a way to ADD, EDIT and REMOVE equipment from the app — equipment only
--  entered the database through seed/003_dispatch_units.sql, and the empty
--  state on the Equipment & Readiness screen said "Your unit admin can
--  add equipment here" but no such control existed.
--
--  This migration adds three SECURITY DEFINER RPCs that the JS dispatch
--  module + LGU console call:
--    add_equipment(...)      — insert a row owned by a unit OR a barangay
--    update_equipment(...)   — edit identifier / custom_label / condition / notes
--    remove_equipment(...)   — delete OR retire, depending on dispatch history
--
--  Permission model (matches the existing dispatch_equipment_write RLS in
--  migration 038, lines 192-204):
--    · LGU  — any unit's or any barangay's equipment
--    · unit_admin (dispatch_team + is_unit_admin()) — own unit's equipment
--    · barangay_official — own barangay's equipment
--  Regular unit members can NOT call any of these RPCs (the RPCs reject
--  them); they can still run readiness checks via record_equipment_check
--  from migration 040.
--
--  Remove logic (per the prompt's rules):
--    · status = 'deployed'  → block both delete and retire (item is in use)
--    · has any dispatch_equipment_use row → can only RETIRE (status='unavailable'),
--      NOT delete, because dispatch_equipment_use + equipment_checks cascade
--      on delete and would erase dispatch history
--    · never used in a dispatch → can DELETE (cascades to equipment_checks
--      only) OR retire
--
--  Additive + idempotent. Begin/commit so it applies atomically. Never
--  edits a previous migration. Uses DO $$ guards for every constraint
--  add (the form `ALTER TABLE … ADD CONSTRAINT IF NOT EXISTS` is invalid
--  in PostgreSQL, see migration 038's known issue).
-- ============================================================================

begin;

-- ============================================================================
--  add_equipment
-- ----------------------------------------------------------------------------
--  Inserts a new dispatch_equipment row. Exactly one of (p_owner_unit_id,
--  p_owner_barangay_id) must be set; the dispatch_equipment_owner_check
--  constraint enforces that.
--
--  The owner_unit_id / owner_barangay_id is taken from the caller's profile
--  when p_owner_unit_id is null and p_owner_barangay_id is null (the
--  convenience path), but the caller can also pass an explicit owner for
--  the LGU's case (LGU can manage any unit's equipment).
-- ============================================================================
create or replace function public.add_equipment(
  p_owner_unit_id     uuid default null,
  p_owner_barangay_id uuid default null,
  p_catalog_id        uuid default null,
  p_custom_label      text  default '',
  p_identifier        text  default '',
  p_condition         text  default 'unknown',
  p_notes             text  default ''
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_role        text;
  v_unit        uuid;
  v_brgy        uuid;
  v_name        text;
  v_owner_unit  uuid := p_owner_unit_id;
  v_owner_brgy  uuid := p_owner_barangay_id;
  v_catalog_row public.equipment_catalog;
  v_unit_row    public.dispatch_units;
  v_id          uuid;
  v_label       text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  if p_condition is null or p_condition not in ('ready','needs_repair','missing','out_of_service','unknown') then
    raise exception 'Invalid condition (use ready, needs_repair, missing, out_of_service or unknown)';
  end if;

  -- Exactly one owner must be set. The dispatch_equipment_owner_check
  -- constraint enforces this on insert; we pre-check here so the user
  -- gets a friendly message instead of a constraint violation.
  if (v_owner_unit is null and v_owner_brgy is null)
     or (v_owner_unit is not null and v_owner_brgy is not null) then
    raise exception 'Pick exactly one owner: a unit OR a barangay';
  end if;

  select role, dispatch_unit_id, barangay_id, coalesce(full_name, '')
    into v_role, v_unit, v_brgy, v_name
    from public.profiles where id = auth.uid();

  -- Permission check (mirrors dispatch_equipment_write, migration 038 L192):
  --   LGU           → any owner
  --   unit_admin    → own unit only (v_owner_unit must equal v_unit)
  --   barangay_off  → own barangay only (v_owner_brgy must equal v_brgy)
  if v_role not in ('lgu_ldrrmc','dispatch_team','barangay_official') then
    raise exception 'Only the LGU, a unit admin, or a barangay official can add equipment';
  end if;
  if v_role = 'dispatch_team' then
    if not public.is_unit_admin() then
      raise exception 'Only a unit admin can add equipment';
    end if;
    if v_owner_unit is distinct from v_unit then
      raise exception 'You can only add equipment to your own unit';
    end if;
    -- the unit_type must match the catalog's unit_type when a catalog_id is
    -- provided. We check that below, after looking up the catalog row.
  elsif v_role = 'barangay_official' then
    if v_owner_brgy is distinct from v_brgy then
      raise exception 'You can only add equipment to your own barangay';
    end if;
  end if;
  -- LGU: no extra check — can manage any unit or barangay

  -- If p_catalog_id is provided, validate it exists and matches the
  -- owner's type. If p_catalog_id is null, the user picked "Other (custom)"
  -- and p_custom_label is required.
  if p_catalog_id is not null then
    select * into v_catalog_row from public.equipment_catalog where id = p_catalog_id;
    if v_catalog_row.id is null then
      raise exception 'That catalog entry does not exist';
    end if;
    -- Type match: a unit-owned equipment must use a catalog row whose
    -- unit_type matches the unit's unit_type; a barangay-owned equipment
    -- must use a 'Barangay' catalog row.
    if v_owner_unit is not null then
      select * into v_unit_row from public.dispatch_units where id = v_owner_unit;
      if v_unit_row.unit_type is distinct from v_catalog_row.unit_type then
        raise exception 'The catalog type (%) does not match the unit type (%)',
          v_catalog_row.unit_type, v_unit_row.unit_type;
      end if;
    else
      if v_catalog_row.unit_type <> 'Barangay' then
        raise exception 'A barangay-owned equipment row must use a Barangay catalog entry';
      end if;
    end if;
  else
    if coalesce(trim(p_custom_label), '') = '' then
      raise exception 'Pick a type from the catalog, or write a custom label';
    end if;
  end if;

  -- Auto-fill the label from the catalog when the user did not pass one
  -- (so the equipment list shows a readable label even for catalog rows).
  v_label := coalesce(trim(p_custom_label), '');
  if p_catalog_id is not null and v_label = '' then
    v_label := v_catalog_row.label;
  end if;

  insert into public.dispatch_equipment
    (owner_unit_id, owner_barangay_id, catalog_id, custom_label, identifier,
     status, condition, notes, last_checked_at)
  values
    (v_owner_unit, v_owner_brgy, p_catalog_id, v_label,
     left(coalesce(trim(p_identifier), ''), 200),
     'available', p_condition,
     left(coalesce(trim(p_notes), ''), 1000), null)
  returning id into v_id;

  perform public.write_audit('equipment.added', 'dispatch_equipment', v_id,
    jsonb_build_object(
      'owner_unit_id', v_owner_unit, 'owner_barangay_id', v_owner_brgy,
      'catalog_id', p_catalog_id, 'custom_label', v_label,
      'identifier', left(coalesce(trim(p_identifier), ''), 200),
      'condition', p_condition, 'by', v_name));

  return jsonb_build_object('id', v_id, 'status', 'available');
end;
$$;

revoke all on function public.add_equipment(uuid, uuid, uuid, text, text, text, text) from public;
grant execute on function public.add_equipment(uuid, uuid, uuid, text, text, text, text) to authenticated;

-- ============================================================================
--  update_equipment
-- ----------------------------------------------------------------------------
--  Edit identifier, custom_label, condition and notes. The owner, the
--  catalog_id and the status are NOT editable here — change status through
--  set_equipment_status (migration 040), change owner by retiring + adding.
-- ============================================================================
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
  if auth.uid() is null then
    raise exception 'You must be signed in';
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
         notes        = coalesce(left(coalesce(trim(p_notes), ''), 1000), notes),
         updated_at   = now()
   where id = p_equipment_id;

  perform public.write_audit('equipment.updated', 'dispatch_equipment', p_equipment_id,
    jsonb_build_object(
      'identifier',   p_identifier,
      'custom_label', p_custom_label,
      'condition',    p_condition,
      'notes',        left(coalesce(p_notes, ''), 500),
      'by', v_name));

  return jsonb_build_object('id', p_equipment_id, 'at', now());
end;
$$;

revoke all on function public.update_equipment(uuid, text, text, text, text) from public;
grant execute on function public.update_equipment(uuid, text, text, text, text) to authenticated;

-- ============================================================================
--  remove_equipment
-- ----------------------------------------------------------------------------
--  p_retire = false (default): try to DELETE the row.
--    · status = 'deployed'   → reject (release it first)
--    · any dispatch_equipment_use row exists → reject (would erase dispatch
--      history; the cascade on dispatch_equipment_use + equipment_checks
--      would delete rows that an audit or after-action report references)
--    · otherwise → delete (cascades to equipment_checks only)
--
--  p_retire = true: set status = 'unavailable' (the item stays in the
--  list, marked retired). Block while status = 'deployed' (release first).
-- ============================================================================
create or replace function public.remove_equipment(
  p_equipment_id uuid,
  p_retire       boolean default false
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_row       public.dispatch_equipment;
  v_role      text;
  v_unit      uuid;
  v_brgy      uuid;
  v_name      text;
  v_use_count int;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
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
        raise exception 'Only the LGU or this unit''s admin may remove this equipment';
      end if;
    else
      if v_role <> 'barangay_official' or v_row.owner_barangay_id is distinct from v_brgy then
        raise exception 'Only the LGU or this barangay''s official may remove this equipment';
      end if;
    end if;
  end if;

  -- Block while deployed.
  if v_row.status = 'deployed' then
    raise exception 'This equipment is currently deployed. Release it from its dispatch before removing or retiring.';
  end if;

  -- Count dispatch_equipment_use history (released or not — both count as
  -- "ever used in a dispatch").
  select count(*) into v_use_count
    from public.dispatch_equipment_use
   where equipment_id = p_equipment_id;

  if p_retire then
    -- Retire: set status to unavailable. Allowed even with dispatch history.
    update public.dispatch_equipment
       set status = 'unavailable', updated_at = now()
     where id = p_equipment_id;
    perform public.write_audit('equipment.retired', 'dispatch_equipment', p_equipment_id,
      jsonb_build_object('had_dispatch_history', v_use_count > 0, 'by', v_name));
    return jsonb_build_object('id', p_equipment_id, 'status', 'unavailable', 'retired', true);
  else
    -- True delete: only allowed when no dispatch history.
    if v_use_count > 0 then
      raise exception 'This equipment has been used in % dispatch(es). Retire it instead (status = unavailable) so the dispatch history is preserved.',
        v_use_count;
    end if;
    -- Delete cascades to equipment_checks (ON DELETE CASCADE in 038 L209).
    -- dispatch_equipment_use rows would also cascade (ON DELETE CASCADE),
    -- but we already rejected the case where any exist.
    delete from public.dispatch_equipment where id = p_equipment_id;
    perform public.write_audit('equipment.removed', 'dispatch_equipment', p_equipment_id,
      jsonb_build_object('had_dispatch_history', false, 'by', v_name));
    return jsonb_build_object('id', p_equipment_id, 'removed', true);
  end if;
end;
$$;

revoke all on function public.remove_equipment(uuid, boolean) from public;
grant execute on function public.remove_equipment(uuid, boolean) to authenticated;

-- ============================================================================
--  list_equipment_catalog_by_owner
-- ----------------------------------------------------------------------------
--  Returns the catalog rows for a given owner type. Used by the Add form's
--  Type dropdown. The catalog is already readable by everyone (RLS line 134
--  of 038), but a single RPC avoids a separate from('equipment_catalog')
--  client call and lets us filter by the owner's unit_type (or 'Barangay').
-- ============================================================================
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
      'id', c.id, 'unit_type', c.unit_type, 'label', c.label, 'checklist', c.checklist
    ) order by c.label)
    from public.equipment_catalog c
    where c.unit_type = v_type
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_equipment_catalog_by_owner(uuid, uuid) from public;
grant execute on function public.list_equipment_catalog_by_owner(uuid, uuid) to authenticated;

-- ============================================================================
--  housekeeping: updated_at trigger on dispatch_equipment is already in
--  place (migration 038 L705-718). No new triggers needed.
--
--  No new tables; no RLS changes (the existing dispatch_equipment_write
--  policy at 038 L192-204 already covers these RPCs because they run as
--  SECURITY DEFINER, bypassing RLS — but the policy still gates any direct
--  REST writes the way the existing code expects).
-- ============================================================================

commit;

notify pgrst, 'reload schema';
