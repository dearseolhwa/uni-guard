-- ============================================================================
--  UniGuard · 054 · Equipment categories + BFP equipment catalog
--
--  PROBLEM
--    The only catalog rows in production are the five Barangay items from
--    migration 049. Every other row lives in seed/003_dispatch_units.sql,
--    which was never run, so a BFP unit admin's Add-equipment form offered
--    nothing but "Other (custom)". Every BFP item became free text: no
--    shared label for the LDRRMO inventory and no readiness checklist.
--
--  CHANGES
--    a) equipment_catalog.category (text, default 'General').
--    b) Existing rows grouped by label (every unit_type except Barangay,
--       which stays one 'General' list).
--    c) The BFP catalog (28 rows) with a 3-5 item readiness checklist each.
--       ON CONFLICT (unit_type, label) only updates category, so any
--       checklist already in the table is kept.
--
--  The add_equipment RPC (050) is unchanged: it still validates catalog_id
--  against the owner's unit_type and never reads category.
--
--  Safe to re-run.
-- ============================================================================

-- a) ------------------------------------------------------------ the column
alter table public.equipment_catalog
  add column if not exists category text not null default 'General';

-- The ON CONFLICT below needs the (unit_type, label) unique index. 049 and
-- seed/003 create it; repeat the guard so this file also runs on its own.
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

-- b) ------------------------------------------------- group the existing rows
-- Barangay rows are left 'General' on purpose: the barangay form stays a
-- single Type list (the Category field hides when there is one category).
update public.equipment_catalog set category = 'Vehicles'
 where label in ('Fire Truck','Water Tanker','Aerial Ladder','Patrol Car','Ambulance','Rescue Boat')
   and unit_type <> 'Barangay'
   and category is distinct from 'Vehicles';

update public.equipment_catalog set category = 'Communications'
 where label in ('Radio','Radios','Megaphone')
   and unit_type <> 'Barangay'
   and category is distinct from 'Communications';

update public.equipment_catalog set category = 'Protective gear'
 where label in ('Breathing Apparatus (SCBA)')
   and unit_type <> 'Barangay'
   and category is distinct from 'Protective gear';

update public.equipment_catalog set category = 'Rescue equipment'
 where label in ('Stretcher','First-Aid Kit','Extrication Tools','Rope and Rappel Set')
   and unit_type <> 'Barangay'
   and category is distinct from 'Rescue equipment';

-- c) ----------------------------------------------------------- BFP catalog
-- Labels Fire Truck, Water Tanker, Aerial Ladder, Breathing Apparatus (SCBA)
-- and Hose Set match seed/003 exactly, so a later seed run does not
-- duplicate them.
insert into public.equipment_catalog (unit_type, label, category, checklist)
select v.unit_type, v.label, v.category, v.checklist::jsonb
  from (values
    -- Vehicles
    ('BFP', 'Fire Truck',                 'Vehicles', '["Water level","Hose condition","Pump test","Fuel level","Engine start"]'::text),
    ('BFP', 'Water Tanker',               'Vehicles', '["Water volume","Valve operation","Hose connection","Fuel level"]'::text),
    ('BFP', 'Aerial Ladder',              'Vehicles', '["Hydraulic test","Ladder extension","Stabilisers","Controls"]'::text),
    ('BFP', 'Rescue Truck',               'Vehicles', '["Fuel level","Engine start","Tool compartments","Lights and siren","Winch"]'::text),
    ('BFP', 'Ambulance',                  'Vehicles', '["Fuel level","Tyres","Stretcher","Oxygen tank","Lights and siren"]'::text),
    ('BFP', 'Command Vehicle',            'Vehicles', '["Fuel level","Engine start","Radio","Lights and siren"]'::text),
    ('BFP', 'Rescue Boat',                'Vehicles', '["Engine start","Fuel level","Life vests","Paddles","Hull"]'::text),
    -- Firefighting equipment
    ('BFP', 'Portable Pump',              'Firefighting equipment', '["Fuel level","Start test","Suction hose","Priming"]'::text),
    ('BFP', 'Hose Set',                   'Firefighting equipment', '["Nozzles","Couplings","Pressure test","Length"]'::text),
    ('BFP', 'Nozzle',                     'Firefighting equipment', '["Spray pattern","Shut-off valve","Threads","Gasket"]'::text),
    ('BFP', 'Fire Extinguisher',          'Firefighting equipment', '["Pressure gauge","Safety pin and seal","Hose and nozzle","Inspection tag"]'::text),
    ('BFP', 'Foam Unit',                  'Firefighting equipment', '["Foam concentrate level","Eductor","Pick-up tube","Nozzle"]'::text),
    ('BFP', 'Generator',                  'Firefighting equipment', '["Fuel level","Oil level","Start test","Output V"]'::text),
    ('BFP', 'Floodlight',                 'Firefighting equipment', '["Lamp test","Cables","Stand","Power source"]'::text),
    -- Protective gear
    ('BFP', 'Firefighting Suit',          'Protective gear', '["Count","Tears and burns","Reflective strips","Closures"]'::text),
    ('BFP', 'Helmet',                     'Protective gear', '["Count","Shell cracks","Visor","Chin strap"]'::text),
    ('BFP', 'Breathing Apparatus (SCBA)', 'Protective gear', '["Cylinder pressure","Face mask seal","Regulator","Airflow"]'::text),
    ('BFP', 'Boots and Gloves',           'Protective gear', '["Count and sizes","Soles","Tears","Dryness"]'::text),
    -- Rescue equipment
    ('BFP', 'Hydraulic Rescue Tool',      'Rescue equipment', '["Hydraulic pump","Cutter","Spreader","Hoses","Fluid level"]'::text),
    ('BFP', 'Chainsaw',                   'Rescue equipment', '["Fuel mix","Chain tension","Chain brake","Start test"]'::text),
    ('BFP', 'Rope and Rappel Set',        'Rescue equipment', '["Rope integrity","Carabiners","Harnesses","Descenders","Anchors"]'::text),
    ('BFP', 'Stretcher',                  'Rescue equipment', '["Straps","Frame","Wheels","Cleanliness"]'::text),
    ('BFP', 'Life Vest',                  'Rescue equipment', '["Count","Buckles","Straps","Tear check"]'::text),
    ('BFP', 'Thermal Imaging Camera',     'Rescue equipment', '["Battery","Power-on test","Lens","Display"]'::text),
    ('BFP', 'First-Aid Kit',              'Rescue equipment', '["Bandages","Antiseptics","Medicines list","Triage tags"]'::text),
    -- Communications
    ('BFP', 'Handheld Radio',             'Communications', '["Battery","Channel scan","Antenna","Speaker"]'::text),
    ('BFP', 'Base Radio',                 'Communications', '["Power","Channel scan","Antenna","Backup battery"]'::text),
    ('BFP', 'Megaphone',                  'Communications', '["Battery","Volume test","Microphone","Siren"]'::text)
  ) as v(unit_type, label, category, checklist)
on conflict (unit_type, label) do update set category = excluded.category;
