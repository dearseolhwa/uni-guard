-- ============================================================================
--  093 · LGU staff manage the official hotline directory
-- ============================================================================
--  Migration 046 limited direct writes to emergency_hotlines to the Super
--  Admin; LGU staff had to file a change request like barangay officials.
--  The LDRRMO now maintains the directory itself: every LGU account
--  (role lgu_ldrrmc, which includes the Super Admin) can add, edit and delete
--  hotlines directly. Barangay officials still submit change requests for the
--  Super Admin to review (submit_change_request / approve_change_request are
--  unchanged). Every direct change is still written to the audit log by the
--  audit_row_change trigger from migration 033.
-- ============================================================================

drop policy if exists hotlines_write on public.emergency_hotlines;
create policy hotlines_write on public.emergency_hotlines
  for all to authenticated
  using (public.is_lgu())
  with check (public.is_lgu());

comment on policy hotlines_write on public.emergency_hotlines is
  'LGU staff (role lgu_ldrrmc, including the Super Admin) add, edit and delete official hotlines directly. Barangay officials submit a change_request for Super Admin review (migration 046).';
