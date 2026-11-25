begin;

-- Apply increment/decrement to the locked database row so simultaneous updates are retained.
create or replace function public.set_shelter_occupancy(
  p_center_id uuid, p_value integer, p_is_delta boolean default false
)
returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  v_center public.evacuation_centers;
  v_occupancy integer;
begin
  if not public.is_active_user() or public.account_session_blocked() or public.account_is_removed()
     or not (public.is_lgu() or public.is_official()) then
    raise insufficient_privilege using message = 'Only active LGU and barangay officials can update shelter occupancy';
  end if;
  select * into v_center from public.evacuation_centers where id = p_center_id for update;
  if not found or (public.is_official() and public.my_barangay_id() is distinct from v_center.barangay_id) then
    raise insufficient_privilege using message = 'This shelter is outside your assigned barangay or is unavailable';
  end if;
  if p_value is null or v_center.capacity < 0 then
    raise invalid_parameter_value using message = 'Enter a valid shelter occupancy';
  end if;
  if v_center.status = 'closed' then
    raise invalid_parameter_value using message = 'Open the shelter before updating its occupancy';
  end if;

  if p_is_delta then
    v_occupancy := greatest(0, least(v_center.capacity, v_center.occupancy::bigint + p_value));
  elsif p_value between 0 and v_center.capacity then
    v_occupancy := p_value;
  else
    raise invalid_parameter_value using message = 'Occupancy must be between zero and the shelter capacity';
  end if;

  update public.evacuation_centers
     set occupancy = v_occupancy,
         status = case when capacity > 0 and v_occupancy = capacity then 'full' else 'open' end
   where id = p_center_id
   returning * into v_center;
  if not found then raise insufficient_privilege using message = 'This shelter could not be updated'; end if;
  return to_jsonb(v_center);
end;
$$;
revoke all on function public.set_shelter_occupancy(uuid, integer, boolean) from public, anon;
grant execute on function public.set_shelter_occupancy(uuid, integer, boolean) to authenticated;

-- Date parameters and day bins represent the municipality's calendar.
alter function public.analytics_by_hazard(date, date) set timezone = 'Asia/Manila';
alter function public.analytics_pipeline(date, date) set timezone = 'Asia/Manila';
alter function public.analytics_daily(date, date) set timezone = 'Asia/Manila';
alter function public.analytics_response_times(date, date) set timezone = 'Asia/Manila';
alter function public.analytics_corroboration(date, date) set timezone = 'Asia/Manila';
alter function public.analytics_shelters(date, date) set timezone = 'Asia/Manila';
alter function public.analytics_by_barangay(date, date) set timezone = 'Asia/Manila';

notify pgrst, 'reload schema';
commit;
