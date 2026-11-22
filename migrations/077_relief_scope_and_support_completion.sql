begin;

-- Municipality-wide schedules remain readable under relief_distributions_read.
drop policy if exists relief_distributions_write on public.relief_distributions;
drop policy if exists relief_distributions_manage on public.relief_distributions;
create policy relief_distributions_manage on public.relief_distributions
for all to authenticated
using (public.is_lgu() or (public.is_official() and barangay_id = public.my_barangay_id()))
with check (public.is_lgu() or (public.is_official() and barangay_id = public.my_barangay_id()));

drop policy if exists authorized_beneficiaries_read on public.authorized_beneficiaries;
drop policy if exists authorized_beneficiaries_write on public.authorized_beneficiaries;
drop policy if exists authorized_beneficiaries_manage on public.authorized_beneficiaries;
create policy authorized_beneficiaries_manage on public.authorized_beneficiaries
for all to authenticated
using (public.is_lgu() or (public.is_official() and barangay_id = public.my_barangay_id()))
with check (public.is_lgu() or (public.is_official() and barangay_id = public.my_barangay_id()));

create or replace function public.decide_unit_request(
  p_request_id uuid,
  p_decision text,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.unit_requests;
  v_role text;
  v_name text;
begin
  if auth.uid() is null then raise exception 'You must be signed in'; end if;
  if public.is_super_admin() or public.account_session_blocked() then
    raise insufficient_privilege using message='Operational response updates require duty staff access';
  end if;
  if p_decision is null or p_decision not in ('approved','declined','done') then
    raise exception 'Decision must be approved, declined or done';
  end if;

  select role, coalesce(full_name, '') into v_role, v_name
    from public.profiles where id=auth.uid();
  if v_role is distinct from 'lgu_ldrrmc' and not coalesce(
    v_role='dispatch_team' and public.is_unit_admin() and p_decision='done', false
  ) then
    raise insufficient_privilege using message='Only LDRRMO staff or the assigned unit admin may take this action';
  end if;
  select * into v_row
    from public.unit_requests
   where id=p_request_id and (v_role='lgu_ldrrmc' or unit_id=public.my_unit_id())
     for update;
  if v_row.id is null then raise exception 'This support request is unavailable to your account'; end if;

  if v_row.status=p_decision then
    return jsonb_build_object('id', p_request_id, 'status', p_decision);
  end if;
  if p_decision='done' then
    if v_row.status<>'approved' then raise exception 'Only an approved request can be marked done'; end if;
  elsif v_row.status<>'pending' then
    raise exception 'Only a pending request can be approved or declined';
  end if;

  update public.unit_requests set status=p_decision, decided_by=auth.uid(), decided_at=now()
    where id=p_request_id;

  insert into public.notifications (user_id,title,body,tone,icon,type)
  select p.id, 'Support request ' || p_decision,
         left(coalesce(p_note, '') || ' · ' || v_row.kind, 240),
         case when p_decision='declined' then 'warning' else 'prepared' end,
         'check', 'unit_request'
    from public.profiles p
   where not p.disabled and p.role='dispatch_team' and p.dispatch_unit_id=v_row.unit_id;

  perform public.write_audit('unit_request.decided', 'unit_requests', p_request_id,
    jsonb_build_object('decision', p_decision, 'note', left(coalesce(p_note, ''), 240), 'by', v_name));
  return jsonb_build_object('id', p_request_id, 'status', p_decision);
end;
$$;

commit;
