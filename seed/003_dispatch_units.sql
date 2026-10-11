-- ============================================================================
--  UniGuard · SAMPLE DATA · Dispatch units (BFP, PNP, Rescue, Hospital) and
--  the per-type equipment catalogs.
--
--  Every phone number, address and coordinate below is a PLACEHOLDER taken
--  from the design prototype. Verify each entry against the official
--  Lingayen MDRRMO records before production use, then delete anything that
--  is wrong. The barangays themselves are the PSA list (already in 001).
--
--  Safe to re-run: everything is guarded by ON CONFLICT DO NOTHING.
-- ============================================================================

-- ---------------------------------------------------- equipment_catalog
-- Per unit_type, the labels and the readiness checklist items the unit
-- admin runs through every shift. The checklist is a JSONB array of strings.
insert into public.equipment_catalog (unit_type, label, checklist)
select v.unit_type, v.label, v.checklist::jsonb
  from (values
    -- BFP
    ('BFP', 'Fire Truck',          '["Water level","Hose condition","Pump test","Fuel level","Engine start"]'::text),
    ('BFP', 'Water Tanker',        '["Water volume","Valve operation","Hose connection","Fuel level"]'::text),
    ('BFP', 'Aerial Ladder',       '["Hydraulic test","Ladder extension","Stabilisers","Controls"]'::text),
    ('BFP', 'Breathing Apparatus (SCBA)', '["Cylinder pressure","Face mask seal","Regulator","Airflow"]'::text),
    ('BFP', 'Hose Set',            '["Nozzles","Couplings","Pressure test","Length"]'::text),
    -- PNP
    ('PNP', 'Patrol Car',          '["Fuel level","Radio battery","Lights and siren","First-aid kit"]'::text),
    ('PNP', 'Motorcycle',          '["Fuel level","Tyres","Lights","Radio battery"]'::text),
    ('PNP', 'Barriers and Cones',  '["Count","Reflective condition","Stands","Bag"]'::text),
    ('PNP', 'Radios',              '["Battery","Channel scan","Antenna","Speaker"]'::text),
    ('PNP', 'Crowd-Control Kit',   '["Vests","Megaphone","Baton","Whistle"]'::text),
    -- Rescue Unit
    ('Rescue', 'Rescue Boat',      '["Engine start","Fuel level","Life vests","Paddles","Hull"]'::text),
    ('Rescue', 'Extrication Tools', '["Hydraulic pump","Cutter","Spreader","Ram","Hoses"]'::text),
    ('Rescue', 'Rope and Rappel Set', '["Rope integrity","Carabiners","Harnesses","Descenders","Anchors"]'::text),
    ('Rescue', 'Stretcher',        '["Straps","Frame","Wheels","Cleanliness"]'::text),
    ('Rescue', 'First-Aid Kit',    '["Bandages","Antiseptics","Medicines list","Triage tags"]'::text),
    -- Hospital
    ('Hospital', 'Ambulance',      '["Fuel level","Tyres","Stretcher","Oxygen tank","Defibrillator"]'::text),
    ('Hospital', 'ER Beds',        '["Available count","Bedding","Monitors","Oxygen outlets"]'::text),
    ('Hospital', 'ICU Beds',       '["Available count","Ventilators","Monitors","Power"]'::text),
    ('Hospital', 'Oxygen',         '["Cylinder count","Pressure","Backup supply","Flow meters"]'::text),
    ('Hospital', 'Blood Supply',   '["A+","A-","B+","B-","AB+","AB-","O+","O-","Storage temp"]'::text),
    -- Barangay Response Team
    ('Barangay', 'Boat',           '["Hull","Paddles","Life vests","Rope"]'::text),
    ('Barangay', 'Rope',           '["Length","Knot integrity","Cleanliness"]'::text),
    ('Barangay', 'Stretcher',      '["Frame","Straps","Wheels"]'::text),
    ('Barangay', 'Radio',           '["Battery","Channel","Speaker","Antenna"]'::text),
    ('Barangay', 'First-Aid Kit',   '["Bandages","Antiseptics","Medicines list","Triage tags"]'::text)
  ) as v(unit_type, label, checklist)
on conflict (id, unit_type, label) do nothing;

-- the unique index the conflict relies on (id is the PK so we always have
-- something; add a unit_type+label unique index if it does not exist).
do $$
begin
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public' and tablename = 'equipment_catalog'
       and indexname = 'equipment_catalog_type_label_key'
  ) then
    create unique index equipment_catalog_type_label_key
      on public.equipment_catalog (unit_type, label);
  end if;
end $$;

