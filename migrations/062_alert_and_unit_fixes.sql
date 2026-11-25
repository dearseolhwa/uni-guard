-- ============================================================================
--  UniGuard · 062 · Advisory fan-out lock-down, dispatch unit delete
--
--  1) fanout_advisory COULD BE CALLED BY ANYONE
--     The function (003) is security definer, had no permission check and was
--     never revoked from public, so anyone holding the public anon key (even
--     signed out) could call it again and again and flood every resident's
--     inbox with copies of an advisory. Now:
--       · only LGU / LDRRMC and barangay officials can run it;
--       · a barangay official can only fan out an advisory aimed at their own
--         barangay (not a municipality-wide one);
--       · it never inserts a second copy for someone who already has it.
--
--  2) DELETING A DISPATCH UNIT DID NOTHING
--     The app called delete_dispatch_unit, which did not exist, then a direct
--     delete that row security silently refused (dispatch_units has no delete
--     policy), and still showed "Unit deleted". The RPC now exists:
--       · Super Admin only;
--       · refused while the unit is out on a dispatch that is not closed;
--       · personnel are unlinked, past dispatches keep their record (their
--         unit link is cleared by the existing foreign keys), the deletion is
--         written to the audit log.
--
--  Safe to re-run. Run after 061.
-- ============================================================================

-- 1) advisory fan-out ---------------------------------------------------------
create or replace function public.fanout_advisory(p_advisory_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_adv      record;
  v_inserted int := 0;
begin
  if auth.uid() is null or not (public.is_lgu() or public.is_official()) then
    raise exception 'Only LGU / LDRRMC and barangay officials can send an advisory';
  end if;

  select * into v_adv from public.advisories where id = p_advisory_id;
  if v_adv is null then
    return 0;
  end if;

  if public.is_official() and not public.is_lgu() then
    if v_adv.citywide or not exists (
      select 1 from public.advisory_targets t
       where t.advisory_id = v_adv.id and t.barangay_id = public.my_barangay_id()
    ) or exists (
      select 1 from public.advisory_targets t
       where t.advisory_id = v_adv.id and t.barangay_id is distinct from public.my_barangay_id()
    ) then
      raise exception 'You can only send advisories to your own barangay';
    end if;
  end if;

  with targets as (
    select p.id
      from public.profiles p
     where p.disabled = false
       and (
         v_adv.citywide
         or exists (select 1 from public.advisory_targets t
                     where t.advisory_id = v_adv.id and t.barangay_id = p.barangay_id)
       )
       -- never a second copy
       and not exists (select 1 from public.notifications n
                        where n.user_id = p.id and n.advisory_id = v_adv.id)
  ), ins as (
    insert into public.notifications (user_id, title, body, tone, icon, advisory_id)
    select id, v_adv.title, left(v_adv.body, 240), v_adv.severity, 'megaphone', v_adv.id from targets
    returning 1
  )
  select count(*) into v_inserted from ins;

  return v_inserted;
end;
$$;

revoke all on function public.fanout_advisory (uuid) from public;
revoke all on function public.fanout_advisory (uuid) from anon;
grant execute on function public.fanout_advisory (uuid) to authenticated;

-- 2) delete a dispatch unit ---------------------------------------------------
create or replace function public.delete_dispatch_unit(p_unit_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_open int;
begin
  if not public.is_super_admin() then
    raise exception 'Only the Super Admin can delete a dispatch unit';
  end if;

  select name into v_name from public.dispatch_units where id = p_unit_id;
  if v_name is null then
    raise exception 'That unit no longer exists';
  end if;

  select count(*) into v_open
    from public.report_dispatches d
   where d.unit_id = p_unit_id
     and d.dispatch_status not in ('done', 'declined');
  if v_open > 0 then
    raise exception 'This unit is out on % open dispatch(es). Close them before deleting the unit.', v_open;
  end if;

  -- personnel stay, but no longer point at a unit that is gone
  update public.profiles set dispatch_unit_id = null where dispatch_unit_id = p_unit_id;

  delete from public.dispatch_units where id = p_unit_id;

  begin
    insert into public.audit_log (actor_id, action, entity, entity_id, meta)
    values (auth.uid(), 'dispatch_unit.deleted', 'dispatch_units', p_unit_id, jsonb_build_object('name', v_name));
  exception when others then null;  -- the audit log shape differs on older projects
  end;

  return jsonb_build_object('deleted', true, 'id', p_unit_id, 'name', v_name);
end;
$$;

revoke all on function public.delete_dispatch_unit (uuid) from public;
revoke all on function public.delete_dispatch_unit (uuid) from anon;
grant execute on function public.delete_dispatch_unit (uuid) to authenticated;
