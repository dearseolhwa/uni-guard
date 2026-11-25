begin;

drop index if exists public.report_dispatches_one_lead_idx;
create unique index if not exists report_dispatches_one_active_lead_idx
on public.report_dispatches(report_id)
where assignment_role = 'lead' and dispatch_status not in ('done', 'declined');

-- Recover a lead already replaced before this migration.
with recursive handoffs as (
  select id, report_id from public.report_dispatches where assignment_role='lead'
  union
  select d.id, d.report_id from public.report_dispatches d
  join handoffs h on d.rerouted_from=h.id and d.report_id=h.report_id
), promoted as (
  select distinct on (d.report_id) d.id
  from handoffs h join public.report_dispatches d on d.id=h.id
  where d.assignment_role='support' and d.dispatch_status not in ('done','declined')
    and not exists (select 1 from public.report_dispatches x where x.report_id=d.report_id
      and x.assignment_role='lead' and x.dispatch_status not in ('done','declined'))
  order by d.report_id, d.dispatched_at desc, d.id
)
update public.report_dispatches set assignment_role='lead' where id in (select id from promoted);

create or replace function public.classify_report_dispatch()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform 1 from public.reports where id = new.report_id for update;
  if new.team = 'Ambulance' and new.unit_id is not null and not exists (
    select 1 from public.dispatch_units where id = new.unit_id and active
    and unit_type = 'Hospital' and ambulance_available
  ) then raise exception 'That hospital has no ambulance available for dispatch'; end if;

  new.assignment_role := case when exists (
    select 1 from public.report_dispatches where report_id = new.report_id
      and assignment_role = 'lead' and dispatch_status not in ('done','declined')
  ) or exists (
    select 1 from public.report_dispatches where id = new.rerouted_from and assignment_role = 'support'
    and report_id = new.report_id
  ) then 'support' else 'lead' end;
  return new;
end $$;

create table if not exists public.emergency_delivery (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('sos', 'dispatch')),
  event_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed','cancelled')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_id uuid,
  created_at timestamptz not null default now(),
  channel text,
  reason text,
  unique (kind, event_id, user_id)
);
alter table public.emergency_delivery enable row level security;
revoke all on public.emergency_delivery from public, anon, authenticated;
grant select on public.emergency_delivery to service_role;
create index if not exists emergency_delivery_ready_idx on public.emergency_delivery(next_attempt_at)
where status in ('pending','processing');

create or replace function public.queue_emergency_delivery()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'sos_log' then
    if new.status = 'sent' then
      insert into public.emergency_delivery(kind,event_id,user_id)
      select 'sos', new.id, p.id from public.profiles p
       where not p.disabled and p.id is distinct from new.user_id
       and (p.role = 'lgu_ldrrmc' or (p.role = 'barangay_official' and
         (p.barangay_id = new.barangay_id or (new.barangay_id is null and nullif(new.barangay,'') = p.barangay))))
      on conflict do nothing;
    end if;
  elsif new.dispatch_status = 'sent' then
    insert into public.emergency_delivery(kind,event_id,user_id)
    select 'dispatch', new.id, p.id from public.profiles p where not p.disabled and
      ((new.unit_id is not null and p.role = 'dispatch_team' and p.dispatch_unit_id = new.unit_id)
       or (new.unit_id is null and p.role = 'barangay_official' and p.barangay_id = new.target_barangay_id))
    on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists sos_queue_emergency_delivery on public.sos_log;
create trigger sos_queue_emergency_delivery after insert on public.sos_log
for each row execute function public.queue_emergency_delivery();
drop trigger if exists dispatch_queue_emergency_delivery on public.report_dispatches;
create trigger dispatch_queue_emergency_delivery after insert on public.report_dispatches
for each row execute function public.queue_emergency_delivery();

create or replace function public.claim_emergency_delivery()
returns setof public.emergency_delivery language sql security definer set search_path = public as $$
  with ready as (
    select id from public.emergency_delivery where status in ('pending','processing')
      and next_attempt_at <= now() order by next_attempt_at
      limit 20 for update skip locked
  )
  update public.emergency_delivery j set status='processing', attempts=j.attempts+1,
    next_attempt_at=now()+interval '5 minutes', lease_id=gen_random_uuid()
  from ready where j.id=ready.id returning j.*;
$$;

create or replace function public.finish_emergency_delivery(
  p_id uuid, p_lease uuid, p_outcome text, p_channel text, p_reason text
)
returns void language plpgsql security definer set search_path = public as $$
declare j public.emergency_delivery;
begin
  if p_outcome is null or p_outcome not in ('sent','failed','retry','cancelled') then
    raise exception 'Invalid delivery outcome';
  end if;
  update public.emergency_delivery set
    status = case when p_outcome='retry' then case when attempts < 3 then 'pending' else 'failed' end else p_outcome end,
    channel=p_channel, reason=left(p_reason,160), next_attempt_at=now()+interval '30 seconds'
  where id=p_id and lease_id=p_lease and status='processing' returning * into j;
  if j.status='failed' then
    insert into public.notifications(user_id,title,body,tone,icon,type,sos_id,report_id)
    select p.id, 'Emergency alert delivery failed',
      'A staff member could not be reached by push or SMS. Use the duty phone or radio and confirm receipt.',
      'emergency','alert','emergency_delivery_failure',
      case when j.kind='sos' then j.event_id end,
      case when j.kind='dispatch' then (select report_id from public.report_dispatches where id=j.event_id) end
    from public.profiles p where p.role='lgu_ldrrmc' and not p.disabled;
    perform public.write_audit('emergency_delivery.failed','emergency_delivery',j.id,
      jsonb_build_object('event_id',j.event_id,'kind',j.kind,'recipient_id',j.user_id,'reason',j.reason));
  end if;
end $$;

revoke all on function public.claim_emergency_delivery() from public, anon, authenticated;
revoke all on function public.finish_emergency_delivery(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.claim_emergency_delivery() to service_role;
grant execute on function public.finish_emergency_delivery(uuid,uuid,text,text,text) to service_role;

commit;