-- re-run the insert so the ON CONFLICT works on the new index (the first
-- insert would have created duplicates only across separate re-runs; this
-- second pass is a no-op when the rows already exist).
insert into public.equipment_catalog (unit_type, label, checklist)
select v.unit_type, v.label, v.checklist::jsonb
  from (values
    ('BFP', 'Fire Truck',          '["Water level","Hose condition","Pump test","Fuel level","Engine start"]'::text),
    ('BFP', 'Water Tanker',        '["Water volume","Valve operation","Hose connection","Fuel level"]'::text),
    ('BFP', 'Aerial Ladder',       '["Hydraulic test","Ladder extension","Stabilisers","Controls"]'::text),
    ('BFP', 'Breathing Apparatus (SCBA)', '["Cylinder pressure","Face mask seal","Regulator","Airflow"]'::text),
    ('BFP', 'Hose Set',            '["Nozzles","Couplings","Pressure test","Length"]'::text),
    ('PNP', 'Patrol Car',          '["Fuel level","Radio battery","Lights and siren","First-aid kit"]'::text),
    ('PNP', 'Motorcycle',          '["Fuel level","Tyres","Lights","Radio battery"]'::text),
    ('PNP', 'Barriers and Cones',  '["Count","Reflective condition","Stands","Bag"]'::text),
    ('PNP', 'Radios',              '["Battery","Channel scan","Antenna","Speaker"]'::text),
    ('PNP', 'Crowd-Control Kit',   '["Vests","Megaphone","Baton","Whistle"]'::text),
    ('Rescue', 'Rescue Boat',      '["Engine start","Fuel level","Life vests","Paddles","Hull"]'::text),
    ('Rescue', 'Extrication Tools', '["Hydraulic pump","Cutter","Spreader","Ram","Hoses"]'::text),
    ('Rescue', 'Rope and Rappel Set', '["Rope integrity","Carabiners","Harnesses","Descenders","Anchors"]'::text),
    ('Rescue', 'Stretcher',        '["Straps","Frame","Wheels","Cleanliness"]'::text),
    ('Rescue', 'First-Aid Kit',    '["Bandages","Antiseptics","Medicines list","Triage tags"]'::text),
    ('Hospital', 'Ambulance',      '["Fuel level","Tyres","Stretcher","Oxygen tank","Defibrillator"]'::text),
    ('Hospital', 'ER Beds',        '["Available count","Bedding","Monitors","Oxygen outlets"]'::text),
    ('Hospital', 'ICU Beds',       '["Available count","Ventilators","Monitors","Power"]'::text),
    ('Hospital', 'Oxygen',         '["Cylinder count","Pressure","Backup supply","Flow meters"]'::text),
    ('Hospital', 'Blood Supply',   '["A+","A-","B+","B-","AB+","AB-","O+","O-","Storage temp"]'::text),
    ('Barangay', 'Boat',           '["Hull","Paddles","Life vests","Rope"]'::text),
    ('Barangay', 'Rope',           '["Length","Knot integrity","Cleanliness"]'::text),
    ('Barangay', 'Stretcher',      '["Frame","Straps","Wheels"]'::text),
    ('Barangay', 'Radio',           '["Battery","Channel","Speaker","Antenna"]'::text),
    ('Barangay', 'First-Aid Kit',   '["Bandages","Antiseptics","Medicines list","Triage tags"]'::text)
  ) as v(unit_type, label, checklist)
on conflict (unit_type, label) do nothing;

-- --------------------------------------------------------------- dispatch_units
-- SAMPLE units — one per type. Replace these with the real MDRRMO partner
-- units, contact numbers and coordinates before going live.
insert into public.dispatch_units (name, unit_type, contact_number, address, lat, lng, status, active)
select v.name, v.unit_type, v.contact_number, v.address, v.lat, v.lng, 'available', true
  from (values
    ('Lingayen BFP',         'BFP',      '(075) 632-2333',  'Poblacion, Lingayen',                 16.0220, 120.2306),
    ('Lingayen PNP',         'PNP',      '0998-598-5391',   'Capitol Compound, Lingayen',          16.0226, 120.2288),
    ('Lingayen Rescue Unit', 'Rescue',   '(075) 632-2222',  'MDRRMO Office, Lingayen',             16.0220, 120.2306),
    ('Lingayen District Hospital', 'Hospital', '(075) 632-2121', 'Maramba Boulevard, Lingayen', 16.0240, 120.2310)
  ) as v(name, unit_type, contact_number, address, lat, lng)
on conflict (id) do nothing;

-- add a unique name index so the above conflict clause works on re-run
do $$
begin
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public' and tablename = 'dispatch_units'
       and indexname = 'dispatch_units_name_key'
  ) then
    create unique index dispatch_units_name_key on public.dispatch_units (name);
  end if;
end $$;

-- re-run the insert now that the unique name index exists
insert into public.dispatch_units (name, unit_type, contact_number, address, lat, lng, status, active)
select v.name, v.unit_type, v.contact_number, v.address, v.lat, v.lng, 'available', true
  from (values
    ('Lingayen BFP',         'BFP',      '(075) 632-2333',  'Poblacion, Lingayen',                 16.0220, 120.2306),
    ('Lingayen PNP',         'PNP',      '0998-598-5391',   'Capitol Compound, Lingayen',          16.0226, 120.2288),
    ('Lingayen Rescue Unit', 'Rescue',   '(075) 632-2222',  'MDRRMO Office, Lingayen',             16.0220, 120.2306),
    ('Lingayen District Hospital', 'Hospital', '(075) 632-2121', 'Maramba Boulevard, Lingayen', 16.0240, 120.2310)
  ) as v(name, unit_type, contact_number, address, lat, lng)
