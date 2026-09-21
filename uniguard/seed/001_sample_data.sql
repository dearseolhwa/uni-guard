-- ============================================================================
--  UniGuard · SAMPLE DATA  ·  DO NOT RUN IN PRODUCTION UNCHANGED
--
--  The barangays, hotlines and evacuation centres below are placeholders taken
--  from the design prototype. Every number, address and capacity is invented.
--  Verify each entry against the official Dagupan City / LDRRMC records before
--  production use, then delete anything that is wrong.
--
--  Safe to re-run: everything is guarded by ON CONFLICT DO NOTHING.
-- ============================================================================

-- --------------------------------------------------------------- barangays
-- SAMPLE: verify the official barangay list with the city planning office.
insert into public.barangays (name, city) values
  ('Bonuan Gueset', 'Dagupan City'),
  ('Bonuan Boquig', 'Dagupan City'),
  ('Tapuac',        'Dagupan City'),
  ('Poblacion',     'Dagupan City'),
  ('Lucao',         'Dagupan City'),
  ('Calmay',        'Dagupan City'),
  ('Tambac',        'Dagupan City')
on conflict (name) do nothing;

-- --------------------------------------------------------------- hotlines
-- SAMPLE: verify every number with the agency before publishing.
insert into public.emergency_hotlines (agency_name, contact_number, scope, description)
select v.agency_name, v.contact_number, v.scope, v.description
  from (values
    ('Dagupan City DRRMO',        '(075) 523-8181', 'Citywide',           'City disaster risk reduction and management office'),
    ('Bureau of Fire Protection', '(075) 522-3333', 'Fire and rescue',    'Fire and rescue response'),
    ('PNP Dagupan City',          '0998-598-5391',  'Police assistance',  'Police emergency line'),
    ('Philippine Coast Guard',    '(075) 542-6377', 'Coastal rescue',     'Coastal and water rescue'),
    ('Red Cross Dagupan',         '(075) 522-2133', 'Medical and relief', 'Medical assistance and relief goods'),
    ('Bonuan Gueset Barangay Desk', '0917-408-2210', 'Barangay hotline', 'Barangay emergency desk')
  ) as v(agency_name, contact_number, scope, description)
 where not exists (
   select 1 from public.emergency_hotlines h where h.agency_name = v.agency_name
 );

-- ------------------------------------------------------- evacuation centres
-- SAMPLE: verify names, addresses and real capacities with the city.
insert into public.evacuation_centers (name, barangay, barangay_id, address, capacity, occupancy, status, note, lat, lng)
select v.name, v.barangay, b.id, v.address, v.capacity, v.occupancy, v.status, v.note, v.lat, v.lng
  from (values
    ('Bonuan Gueset Covered Court', 'Bonuan Gueset', 'Riverside Road',  250, 118, 'open',   'Priority for riverside households', 16.0433, 120.3331),
    ('Dagupan City Astrodome',      'Tapuac',        'Tapuac District', 620, 620, 'full',   'No remaining slots',                16.0360, 120.3410),
    ('Lucao Elementary School',     'Lucao',         'Lucao Road',      300,  84, 'open',   'Medical station on site',           16.0250, 120.3290),
    ('Poblacion Barangay Hall',     'Poblacion',     'Poblacion',        90,   0, 'closed', 'Undergoing roof repair',            16.0420, 120.3390),
    ('Calmay National High School', 'Calmay',        'Calmay Riverside', 400, 210, 'open',  'Pet friendly area available',       16.0480, 120.3180)
  ) as v(name, barangay, address, capacity, occupancy, status, note, lat, lng)
  left join public.barangays b on b.name = v.barangay
 where not exists (select 1 from public.evacuation_centers e where e.name = v.name);

-- ------------------------------------------------------------- advisories
-- SAMPLE: written for the design prototype, not approved public messaging.
insert into public.advisories (title, body, severity, kind, affected_area, citywide, published_at)
select v.title, v.body, v.severity, v.kind, v.affected_area, v.citywide, v.published_at
  from (values
    ('River Overflow Warning: Bonuan Gueset',
     'The river has breached the first flood marker along the riverside. Residents within 200 m of the bank must prepare to move to the Bonuan Gueset Covered Court.',
     'emergency', 'emergency', 'Bonuan Gueset, Bonuan Boquig', false, now() - interval '12 minutes'),
    ('Suspension of Classes, All Levels',
     'The City Disaster Risk Reduction and Management Office has suspended classes at all levels for today.',
     'warning', 'emergency', 'Citywide', true, now() - interval '1 hour'),
    ('Coastal Advisory: Storm Surge Watch',
     'A storm surge watch is in effect for coastal barangays. Small sea vessels are prohibited from sailing.',
     'advisory', 'emergency', 'Coastal barangays', true, now() - interval '3 hours'),
    ('Preparedness Drill: Duck, Cover, Hold',
     'A citywide earthquake drill will run at 9:00 AM this Friday. Households, schools and offices are encouraged to join.',
     'prepared', 'preparedness', 'Citywide', true, now() - interval '2 days'),
    ('Go-Bag Checklist for the Wet Season',
     'Keep a go-bag ready: three days of water and non-perishable food, flashlight, batteries, first-aid kit, whistle, copies of documents and a power bank.',
     'prepared', 'preparedness', 'Citywide', true, now() - interval '4 days')
  ) as v(title, body, severity, kind, affected_area, citywide, published_at)
 where not exists (select 1 from public.advisories a where a.title = v.title);

-- target the barangay scoped advisory at its barangays
insert into public.advisory_targets (advisory_id, barangay_id)
select a.id, b.id
  from public.advisories a
  join public.barangays b on b.name in ('Bonuan Gueset', 'Bonuan Boquig')
 where a.title = 'River Overflow Warning: Bonuan Gueset'
on conflict do nothing;

-- No sample reports or accounts are seeded. Reports need a real auth user, and
-- the brief requires that no demo accounts exist anywhere in the system.
