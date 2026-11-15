-- ============================================================================
--  UniGuard · 064 · SOS: who acknowledged it, and when
--
--  update_sos_status (029) changed the status and notified the sender, but
--  kept no record on the SOS of who answered or when (only the audit log
--  had it), so the console could not show "Acknowledged by …" and two
--  officials could both acknowledge the same SOS.
--
--    · sos_log gains acknowledged_by / _at / _by_name / _by_office and
--      resolved_by / _at / _by_name
--    · acknowledging an SOS that is already acknowledged does nothing and
--      says who did it first (no second notification to the sender)
--    · the sender's notification names who received it:
--        "Your SOS was received by Barangay Poblacion (Juan Dela Cruz).
--         Help is being arranged."
--
--  Permissions are unchanged: officials for their own barangay, the LGU for
--  every SOS. Safe to re-run. Run after 063.
-- ============================================================================

alter table public.sos_log add column if not exists acknowledged_by        uuid references public.profiles(id) on delete set null;
alter table public.sos_log add column if not exists acknowledged_at        timestamptz;
alter table public.sos_log add column if not exists acknowledged_by_name   text not null default '';
alter table public.sos_log add column if not exists acknowledged_by_office text not null default '';
alter table public.sos_log add column if not exists resolved_by            uuid references public.profiles(id) on delete set null;
alter table public.sos_log add column if not exists resolved_at            timestamptz;
alter table public.sos_log add column if not exists resolved_by_name       text not null default '';

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
    from public.profiles where id = auth.uid();
  if v_role not in ('barangay_official', 'lgu_ldrrmc') then
    raise exception 'Only officials and LGU can update an SOS';
  end if;
  v_office := case when v_role = 'lgu_ldrrmc' then 'Lingayen LDRRMO'
                   when v_brgy <> '' then 'Barangay ' || v_brgy
                   else 'your barangay' end;

  select * into v_row from public.sos_log where id = p_sos_id;
  if v_row.id is null then raise exception 'That SOS entry does not exist'; end if;

  if v_role = 'barangay_official' then
    if v_row.barangay_id is not null and v_row.barangay_id is distinct from public.my_barangay_id() then
      raise exception 'That SOS entry is outside your barangay';
    end if;
    if v_row.barangay_id is null and coalesce(v_row.barangay, '') is distinct from public.my_barangay_name() then
      raise exception 'That SOS entry is outside your barangay';
    end if;
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
revoke all on function public.update_sos_status(uuid, text) from public;
grant execute on function public.update_sos_status(uuid, text) to authenticated;
