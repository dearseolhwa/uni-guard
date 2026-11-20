begin;

alter table public.relief_distribution_log
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id) on delete set null;

drop policy if exists "relief_inventory write" on public.relief_inventory;
drop policy if exists "relief_dist_log write" on public.relief_distribution_log;
revoke insert, update, delete on public.relief_inventory, public.relief_distribution_log from anon, authenticated;
grant select on public.relief_inventory, public.relief_distribution_log to authenticated;

-- Capture inventory and its ledger from the same database snapshot.
create or replace function public.read_relief_stock()
returns jsonb language sql stable security invoker set search_path=public as $$
  select jsonb_build_object(
    'inventory',coalesce((select jsonb_agg(to_jsonb(i) order by i.name,i.id) from public.relief_inventory i),'[]'),
    'records',coalesce((select jsonb_agg(to_jsonb(d) order by d.distributed_at desc,d.id)
      from public.relief_distribution_log d where d.voided_at is null),'[]')
  );
$$;

create or replace function public.save_relief_item(
  p_id text,p_name text,p_category text,p_unit text,p_stock integer,p_reorder integer,
  p_location text,p_supplier text,p_version timestamptz default null
)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_mdrrmo_duty_staff() then raise insufficient_privilege; end if;
  if coalesce(btrim(p_name),'')='' or p_stock is null or p_stock<0 or p_reorder is null or p_reorder<0 then
    raise exception 'Enter an item name and non-negative stock and reorder quantities';
  end if;
  if p_version is null then
    insert into public.relief_inventory(id,name,category,unit,stock,reorder,location,supplier,created_by)
    values (p_id,btrim(p_name),p_category,coalesce(nullif(btrim(p_unit),''),'units'),
      p_stock,p_reorder,btrim(p_location),btrim(p_supplier),auth.uid())
    on conflict(id) do nothing;
    if not found then return; end if;
  else
    update public.relief_inventory set name=btrim(p_name),category=p_category,
      unit=coalesce(nullif(btrim(p_unit),''),'units'),stock=p_stock,reorder=p_reorder,
      location=btrim(p_location),supplier=btrim(p_supplier),updated_at=clock_timestamp()
    where id=p_id and updated_at=p_version;
    if not found then raise exception 'This item changed. Reopen it and check the current stock before editing.'; end if;
  end if;
  perform public.write_audit('relief.item_saved','relief_inventory',null,jsonb_build_object('item_id',p_id,'stock',p_stock));
end $$;

create table if not exists public.relief_stock_adjustments (
  id uuid primary key,
  item_id text not null references public.relief_inventory(id),
  delta integer not null check(delta<>0),
  actor uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.relief_stock_adjustments enable row level security;
revoke all on public.relief_stock_adjustments from anon, authenticated;

create or replace function public.adjust_relief_stock(p_id text,p_delta integer,p_operation uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_mdrrmo_duty_staff() then raise insufficient_privilege; end if;
  if p_delta is null or p_delta=0 then raise exception 'Enter a nonzero quantity'; end if;
  insert into public.relief_stock_adjustments(id,item_id,delta,actor)
  values(p_operation,p_id,p_delta,auth.uid()) on conflict(id) do nothing;
  if not found then return; end if;
  update public.relief_inventory set stock=stock+p_delta,updated_at=clock_timestamp()
    where id=p_id and stock::bigint+p_delta between 0 and 2147483647;
  if not found then raise exception 'Invalid adjustment or insufficient stock'; end if;
  perform public.write_audit('relief.stock_adjusted','relief_inventory',null,jsonb_build_object('item_id',p_id,'delta',p_delta));
end $$;

create or replace function public.record_relief_stock_distribution(
  p_id text,p_item text,p_qty integer,p_barangay text,p_family text
)
returns void language plpgsql security definer set search_path=public as $$
declare item public.relief_inventory; locality public.barangays; staff_name text;
begin
  if public.account_session_blocked() or not (
    public.is_mdrrmo_duty_staff() or public.is_official()
  ) then raise insufficient_privilege; end if;
  select * into locality from public.barangays where name=p_barangay;
  if locality.id is null then raise exception 'Choose a valid barangay'; end if;
  if public.is_official() and public.my_barangay_id() is distinct from locality.id then
    raise insufficient_privilege using message='You can only record distributions for your own barangay';
  end if;
  if p_qty is null or p_qty<=0 then raise exception 'Enter a positive whole quantity'; end if;
  select * into item from public.relief_inventory where id=p_item for update;
  if item.id is null then raise exception 'Stock item not found'; end if;
  select full_name into staff_name from public.profiles where id=auth.uid();
  insert into public.relief_distribution_log(id,item_id,item_name,qty,barangay,family,distributed_by,created_by)
  values(p_id,p_item,item.name,p_qty,locality.name,coalesce(btrim(p_family),''),staff_name,auth.uid())
  on conflict(id) do nothing;
  if not found then return; end if;
  if item.stock<p_qty then raise exception 'Insufficient stock. Available quantity: %',item.stock; end if;
  update public.relief_inventory set stock=stock-p_qty,updated_at=clock_timestamp() where id=p_item;
  perform public.write_audit('relief.distribution_recorded','relief_distribution_log',null,
    jsonb_build_object('record_id',p_id,'item_id',p_item,'quantity',p_qty,'barangay_id',locality.id));
end $$;

create or replace function public.void_relief_stock_distribution(p_id text)
returns void language plpgsql security definer set search_path=public as $$
declare entry public.relief_distribution_log;
begin
  if not public.is_mdrrmo_duty_staff() then raise insufficient_privilege; end if;
  select * into entry from public.relief_distribution_log where id=p_id for update;
  if entry.id is null then raise exception 'Distribution not found'; end if;
  if entry.voided_at is not null then return; end if;
  if entry.item_id is null then raise exception 'The original stock item no longer exists'; end if;
  update public.relief_inventory set stock=stock+entry.qty,updated_at=clock_timestamp() where id=entry.item_id;
  update public.relief_distribution_log set voided_at=now(),voided_by=auth.uid() where id=p_id;
  perform public.write_audit('relief.distribution_voided','relief_distribution_log',null,
    jsonb_build_object('record_id',p_id,'item_id',entry.item_id,'quantity',entry.qty));
end $$;

revoke all on function public.read_relief_stock(),public.save_relief_item(text,text,text,text,integer,integer,text,text,timestamptz),
  public.adjust_relief_stock(text,integer,uuid),public.record_relief_stock_distribution(text,text,integer,text,text),
  public.void_relief_stock_distribution(text) from public,anon;
grant execute on function public.read_relief_stock(),public.save_relief_item(text,text,text,text,integer,integer,text,text,timestamptz),
  public.adjust_relief_stock(text,integer,uuid),public.record_relief_stock_distribution(text,text,integer,text,text),
  public.void_relief_stock_distribution(text) to authenticated;

do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime' and not puballtables) then
    foreach t in array array['relief_inventory','relief_distribution_log'] loop
      if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
        execute format('alter publication supabase_realtime add table public.%I',t);
      end if;
    end loop;
  end if;
end $$;

commit;
