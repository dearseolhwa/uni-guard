begin;

create index if not exists relief_distribution_active_item_idx
  on public.relief_distribution_log (item_id) where voided_at is null;

-- An outstanding handout must be returned in the same unit it used at issue.
create or replace function public.guard_relief_stock_unit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if lower(btrim(new.unit)) is distinct from lower(btrim(old.unit)) and exists (
    select 1 from public.relief_distribution_log
    where item_id = old.id and voided_at is null
  ) then
    raise invalid_parameter_value using
      message = 'This item has recorded distributions in its current unit. Create a separate stock item for the new unit.';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_relief_stock_unit() from public, anon, authenticated;
drop trigger if exists relief_stock_guard_unit on public.relief_inventory;
create trigger relief_stock_guard_unit before update of unit on public.relief_inventory
for each row execute function public.guard_relief_stock_unit();

commit;
