-- ============================================================================
--  UniGuard · 075 · Super Admin audit fixes (audit report 2026-11-22)
--
--  Apply AFTER 051–074. Idempotent: safe to run more than once.
--    F-01  change_requests.requester_id: drop NOT NULL so deleting an account
--          that once filed a change request no longer fails (the FK is
--          ON DELETE SET NULL).
--    F-11  revoke the superseded 006/043 admin_set_user_* RPCs from clients;
--          admin_edit_staff_account (072) and the admin-users function replace
--          them. service_role keeps access.
--    F-15  re-run 072's reject_revoked_session loop so tables created after 072
--          (073 barangay_dispatch_requests, 074, and any later table) get it.
--    F-17  approve_change_request raises when an edit/delete target no longer
--          exists instead of silently approving a no-op.
-- ============================================================================
begin;

-- F-01 ----------------------------------------------------------------------
alter table public.change_requests alter column requester_id drop not null;

-- F-11 ----------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.admin_set_user_role(uuid,text,uuid)',
    'public.admin_set_user_disabled(uuid,boolean)',
    'public.admin_set_user_barangay(uuid,uuid)'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', f);
      execute format('grant execute on function %s to service_role', f);
    end if;
  end loop;
end $$;

-- F-15 ----------------------------------------------------------------------
do $$
declare t record;
begin
  if to_regprocedure('public.account_session_blocked()') is null then
    raise exception 'Apply migration 072 before 075 (public.account_session_blocked() is missing)';
  end if;
  for t in select tablename from pg_tables where schemaname='public' and rowsecurity loop
    execute format('drop policy if exists reject_revoked_session on public.%I', t.tablename);
    execute format('create policy reject_revoked_session on public.%I as restrictive for all to authenticated using (not (select public.account_session_blocked())) with check (not (select public.account_session_blocked()))', t.tablename);
  end loop;
end $$;

-- F-17 ----------------------------------------------------------------------
create or replace function public.approve_change_request(
  p_request_id    uuid,
  p_decision_note text default ''
)
returns public.change_requests
language plpgsql
security definer set search_path = public
as $$
declare
  v_row    public.change_requests;
  v_name   text;
  v_id     uuid;
  v_proposed jsonb;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  if not public.is_super_admin() then
    raise exception 'Only the Super Admin can approve a change request';
  end if;

  -- lock the request so two approvals cannot race
  select * into v_row from public.change_requests where id = p_request_id for update;
  if v_row.id is null then
    raise exception 'That change request does not exist';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'That change request has already been decided (%)', v_row.status;
  end if;

  select coalesce(full_name,'') into v_name from public.profiles where id = auth.uid();
  v_proposed := v_row.proposed_data;

  if v_row.target_table = 'emergency_hotlines' then
    if v_row.action = 'add' then
      insert into public.emergency_hotlines (agency_name, contact_number, scope, description, barangay_id, active)
      values (
        coalesce(v_proposed->>'agency_name',''),
        coalesce(v_proposed->>'contact_number',''),
        coalesce(v_proposed->>'scope','Municipality-wide'),
        coalesce(v_proposed->>'description',''),
        nullif(v_proposed->>'barangay_id','')::uuid,
        coalesce((v_proposed->>'active')::boolean, true)
      ) returning id into v_id;
    elsif v_row.action = 'edit' then
      update public.emergency_hotlines
         set agency_name    = coalesce(v_proposed->>'agency_name', agency_name),
             contact_number = coalesce(v_proposed->>'contact_number', contact_number),
             scope          = coalesce(v_proposed->>'scope', scope),
             description    = coalesce(v_proposed->>'description', description),
             active         = coalesce((v_proposed->>'active')::boolean, active),
             updated_at     = now()
       where id = v_row.target_id
       returning id into v_id;
      if v_id is null then
        raise exception 'Target record no longer exists. Reject this request instead.';
      end if;
    elsif v_row.action = 'delete' then
      delete from public.emergency_hotlines where id = v_row.target_id returning id into v_id;
      if v_id is null then
        raise exception 'Target record no longer exists. Reject this request instead.';
      end if;
    end if;
  else
    raise exception 'Approving changes on % is not supported yet', v_row.target_table;
  end if;

  update public.change_requests
     set status = 'approved',
         decided_by = auth.uid(),
         decided_at = now(),
         decision_note = left(coalesce(p_decision_note, ''), 500),
         updated_at = now()
   where id = p_request_id
   returning * into v_row;

  perform public.write_audit('change_request.approved', 'change_requests', p_request_id,
    jsonb_build_object(
      'target_table', v_row.target_table,
      'target_id', v_row.target_id,
      'action', v_row.action,
      'decided_by', v_name,
      'note', left(coalesce(p_decision_note, ''), 240)
    ));

  if v_row.requester_id is not null then
    insert into public.notifications (user_id, title, body, tone, icon, type)
    values (v_row.requester_id,
            'Change request approved',
            'Your ' || v_row.action || ' request on ' || v_row.target_table ||
              ' was approved by ' || v_name || '.' ||
              case when coalesce(p_decision_note, '') <> '' then ' ' || left(p_decision_note, 140) else '' end,
            'prepared', 'check', 'change_request');
  end if;

  return v_row;
end;
$$;
revoke all on function public.approve_change_request(uuid, text) from public;
grant execute on function public.approve_change_request(uuid, text) to authenticated;

commit;

-- Verify:
--   select is_nullable from information_schema.columns
--    where table_name='change_requests' and column_name='requester_id';   -- YES
--   select tablename from pg_tables t where schemaname='public' and rowsecurity
--    and not exists (select 1 from pg_policies p where p.tablename=t.tablename
--                    and p.policyname='reject_revoked_session');            -- no rows
