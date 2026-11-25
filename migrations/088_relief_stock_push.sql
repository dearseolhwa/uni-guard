begin;

-- Keep table management privileges off the stock browser roles as well.
revoke truncate, references, trigger on public.relief_inventory, public.relief_distribution_log
  from public, anon, authenticated;

alter table public.emergency_delivery drop constraint if exists emergency_delivery_kind_check;
alter table public.emergency_delivery add constraint emergency_delivery_kind_check
  check (kind in ('sos', 'dispatch', 'report_review', 'dispatch_gap', 'hazard_confirmed', 'relief_low_stock'));

-- The 087 stock trigger already decides when to notify and who receives a row.
-- Use the notification ID to distinguish each stock threshold crossing.
create or replace function public.queue_relief_stock_push()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from new_notifications where type = 'relief_low_stock') then return null; end if;
  insert into public.emergency_delivery (kind, event_id, user_id, urgent)
  select 'relief_low_stock', id, user_id, false
  from new_notifications where type = 'relief_low_stock'
  on conflict (kind, event_id, user_id) do nothing;
  return null;
end;
$$;
revoke all on function public.queue_relief_stock_push() from public, anon, authenticated;

drop trigger if exists notifications_queue_relief_stock_push on public.notifications;
create trigger notifications_queue_relief_stock_push after insert on public.notifications
referencing new table as new_notifications for each statement
execute function public.queue_relief_stock_push();

-- A failed optional stock push should never generate an emergency incident alert.
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
  if j.status='failed' and j.kind <> 'relief_low_stock' then
    insert into public.notifications(user_id,title,body,tone,icon,type,sos_id,report_id)
    select p.id, 'Emergency alert delivery failed',
      'A staff member could not be reached by push or SMS. Open the incident and confirm receipt by duty phone or radio.',
      'emergency','alert','emergency_delivery_failure',
      case when j.kind='sos' then j.event_id end,
      case when j.kind='dispatch' then (select report_id from public.report_dispatches where id=j.event_id)
           when j.kind in ('report_review','dispatch_gap','hazard_confirmed') then j.event_id end
    from public.profiles p where p.role='lgu_ldrrmc' and not p.is_super_admin and not p.disabled and p.removed_at is null;
    perform public.write_audit('emergency_delivery.failed','emergency_delivery',j.id,
      jsonb_build_object('event_id',j.event_id,'kind',j.kind,'recipient_id',j.user_id,'reason',j.reason));
  end if;
end $$;

commit;