on conflict (name) do nothing;

-- ------------------------------------------------------------ hospital_capacity
-- SAMPLE: each hospital starts with a reasonable capacity. Verify with the
-- hospital nursing office before relying on these figures.
insert into public.hospital_capacity (unit_id, er_beds, icu_beds, available, accepting, updated_at)
select u.id, 12, 4, 5, true, now()
  from public.dispatch_units u
 where u.unit_type = 'Hospital'
   and not exists (select 1 from public.hospital_capacity h where h.unit_id = u.id)
on conflict (unit_id) do nothing;

-- ------------------------------------------------------------ hotlines.category backfill
-- Make sure every existing hotline has a category. The migration 038 already
-- runs this once, but seed 001_sample_data.sql may have added rows after the
-- migration applied; do it again here.
update public.emergency_hotlines set category = 'BFP'              where category = 'Other' and lower(agency_name) like '%bfp%';
update public.emergency_hotlines set category = 'PNP'              where category = 'Other' and lower(agency_name) like '%pnp%';
update public.emergency_hotlines set category = 'Rescue Unit'      where category = 'Other' and (lower(agency_name) like '%rescue%' or lower(agency_name) like '%mdrrmo%');
update public.emergency_hotlines set category = 'Hospital'         where category = 'Other' and lower(agency_name) like '%hospital%';
update public.emergency_hotlines set category = 'Barangay Captain' where category = 'Other' and (lower(agency_name) like '%captain%' or lower(agency_name) like '%barangay%');
update public.emergency_hotlines set category = 'MDRRMO'           where category = 'Other' and (lower(agency_name) like '%mdrrmo%' or lower(agency_name) like '%ldrrmc%');

-- ------------------------------------------------------------- barangay captain
-- SAMPLE captain names and numbers. ALL PLACEHOLDERS — verify with the
-- municipal DILG office before publishing.
update public.barangays set captain_name = 'Kgg. Juan Dela Cruz',  captain_phone = '0917-000-0001' where name = 'Poblacion'              and coalesce(captain_name, '') = '';
update public.barangays set captain_name = 'Kgg. Maria Santos',    captain_phone = '0917-000-0002' where name = 'Aliwekwek'             and coalesce(captain_name, '') = '';
update public.barangays set captain_name = 'Kgg. Pedro Reyes',     captain_phone = '0917-000-0003' where name = 'Baay'                  and coalesce(captain_name, '') = '';
update public.barangays set captain_name = 'Kgg. Ana Lim',         captain_phone = '0917-000-0004' where name = 'Bantayan'              and coalesce(captain_name, '') = '';
update public.barangays set captain_name = 'Kgg. Jose Garcia',     captain_phone = '0917-000-0005' where name = 'Dorongan'              and coalesce(captain_name, '') = '';

-- ------------------------------------------------------------- one equipment row per unit (sample)
-- SAMPLE: one starter piece of equipment per unit so the dispatch picker
-- has something to show. The real data will be entered by each unit admin
-- through the readiness board.
insert into public.dispatch_equipment (owner_unit_id, owner_barangay_id, catalog_id, custom_label, identifier, status, condition, last_checked_at, notes)
select u.id, null, c.id, '', v.identifier, 'available', 'ready', now(), 'Sample seed row — verify'
  from (values
    ('Lingayen BFP',              'LFP-FT-01',         'Fire Truck'),
    ('Lingayen PNP',              'LGP-PC-01',         'Patrol Car'),
    ('Lingayen Rescue Unit',      'LRS-RB-01',         'Rescue Boat'),
    ('Lingayen District Hospital','LDH-AMB-01',        'Ambulance')
  ) as v(unit_name, identifier, label)
  join public.dispatch_units u on u.name = v.unit_name
  join public.equipment_catalog c on c.unit_type = u.unit_type and c.label = v.label
 where not exists (
   select 1 from public.dispatch_equipment de
    where de.owner_unit_id = u.id and coalesce(de.identifier, '') = v.identifier
 );

-- one starter boat per barangay captain's barangay (sample, for the Response Team)
insert into public.dispatch_equipment (owner_unit_id, owner_barangay_id, catalog_id, custom_label, identifier, status, condition, last_checked_at, notes)
select null, b.id, c.id, '', 'BRGY-' || upper(left(regexp_replace(b.name, '[^A-Za-z]', '', 'g'), 3)) || '-BOAT', 'available', 'ready', now(), 'Sample seed row — verify'
  from public.barangays b
  join public.equipment_catalog c on c.unit_type = 'Barangay' and c.label = 'Boat'
 where not exists (
   select 1 from public.dispatch_equipment de
    where de.owner_barangay_id = b.id and de.catalog_id = c.id
 );
