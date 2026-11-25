-- =============================================================================
--  UniGuard · 092 · The Super Admin follows SOS; duty officers answer them
-- =============================================================================
--  Run after 091.
--
--  Acknowledging and resolving an SOS is the duty officers' work: the
--  barangay officials of the SOS's barangay and the LDRRMO staff. The Super
--  Admin keeps the records and follows the response (SOS log, maps,
--  notifications) but is no longer asked for a receipt for every SOS, and
--  cannot acknowledge or resolve one.
--
--  · list_pending_sos_receipts: never lists an SOS for the Super Admin.
--  · update_sos_status: 069's function, refusing the Super Admin.
--  · Receipts the Super Admin never gave stop counting against them; any they
--    did give stay on record.
-- =============================================================================
begin;

-- 089's list, without the Super Admin
create or replace function public.list_pending_sos_receipts()
returns setof public.sos_log language sql stable security definer set search_path = public as $$
  select s.* from public.sos_log s
  where s.requires_staff_receipt and s.user_id is distinct from auth.uid()
    and s.status <> 'resolved' and s.expired_at is null
    and not public.is_super_admin()
    and public.is_sos_duty_staff(s.barangay_id, s.barangay)
    and not exists (select 1 from public.sos_staff_receipts r where r.staff_id = auth.uid() and r.sos_id = s.id)
  order by s.created_at;
$$;
revoke all on function public.list_pending_sos_receipts() from public, anon;
grant execute on function public.list_pending_sos_receipts() to authenticated;

-- 069's update_sos_status; the only change is the Super Admin check
create or replace function public.update_sos_status(p_sos_id uuid, p_status text)
returns jsonb
language plpgsql
security definer set search_path = public as $$
declare
  v_row    public.sos_log;
  v_role   text;
  v_name   text;
  v_brgy   text;
  v_office text;
begin
  if auth.uid() is null then raise exception 'You must be signed in'; end if;
  if p_status not in ('acknowledged', 'resolved') then
    raise exception 'Unknown SOS status: %', p_status;
  end if;

  select role, coalesce(nullif(full_name, ''), 'An official'), coalesce(barangay, '')
    into v_role, v_name, v_brgy
    from public.profiles where id = auth.uid() and not disabled;
  if v_role is null or v_role not in ('barangay_official', 'lgu_ldrrmc') then
    raise exception 'Only officials and LGU can update an SOS';
  end if;
  if public.is_super_admin() then
    raise exception 'Duty officers acknowledge and resolve SOS. The Super Admin follows them in the SOS log.';
  end if;
  v_office := case when v_role = 'lgu_ldrrmc' then 'Lingayen LDRRMO'
                   when v_brgy <> '' then 'Barangay ' || v_brgy
                   else 'your barangay' end;

  select * into v_row from public.sos_log where id = p_sos_id for update;
  if v_row.id is null then raise exception 'That SOS entry does not exist'; end if;

  if not public.is_sos_duty_staff(v_row.barangay_id, v_row.barangay) then
    raise exception 'That SOS entry is outside your duty area';
  end if;
  if p_status = 'acknowledged' then
    insert into public.sos_staff_receipts (sos_id, staff_id) values (p_sos_id, auth.uid())
    on conflict do nothing;
    if found then
      perform public.write_audit('sos.staff_acknowledged', 'sos_log', p_sos_id, '{}'::jsonb);
    end if;
  elsif v_row.status = 'sent' or (v_row.requires_staff_receipt and not exists (
    select 1 from public.sos_staff_receipts where staff_id = auth.uid() and sos_id = p_sos_id
  )) then
    raise exception 'Acknowledge this SOS before resolving it';
  end if;

  -- already answered: say who did it first, change nothing, notify no one
  if p_status = 'acknowledged' and v_row.status <> 'sent' then
    return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'already', true,
      'by', v_row.acknowledged_by_name, 'office', v_row.acknowledged_by_office, 'at', v_row.acknowledged_at);
  end if;
  if p_status = 'resolved' and v_row.status = 'resolved' then
    return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'already', true,
      'by', v_row.resolved_by_name, 'at', v_row.resolved_at);
  end if;

  if p_status = 'acknowledged' then
    update public.sos_log
       set status = 'acknowledged', acknowledged_by = auth.uid(), acknowledged_at = now(),
           acknowledged_by_name = v_name, acknowledged_by_office = v_office
     where id = p_sos_id returning * into v_row;
  else
    update public.sos_log
       set status = 'resolved', resolved_by = auth.uid(), resolved_at = now(), resolved_by_name = v_name,
           -- resolving straight from "sent" also counts as answering it
           acknowledged_by = coalesce(acknowledged_by, auth.uid()),
           acknowledged_at = coalesce(acknowledged_at, now()),
           acknowledged_by_name = case when acknowledged_by_name = '' then v_name else acknowledged_by_name end,
           acknowledged_by_office = case when acknowledged_by_office = '' then v_office else acknowledged_by_office end
     where id = p_sos_id returning * into v_row;
  end if;

  perform public.write_audit('sos.status_changed', 'sos_log', p_sos_id,
    jsonb_build_object('to', p_status, 'by', v_name, 'office', v_office));

  -- tell the sender who picked it up / closed it
  if v_row.user_id is not null then
    insert into public.notifications (user_id, title, body, tone, icon, type, sos_id)
    values (v_row.user_id,
            case p_status when 'acknowledged' then 'Your SOS was received — help is being arranged'
                          else 'Your SOS is resolved' end,
            case p_status
              when 'acknowledged' then 'Received by ' || v_office || ' (' || v_name || '). Stay where you are if it is safe; help is being arranged.'
              else 'Closed by ' || v_office || ' (' || v_name || '). If you still need help, send a new SOS or call the hotline.' end,
            case p_status when 'acknowledged' then 'warning' else 'prepared' end,
            'check', 'sos', v_row.id);
  end if;

  return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'by', v_name, 'office', v_office,
    'at', case p_status when 'acknowledged' then v_row.acknowledged_at else v_row.resolved_at end);
end;
$$;
revoke all on function public.update_sos_status(uuid, text) from public, anon;
grant execute on function public.update_sos_status(uuid, text) to authenticated;

commit;
