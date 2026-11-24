begin;

-- Persist the advisory, its audience and all in-app notifications in one transaction.
-- The draft ID stays the same when a client retries an unchanged draft.
create or replace function public.publish_advisory(
  p_request_id uuid,
  p_advisory jsonb,
  p_barangay_ids uuid[] default '{}'
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_author uuid := auth.uid();
  v_citywide boolean := coalesce((p_advisory->>'citywide')::boolean, false);
  v_targets uuid[];
  v_area text;
  v_row public.advisories;
  v_notified integer;
begin
  if not public.is_active_user() or public.account_session_blocked() or public.account_is_removed()
     or not (public.is_lgu() or public.is_official()) then
    raise insufficient_privilege using message = 'Only active LGU or barangay officials can publish advisories';
  end if;
  if p_request_id is null or coalesce(btrim(p_advisory->>'title'), '') = ''
     or coalesce(btrim(p_advisory->>'body'), '') = '' then
    raise invalid_parameter_value using message = 'Enter an advisory title and message';
  end if;

  select coalesce(array_agg(distinct id order by id), '{}') into v_targets
    from unnest(p_barangay_ids) as requested(id) where id is not null;
  if public.is_official() and (v_citywide or public.my_barangay_id() is null
     or v_targets is distinct from array[public.my_barangay_id()]) then
    raise insufficient_privilege using message = 'You can only publish to your own barangay';
  end if;
  if v_citywide then
    if cardinality(v_targets) > 0 then
      raise invalid_parameter_value using message = 'Choose either a municipality-wide advisory or specific barangays';
    end if;
    v_area := 'Municipality-wide';
  else
    if cardinality(v_targets) = 0 or (
      select count(*) from public.barangays where id = any(v_targets) and active
    ) <> cardinality(v_targets) then
      raise invalid_parameter_value using message = 'Choose a valid barangay before publishing';
    end if;
    select string_agg(name, ', ' order by name) into v_area
      from public.barangays where id = any(v_targets);
  end if;

  insert into public.advisories (
    id, author_id, title, body, severity, kind, affected_area, citywide, barangay_id,
    expires_at, alert_type, language, delivery_mode
  )
  values (
    p_request_id, v_author, btrim(p_advisory->>'title'), btrim(p_advisory->>'body'),
    coalesce(p_advisory->>'severity', 'advisory'), coalesce(p_advisory->>'kind', 'emergency'),
    v_area, v_citywide, case when cardinality(v_targets) = 1 then v_targets[1] else null end,
    nullif(p_advisory->>'expires_at', '')::timestamptz, coalesce(p_advisory->>'alert_type', 'general'),
    coalesce(p_advisory->>'language', 'en'), coalesce(p_advisory->>'delivery_mode', 'push')
  )
  on conflict (id) do nothing
  returning * into v_row;

  if found then
    insert into public.advisory_targets(advisory_id, barangay_id)
      select v_row.id, id from unnest(v_targets) as target(id);
    v_notified := public.fanout_advisory(v_row.id);
  else
    select * into v_row from public.advisories where id = p_request_id and author_id = v_author;
    if not found then raise unique_violation using message = 'This advisory reference is already in use'; end if;
    select count(*) into v_notified from public.notifications where advisory_id = v_row.id;
    select coalesce(array_agg(barangay_id order by barangay_id), '{}') into v_targets
      from public.advisory_targets where advisory_id = v_row.id;
  end if;

  return to_jsonb(v_row) || jsonb_build_object('reached', v_notified, 'barangay_ids', v_targets);
end;
$$;

revoke all on function public.publish_advisory(uuid, jsonb, uuid[]) from public, anon;
grant execute on function public.publish_advisory(uuid, jsonb, uuid[]) to authenticated;

-- Give LGU operators the eligible device count without exposing subscriptions.
create or replace function public.emergency_push_device_count()
returns integer language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_lgu() or not public.is_active_user()
     or public.account_session_blocked() or public.account_is_removed() then
    raise insufficient_privilege using message = 'Only active LGU accounts can count emergency subscribers';
  end if;
  return (select count(*) from public.push_subscriptions s
    join public.profiles p on p.id = s.user_id where not p.disabled and p.removed_at is null);
end;
$$;

revoke all on function public.emergency_push_device_count() from public, anon;
grant execute on function public.emergency_push_device_count() to authenticated;

create or replace function public.declare_emergency(
  p_title text,
  p_body text default '',
  p_area text default 'Municipality-wide'
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_devices integer;
  v_reached integer;
begin
  v_devices := public.emergency_push_device_count();
  perform public.check_rate_limit('declare', 3, interval '30 minutes');
  insert into public.advisories (author_id, title, body, severity, kind, affected_area, citywide, published_at)
  values (auth.uid(), p_title, coalesce(p_body, ''), 'emergency', 'emergency', coalesce(p_area, 'Municipality-wide'), true, now())
  returning id into v_id;
  v_reached := public.fanout_advisory(v_id);
  perform public.write_audit('emergency.declared', 'advisories', v_id,
    jsonb_build_object('title', p_title, 'area', p_area, 'subscribed_devices', v_devices, 'notified', v_reached));
  return jsonb_build_object('advisory_id', v_id, 'devices', v_devices, 'notified', v_reached);
end;
$$;
revoke all on function public.declare_emergency(text, text, text) from public, anon;
grant execute on function public.declare_emergency(text, text, text) to authenticated;

notify pgrst, 'reload schema';
commit;
