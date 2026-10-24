# Manual test checklist

Per-role checks for the whole system. Phase 1 (schema) is also covered in
`TEST-CHECKLIST-PHASE-1.md` with SQL level detail. Everything here is done through
the interface unless a step says otherwise.

**Accounts you need first**

| Role | How to create it |
|---|---|
| Resident | create it yourself from the app |
| Barangay official | as LGU: Users → Create Official, then set the role and barangay |
| LGU / LDRRMC | promote a trusted account once, directly in `public.profiles`, then use the app |

---

## 1. Accounts and access — every role

| # | Step | Expected |
|---|---|---|
| 1.1 | Open the app signed out | Sign In screen: email, password, Sign In, Create Account, Forgot Password. No prefilled values, no demo accounts. |
| 1.2 | Press Enter in the password field | the form submits |
| 1.3 | Toggle the eye icon on the password field | the value is revealed and hidden again |
| 1.4 | Sign in with a wrong password | inline "That email and password do not match an account." No navigation. |
| 1.5 | Sign in with an unconfirmed email | inline "Confirm your email address first." |
| 1.6 | Disable an account as LGU, then sign in as it | inline "This account has been disabled." |
| 1.7 | Turn off the network, then sign in | inline "No connection to the server." |
| 1.8 | Reload while signed in | the session persists, you land back on your home screen |
| 1.9 | Sign out | back to Sign In, and a reload stays signed out |

## 2. Create account

| # | Step | Expected |
|---|---|---|
| 2.1 | Create Account → submit empty | field level errors, nothing is sent |
| 2.2 | Enter `0917123` as the mobile number | "Use a Philippine mobile number, for example 0917 123 4567." |
| 2.3 | Enter `0917 123 4567` | accepted, and stored normalised as `09171234567` |
| 2.4 | Leave the barangay unselected | "Select your barangay." |
| 2.5 | Enter a 6 character password | "Use at least 8 characters." |
| 2.6 | Mismatch password and confirm | "The two passwords do not match." |
| 2.7 | Submit without ticking consent | "Consent to the Privacy Notice is required." |
| 2.8 | Open the Privacy Notice link | the notice opens, with the Data Privacy Act text |
| 2.9 | Submit a valid form | "Check Your Email to Confirm Your Account", with Resend Email |
| 2.10 | Press Resend Email | confirmation, and a second email arrives |
| 2.11 | In the database, check the new profile | `role = 'citizen'`, never official, whatever was submitted |
| 2.12 | Try to force a role by editing the request | still `citizen`: the trigger forces it |

## 3. Forgot and reset password

| # | Step | Expected |
|---|---|---|
| 3.1 | Forgot Password → submit a registered email | "If an account exists …, a reset link has been sent." |
| 3.2 | Submit an **un**registered email | exactly the same message. No hint either way. |
| 3.3 | Submit an empty email | "Enter the email address on your account." |
| 3.4 | Open the reset link from the email | the app opens on Set a New Password |
| 3.5 | Set a weak or mismatched password | inline error |
| 3.6 | Set a valid password | "Password updated", you are returned to Sign In, and the new password works |
| 3.7 | Try the reset link a second time | it is refused as expired; request a new one |

---

## 4. Resident — mobile

| # | Step | Expected |
|---|---|---|
| 4.1 | Sign in | home screen for your barangay, bottom navigation |
| 4.2 | Check the three readouts | active incidents and open shelters match the data |
| 4.3 | Open Advisories, filter by Preparedness | only preparedness posts remain |
| 4.4 | Open an advisory | severity, affected area, published time, what to do now |
| 4.5 | Save Offline | confirmation toast |
| 4.6 | Share | the native share sheet, or "Link copied" |
| 4.7 | Open Shelters, filter by Full | only full centres, with occupancy bars |
| 4.8 | Directions on a centre | OpenStreetMap directions open in a new tab |
| 4.9 | Open Hotlines, press Call | the dialler opens with the number |
| 4.10 | Look at the bottom navigation on the Report screen | still visible, nothing is covered |

## 5. Resident — report a hazard

| # | Step | Expected |
|---|---|---|
| 5.1 | Report a Hazard → submit with an empty description | "Add a short description before submitting" |
| 5.2 | Acquire GPS, allow the prompt | coordinates and accuracy appear |
| 5.3 | Acquire GPS, deny the prompt | a manual coordinate prompt appears instead |
| 5.4 | Attach a 4 MB phone photo | it is compressed, the size is reported, and the file name shows |
| 5.5 | Attach a PDF renamed to `.jpg` | rejected as unreadable |
| 5.6 | Check the report preview | your barangay is preselected and cannot be changed to another |
| 5.7 | Submit | a `UG-YYYY-NNNN` code appears, status Reported |
| 5.8 | Turn off the network, then submit another | "Saved on this device. It uploads when you are back online." |
| 5.9 | Turn the network back on | the banner offers Upload now, and the queued report appears |
| 5.10 | Submit six reports in ten minutes | the sixth is refused with a rate limit message |
| 5.11 | Open My Reports | your reports only, newest first, with relative times |
| 5.12 | Open a report | photo, description, tracking pipeline, corroboration meter |

## 6. Corroboration

| # | Step | Expected |
|---|---|---|
| 6.1 | As the reporter, open your own report | no way to corroborate your own report |
| 6.2 | As another resident in the same barangay | Confirm this hazard is still there succeeds |
| 6.3 | Reach three distinct people in six hours | the report becomes Verified by itself, and a history row has `reason = auto_corroboration` |
| 6.4 | Repeat with the third confirmation more than six hours later | the report stays Reported |
| 6.5 | Try to corroborate the same report twice | the second attempt is refused |

---

## 7. Barangay official

| # | Step | Expected |
|---|---|---|
| 7.1 | Sign in | the command console, scoped to your barangay |
| 7.2 | Dashboard | KPI figures and the incident list cover your barangay only |
| 7.3 | Incident queue | only your barangay; the scope label says so |
| 7.4 | Advance a report | confirm dialog, then Reported → Verified → Dispatched → Resolved |
| 7.5 | Try an illegal jump (Reported → Resolved) | offered only through the legal path |
| 7.6 | Open the incident, check Activity Log | every change is listed with its actor and time |
| 7.7 | Shelters → set a centre to Full | the badge and the resident view update |
| 7.8 | Add an Evacuation Center | it appears in the list and in the resident app |
| 7.9 | Try to edit a hotline | the screen offers no hotline editing, and the API refuses it |
| 7.10 | Try to open Users or Audit Log | the entries are absent from the navigation |
| 7.11 | Resize the window to phone width | the sidebar collapses to an icon rail and the console stays usable |
| 7.12 | Load the responder roster, then assign a unit | the assignment count on the incident increases |

## 8. LGU / LDRRMC

| # | Step | Expected |
|---|---|---|
| 8.1 | Sign in | console, citywide scope |
| 8.2 | Dashboard | every barangay's incidents; the map shows markers by severity |
| 8.3 | Click a map marker | it opens that incident |
| 8.4 | Hover a marker | a popup with code, barangay, status and corroboration count |
| 8.5 | Advisories → compose → Publish | confirm dialog, then it appears in the published list |
| 8.6 | Publish an advisory targeted at one barangay | only that barangay's residents are notified |
| 8.7 | Declare Emergency | confirm dialog showing the real subscribed device count, not a fixed number |
| 8.8 | After declaring, check the audit log | an `emergency.declared` row with the device count |
| 8.9 | Users → Create Official | an invitation email is sent |
| 8.10 | Change a user's role | the change takes effect on their next sign in |
| 8.11 | Assign a barangay | the official's scope changes to that barangay |
| 8.12 | Disable an account | that account can no longer sign in |
| 8.13 | Try to disable your own account | refused |
| 8.14 | Audit Log | role changes, declarations and directory edits are listed newest first |
| 8.15 | Export CSV on Users, Audit and Analytics | three well formed CSV files |
| 8.16 | Hotlines → add, edit, verify | each change is saved and appears in the resident app |
| 8.17 | Analytics | figures come from the SQL views; the 14 day trend reflects real reports |

---

## 9. Offline and PWA

| # | Step | Expected |
|---|---|---|
| 9.1 | Load the app once online | DevTools shows the service worker activated and the shell cached |
| 9.2 | Turn off the network and reload | the app opens, with the offline banner |
| 9.3 | Open Hotlines and Shelters offline | both render from the cache |
| 9.4 | Open a critical advisory offline | it renders from the cache |
| 9.5 | Try to open the map offline | the built in map is shown, no empty panel |
| 9.6 | Submit a report offline | it is queued, and the banner counts it |
| 9.7 | Restore the network | the queue uploads without a reload |
| 9.8 | Install the app from the browser | it opens standalone, with the shield icon |
| 9.9 | Enable notifications from the app | permission prompt, then the device is counted in Declare Emergency |
| 9.10 | Publish an emergency as LGU | the installed app receives a notification, tapping it opens the advisory |

## 10. Security, one pass per role

| # | Step | Expected |
|---|---|---|
| 10.1 | As a resident, request another resident's report id directly | refused |
| 10.2 | As a resident, request the `profiles` table | only your own row |
| 10.3 | As a resident, read `audit_log` | empty |
| 10.4 | As an official, request a report from another barangay | refused |
| 10.5 | As an official, call `admin_set_user_role` | refused |
| 10.6 | As anyone, try to change your own role | refused |
| 10.7 | As a resident, upload a photo into another user's folder | refused |
| 10.8 | As a resident, upload a PDF to the reports bucket | refused |
| 10.9 | Run `docs/RLS-TEST.sql` | every assertion passes |
| 10.10 | Inspect any response in DevTools | no reporter identity leaks to a resident |

## 11. Accessibility and layout

| # | Step | Expected |
|---|---|---|
| 11.1 | Tab through the sign in form | visible focus rings, logical order |
| 11.2 | Tab to a button and press Enter | it activates |
| 11.3 | Open a dialog and press Escape | it closes |
| 11.4 | Zoom to 200% | no clipped text, no horizontal scrolling |
| 11.5 | Narrow to 360 px | nothing overlaps; the console uses the icon rail |
| 11.6 | Read the app with a screen reader | the dialogs announce their title and the toasts are announced |
| 11.7 | Turn on reduced motion | animations collapse, nothing is lost |

---

## 20. Status flow and labels (updated)

| # | Step | Expected |
|---|---|---|
| 20.1 | Read any status badge, filter chip, pipeline or log | labels read Reported / Verified / Response Dispatched / Resolved / Rejected — "Pending" and "In Progress" appear nowhere |
| 20.2 | As an official: Verify → Dispatch → Resolve an incident | each action moves exactly one step; the confirm dialog names the target step |
| 20.3 | Try to skip a step via a direct REST call (`PATCH /rest/v1/reports`) | the database rejects it — one step at a time, for every role including LGU |
| 20.4 | Try to reopen a resolved or rejected incident | rejected by the database; the states are final |
| 20.5 | As LGU, try to jump a fresh report straight to Resolved | rejected: LGU follows the same strict flow |

## 21. Location and barangay routing (updated)

| # | Step | Expected |
|---|---|---|
| 21.1 | Open the report form with location denied | a plain explanation appears and the map pin is offered as the fallback |
| 21.2 | Try to submit with no pin | blocked: "A location is required…" |
| 21.3 | Go offline, try to queue a report without coordinates | blocked in the queue path too |
| 21.4 | Drop a pin inside another barangay and submit | the toast and the report detail show THAT barangay received the report; the server derived it from the coordinates |
| 21.5 | Enter coordinates from outside Lingayen via the typed fallback | rejected: outside the municipality |

## 22. Citizen edit window (updated)

| # | Step | Expected |
|---|---|---|
| 22.1 | File a report, open it, press Edit this report | the edit form loads the saved values within 15 minutes |
| 22.2 | Change the description and severity, save | the change is saved and an audit row `report.self_edited` appears (LGU audit log) |
| 22.3 | Wait past 15 minutes, reopen | the Edit control is replaced by an explanation; the window is enforced again by the database |
| 22.4 | Via REST, try to change `status` inside the window | rejected by `guard_report_edit` |

## 23. Scoping (official = own barangay only)

| # | Step | Expected |
|---|---|---|
| 23.1 | Official SOS log | only SOS entries from the official's barangay; LGU sees all |
| 23.2 | Official road status: add/edit in another barangay via REST | rejected by policy |
| 23.3 | Official publishes an advisory | area is locked to their barangay; municipality-wide publish is rejected (REST too) |
| 23.4 | Official analytics | numbers cover only their barangay; citizen gets zero rows everywhere |
| 23.5 | SOS acknowledge/resolve from the detail view | the sender receives a notification; the change is audited |

## 24. Exports and analytics (updated)

| # | Step | Expected |
|---|---|---|
| 24.1 | Export hotlines / analytics / users / audit log | every export is a formatted PDF with title, date/time, generated-by, scope and page numbers |
| 24.2 | Look for any CSV export | none remain |
| 24.3 | Set an analytics date range, Apply range | the stat cards, trend, response times and barangay panel all reflect the range |
| 24.4 | Export the analytics PDF | the export states the same date range and scope on its cover |

## 25. Layout and dead controls (updated)

| # | Step | Expected |
|---|---|---|
| 25.1 | Citizen portal at 1280 / 1366 / 1440 px, 100% zoom | SOS, user menu and Sign Out visible, no horizontal scroll; secondary items live in the More dropdown |
| 25.2 | Console drawer on a short viewport (1280×640) | Sign Out, Force Refresh and Offline Sync are reachable without zooming out |
| 25.3 | Map "My Location" control | aligned with the other map controls; works by touch; drops an accuracy circle |
| 25.4 | Walk every citizen + console control | nothing is dead; Priority Sort toggles, Command View opens/exits, hotline Verify is gone |


## 26. Fix Pack 01 (tester findings, Oct 23 2026)

Run migration `048_fixpack_01.sql` and set `APP_PUBLIC_URL` to the deployed https
URL first. Test on a real phone against the deployed URL, not `127.0.0.1`.

| # | Role | Step | Expected |
|---|---|---|---|
| F1 | Resident (new) | Create an account on the deployed URL, open the confirmation email on a phone, tap the link | The app opens (no connection error) with "Your email is confirmed. You can now sign in." Open an already-used link: "This confirmation link has expired or was already used…" plus a "Request a new link" button. Forgot Password → link still opens the set-new-password screen. |
| F2 | LGU / Barangay official | Advisories → compose → Delivery **Push notification** → Publish; repeat with **In-app only** | Both publish without a schema-cache error. Push calls `push-dispatch` (Edge Function logs); In-app only does not, but still appears in the residents' inbox. |
| F3 | Super Admin | Dispatch Units → on a row press Edit, Account, Delete; then click elsewhere on the row | Edit opens the unit editor, Account opens the member roster, Delete asks for confirmation; the rest of the row opens the unit detail. |
| F4 | LGU / Barangay official / Resident | In pop-ups: hotline Request Change → Edit / Request deletion; shelter Edit Location / Edit; road status Edit; SOS Acknowledge / Mark resolved; inventory Restock / Edit | Each button runs its action and the pop-up closes; Esc and × still close pop-ups; nothing fires twice. Hotline requests show "Your request was sent to the Super Admin for review." A resident's road-status pop-up has no Edit button. |
| F5 | Resident | Settings → Notifications and Offline; Offline page. Then turn Wi-Fi off and press any network action (e.g. Refresh) | One "Alerts on this phone" card with status and "Turn on alerts"; no VAPID / service worker / cache / gateway wording. The toast reads "No internet connection. Check your signal and try again." |
| F6 | Any | Sign in → turn the network off → reload the page | Same account opens with the offline banner. Online reload also stays signed in. A disabled account is still signed out on the next online load. |
| F7 | Resident | Offline: tap SOS several times; then reconnect | One inline "Waiting for signal" status, no stacked toasts, "Call Lingayen MDRRMO" card shown above the SOS button and always tappable. On reconnect the SOS is delivered once, appears in the LGU SOS Log, and the resident sees "Your SOS was delivered to the MDRRMO." Only one offline banner (button "Try again"). |
| F8 | Barangay official / LGU | Open the Operations Dashboard | Barangay official: no Declare Emergency button. LGU: button present and works. |
| F9 | LGU | Dashboard → Recent Incidents; map pop-up | "No corroborations yet", "1 corroboration", "N corroborations". |
| F10 | LGU / Barangay official | Relief & Inventory → Active Distributions → View | Detail pop-up opens (schedule, contact with tap-to-call, eligibility, documents); Verify beneficiary and Edit inside it work. |
| F11 | Resident | Offline: submit a report → My Reports → Offline page → Reload app → reconnect | The report shows under "Reports waiting to send"; Reload app warns that it will be kept; it is still there after the reload; on reconnect it is sent and becomes a normal report with a code. |
| F12 | Resident (GPS outside Lingayen) / LGU | Open Report a Hazard; drag the pin; drag it outside the town. LGU: open an SOS sent from outside Lingayen | Pin appears in Lingayen with "Your current location is outside Lingayen…"; dragging works; dropping outside snaps back with "Pin must be inside Lingayen". The SOS detail map shows the real position; the page map returns after closing it. |
| F13 | Super Admin | Users | Lists every account (at least the Super Admin's own). A failing query shows the error panel with Try Again. |
| F14 | Super Admin | Edit a hotline, then open Activity Log | The edit appears. If the view from 045 is missing the log still loads from `audit_log`; if every source fails, the error panel shows. |

## 27. Dispatch Team Features (Oct 24 2026 — migration 049)

Run migration `049_dispatch_team_features.sql` after `048_fixpack_01.sql`.
Bumps `sw.js` to `uniguard-v13` so every client reloads the shell.

The 23 IDs A1..G1 below are tested per role. Every test is "log in as the
role, do the step, expect the result." Negative tests verify that scope
checks fire server-side (wrong unit, wrong barangay, wrong team action,
not-accepting hospital).

### A — Every team

| # | Role | Step | Expected |
|---|---|---|---|
| A1-BO | Barangay official | Response Team screen → open dispatch row → press "Can't respond" → enter a reason → confirm | The dispatch_status becomes `declined`; the LGU is notified ("pick another team"); the row's status badge turns red. |
| A1-LGU | LGU | Same flow as A1-BO on a Response Team dispatch in the LGU's barangay | Same outcome; the dispatcher's notification fires. |
| A1-BFP | BFP unit | Dispatch detail → status `sent` → press "Can't respond" → reason | Status becomes `declined`; the unit returns to Available (sync_unit_status treats `declined` as closed). |
| A1-PNP / Rescue / Hospital | PNP / Rescue / Hospital | Repeat the decline flow | Same outcome for each team. |
| A1-N1 | Other unit's user | Try to decline a dispatch owned by another unit | Rejected: "Only this unit's users may decline this dispatch". |
| A1-N2 | Other barangay's official | Try to decline a Response Team dispatch for another barangay's report | Rejected: "This dispatch is outside your barangay". |
| A1-N3 | Anyone | Try to decline a dispatch already in `on_scene` | Rejected: "A dispatch in 'on_scene' cannot be declined". |
| A2-Unit | BFP / PNP / Rescue unit | Dispatch detail → "Need help" → kind `water_tanker` (BFP) or `general` → message → send | A row appears in `dispatch_help_requests`; the LGU console shows it under "Dispatch help requests". |
| A2-BO | Barangay official | Same flow on a Response Team dispatch | Same outcome. |
| A2-LGU | LGU | Dispatch Units → "Dispatch help requests" → press Acknowledge then Resolve | The status moves `sent → acknowledged → resolved`; the requester is notified at each step. |
| A2-N1 | LGU | Try to move a resolved request back to acknowledged | Rejected: forward-only. |
| A2-N2 | Other unit's user | Read another unit's help request via REST | Empty result (RLS). |
| A3-BO | LGU / Barangay official | Open the dispatch form for a `fire` hazard | BFP and Barangay Response Team are listed first with "(Suggested)"; the others are below. All teams remain pickable. |
| A3-PNP | LGU | Open the form for a `vehicular_accident` hazard | PNP and Ambulance are suggested first. |
| A3-Other | LGU | Open the form for `other` | No team is marked suggested. |
| A4-BFP | BFP | After Done, file an after-action report with `families_displaced = 5, people_injured = 2` | The report is saved with those keys in `after_action_meta`; `equipment_used` and `times` are auto-prefilled. |
| A4-Rescue | Rescue | File an after-action report; the `people_assisted` field is prefilled from the rescue tally | The form submits; the meta only contains whitelisted keys. |
| A4-N1 | Any | Try to submit a meta with key `custom_field` for BFP | Rejected: "After-action key 'custom_field' is not allowed for team BFP". |

### B — Barangay Response Team

| # | Role | Step | Expected |
|---|---|---|---|
| B1-BO | Barangay official | Response Team screen → each open dispatch row has an inline roster picker → pick an available responder → Assign | The responder moves to On duty (sync_responder_duty trigger); the row shows the assignment. |
| B1-LGU | LGU | Same flow for any barangay | Same outcome. |
| B1-Release | Barangay official | Close the report (resolve) | Every assigned responder returns to Available (release_on_close). |
| B2-BO | Barangay official | On a flood Response Team dispatch, the field panel shows the static checklist (Warn low-lying households, …) | Ticking items and Save writes `field_data.checklist_done[]`. |
| B3-BO | Barangay official | Add an evacuation tally entry: pick a center from the Shelters list (this barangay first), enter people count | Save writes `field_data.evac_tally[]`; the after-action `people_assisted` is the sum. |
| B4-BO-ReDispatch | Barangay official | "Beyond capacity" → "Re-dispatch another team" | The existing dispatch form opens prefilled for the same incident; BFP/PNP/Rescue is pickable. |
| B4-BO-Help | Barangay official | "Beyond capacity" → "Send Need Help to the LGU" | A `dispatch_help_requests` row is created with kind `beyond_capacity`; the LGU is notified. |
| B5-Seed | Fresh install | Re-run seed/003_dispatch_units.sql | Life Vests, Sandbags, Flashlights, Megaphone, Generator appear in the Barangay catalog with their checklists. |

### C — Fire Station (BFP)

| # | Role | Step | Expected |
|---|---|---|---|
| C1-1 | BFP | On scene → press "Under control" | Status becomes `under_control`; the barangay, LGU and reporter are notified. |
| C1-2 | BFP | Under control → press "Fire out" | Status becomes `fire_out`; same fanout. |
| C1-3 | BFP | Fire out → Done | Done; equipment released. |
| C1-N1 | Rescue | Try to move a Rescue dispatch to `under_control` | Rejected: not allowed for Rescue team. |
| C2-1 | BFP | "Need help" → "Water tanker" | A help request of kind `water_tanker` is created; LGU is notified. |
| C2-2 | BFP | "Need help" → "Extra personnel" | A help request of kind `extra_personnel` is created. |
| C3-BFP | BFP | After-action form: enter `families_displaced` and `people_injured` | The keys are saved in `after_action_meta`. |

### D — Police (PNP)

| # | Role | Step | Expected |
|---|---|---|---|
| D1-Post | PNP | Dispatch detail → "Post closure" → road name + note + segment | A `road_status` row is created with status `blocked`, `dispatch_id` set, barangay_id from the report, `updater_name` from the session. |
| D1-Reopen | PNP | Press "Reopen" | The same road_status row moves to `passable`. |
| D1-N1 | LGU / Barangay official | Try to call `post_road_closure` directly via REST | Rejected: "Only a PNP unit member may post a road closure from a dispatch". |
| D1-N2 | Other PNP unit's user | Try to reopen another PNP unit's closure | Rejected: "You can only reopen a closure posted from your own unit's dispatch". |
| D2-Toggle | LGU / Barangay official | Shelters → Edit a center → tick "Flag this shelter as needing PNP patrol" → Save | `needs_patrol = true`, `needs_patrol_at = now()`; PNP's "Shelters needing patrol" list shows the center. |
| D2-Read | PNP | Open the Incoming Dispatches screen | A "Shelters needing patrol (D2)" section appears at the top with the flagged centers. |
| D3-Request | LGU / Barangay official | Relief & Inventory → request escort on a distribution | `escort_status = 'requested'`; every PNP unit's users are notified. |
| D3-Confirm | PNP | On the Incoming Dispatches screen → "Relief escorts (D3)" section → press "Confirm escort" | `escort_status = 'confirmed'`, `escort_unit_id` set to the PNP unit. |
| D3-N1 | Other unit | Try to call `confirm_relief_escort` as a non-PNP unit | Rejected: "Only a PNP unit may confirm an escort". |
| D3-N2 | Other unit | Try to call `request_relief_escort` as a non-LGU non-official | Rejected. |

### E — Rescue Unit

| # | Role | Step | Expected |
|---|---|---|---|
| E1-Save | Rescue | Dispatch detail → fill stranded count, location, special needs → Save field data | `field_data.rescue_details` is saved; the LGU can read it on the dispatch card. |
| E2-OnHold | Rescue | En route or On scene → enter a hold reason → press "On hold" | Status becomes `on_hold`; the LGU and barangay officials are notified; `hold_reason` is stored. |
| E2-Resume | Rescue | On hold → press "Resume" | Status becomes `on_scene`; `hold_reason` is cleared. |
| E2-N1 | Rescue | Try to go on_hold without a reason | Rejected: "A hold reason is required". |
| E3-Tally | Rescue | Fill rescued/injured/missing + pick destination hospital | `field_data.rescue_tally` saved with destinations; the after-action `people_assisted` prefilled. |
| E4-Send | Rescue | Press "Send patient notice" with a destination hospital chosen | `send_patient_notice` is called with the chosen hospital; the hospital's users are notified. |
| E4-N1 | Rescue | Try to send a notice to a hospital that is not accepting | Rejected: "That hospital is not accepting patients". |

### F — Hospital / Ambulance

| # | Role | Step | Expected |
|---|---|---|---|
| F1-Arrived | Hospital | Incoming patient notice → press "Arrived" | `status = 'arrived'` (only allowed from `sent` or `acknowledged`). |
| F1-Cancel | Hospital | Press "Cancel" | `status = 'cancelled'`. |
| F1-N1 | Hospital | Try to move an already-arrived notice back to acknowledged | Rejected: "A notice in 'arrived' cannot move to 'acknowledged'". |
| F2-Picker | Ambulance / Rescue | Open the dispatch detail's hospital picker | Only active Hospital units with `hospital_capacity.accepting = true` are listed. |
| F2-N1 | Anyone | Set a hospital's `accepting = false`; try to send a patient notice to it | Rejected by `send_patient_notice`. |
| F3-Transport | Ambulance | On scene → pick an accepting hospital → Save → press "Transporting" | Status becomes `transporting` (requires `field_data.hospital_id`); the barangay, LGU and reporter are notified. |
| F3-ArrivedHospital | Ambulance | Transporting → press "Arrived at hospital" | Status becomes `arrived_hospital`. |
| F3-Done | Ambulance | Arrived at hospital → Done | Done. |
| F3-N1 | Ambulance | Try to press Transporting before choosing a hospital | Rejected: "Choose an accepting hospital before transporting". |

### G — Team names

| # | Role | Step | Expected |
|---|---|---|---|
| G1-Form | LGU / Barangay official | Open the dispatch form | The team list shows: BFP, PNP, Barangay Response Team, Ambulance, Rescue Unit. `MDRRMO Rescue` is no longer pickable. |
| G1-DB | — | Insert a `report_dispatches` row with team `MDRRMO Rescue` directly | Still accepted by the DB check; the row renders; the Rescue logic applies to it. |

### Cross-cutting

| # | Role | Step | Expected |
|---|---|---|---|
| X-Declined-Unit | Any | Decline a dispatch | The unit's `dispatch_units.status` returns to `available` (sync_unit_status treats `declined` as closed). |
| X-Close | LGU | Resolve a report with an open `on_hold` dispatch | release_on_close moves every dispatch not in `('done','declined')` to `done`; responders/equipment released. |
| X-Audit | Super Admin | Activity Log | Every decline, help request, road closure, escort and field-data change has an audit row. |
| X-Realtime | Any | Open two browser tabs as LGU + BFP; decline a dispatch in one | The other tab's view updates within seconds (supabase_realtime). |

## 28. Dispatch console — PRIORITY 0 smoke test (Oct 24 2026)

Verifies the P0 fix for the dispatch console being non-clickable. The root
cause was that `js/dispatch.js` referenced `window.UG_APP` (all caps) in 62
places, but `app.js` only exposed `window.UG_App` (mixed case) — so every
dispatch click silently no-op'd. After the fix, `window.UG_APP` is exposed
with `{ render, go, toast, loadRouteData, actions }`, the 62 guards are
replaced with a local `app()` helper that fails loudly (console.error +
visible toast) if the bridge is missing, and the click delegate now runs
the action BEFORE closing the modal so modal form fields are still in the
DOM when the handler reads them.

Sign in once per role, then run through every clickable surface. Each
click must visibly change the screen, a toast, or the data — a silent
no-op is a bug now (the `app()` helper logs loudly when the bridge is
missing; an undefined action still returns silently, but the click
delegate is unchanged, so verify visually that the action happens).

### Unit admin (BFP / PNP / Rescue / Hospital)

| # | Step | Expected |
|---|---|---|
| D-1.1 | Sign in as a unit_admin (e.g. BFP) | Lands on the Incoming Dispatches screen with the dispatch sidebar visible. |
| D-1.2 | Click each sidebar item: Equipment, Roster, Hospital (skip if not Hospital), Requests, Analytics, Contacts, Notifications | Each click visibly switches the screen immediately (a loading state shows first if data is loading, then the data). The hash changes to match (#equipment, #roster, etc.). |
| D-1.3 | Press the browser back button | Returns to the previous dispatch sub-route. |
| D-1.4 | Press the browser forward button | Goes back to the route you came from. |
| D-1.5 | Reload the page on `#equipment` | Lands back on the Equipment screen (not the default dispatch list). |
| D-1.6 | Press Refresh in the sidebar | Toast "loaded" or data refreshes; sidebar scroll position is preserved. |
| D-1.7 | Click the bell in the topbar | Lands on the Notifications screen. |
| D-1.8 | Click Sign Out (sidebar AND topbar) | Signs out and returns to the Sign In screen. |
| D-1.9 | Open one dispatch row | The dispatch detail screen renders with the team-specific action buttons (BFP: Acknowledge → Under control → Fire out → Done; Rescue: Acknowledge → En route → On scene → On hold → Resume → Done; Ambulance: → Transporting → Arrived at hospital → Done). |
| D-1.10 | Press "Can't respond" on a sent/acknowledged dispatch | A prompt asks for a reason; on submit, the dispatch_status becomes `declined`, a toast appears, and the row badge turns red. |
| D-1.11 | Open the help request modal (Need help) | The modal opens; pick a kind, write a message, press Send — a toast "Help request sent to the LGU" appears, the modal closes. **The Send button must NOT be swallowed by the modal-close logic before the handler reads the form fields.** |
| D-1.12 | On BFP, press "Water tanker" and "Extra personnel" | Each creates a help request of the right kind and toasts "… request sent to the LGU". |
| D-1.13 | Open the road-closure modal (PNP only) | The modal opens; fill the road name + note + segment; press Post closure — a toast "Road closure posted" appears, the modal closes. |
| D-1.14 | Open the equipment check modal (any unit) | The modal opens; pick a condition + level + notes; press Save check — a toast "Check recorded" appears, the modal closes. **Verify the Save check button is NOT swallowed before the handler reads the form.** |

### Unit member (non-admin)

| # | Step | Expected |
|---|---|---|
| D-2.1 | Sign in as a unit member (not unit_admin) | Lands on Incoming Dispatches; the Roster screen shows no "Invite member" button (member cannot invite). |
| D-2.2 | Repeat D-1.2 (every sidebar item) | Every sidebar item switches screens. |
| D-2.3 | Repeat D-1.6, D-1.7, D-1.8 | Refresh, bell, Sign Out all work the same as for the admin. |
| D-2.4 | Open a dispatch row and press Acknowledge | Status moves to `acknowledged`; a toast appears; the row updates. |
| D-2.5 | Open the Equipment screen and press Check on a row | The check modal opens; Save records it (member can run checks on their own unit's equipment). |

### Mobile / narrow layout (any role)

| # | Step | Expected |
|---|---|---|
| D-3.1 | Resize the browser to ≤ 720px wide OR use the device toolbar in DevTools | The sidebar collapses; the menu button is visible in the topbar. |
| D-3.2 | Press the menu button (toggle-nav) | The sidebar slides in from the left; the dark scrim covers the rest of the screen. |
| D-3.3 | Press the scrim | The sidebar closes (close-nav action). |
| D-3.4 | Press the menu button, then press a sidebar item | The screen switches AND the sidebar closes (one tap navigates AND dismisses the drawer). |
| D-3.5 | Verify the scrim does NOT block clicks on the dispatch content when the nav is closed | Clicking a dispatch row works directly. |
| D-3.6 | On a wide screen (≥ 1280px), pin the nav open | The scrim becomes invisible and does not block clicks; the sidebar stays open across navigations. |

### Negative tests

| # | Step | Expected |
|---|---|---|
| D-N.1 | Sign in as a non-dispatch role (citizen or LGU); open the browser console and run `UG_DISPATCH.actions['dispatch-nav']({ route: 'equipment' }, {})` | It throws (or toasts a "bridge missing" warning) because the dispatch module is not the active console — but the click delegate itself does not fire for non-dispatch users because they never see `data-act="dispatch-nav"`. |
| D-N.2 | In the browser console, run `delete window.UG_APP; UG_DISPATCH.actions['dispatch-nav']({ route: 'equipment' }, {})` | The `app()` helper logs `[UniGuard dispatch] Dispatch bridge missing: window.UG_APP is undefined…` to the console AND shows a visible toast. Subsequent calls are silent (no spam). The route does NOT change because the bridge is broken — that is the loud-failure design. |
| D-N.3 | Open the dev tools Network tab; click Acknowledge on a dispatch | A `dispatch_respond` RPC call appears. Force the server to return an error (e.g. revoke the JWT); click Acknowledge again | The toast shows the server's error message — NOT a silent no-op. (This is the defect-4 rpc() fix.) |

### What the loud-failure helper looks like

When the bridge is missing, the dispatch console's `app()` helper logs
once to the console and shows a visible toast, then returns a noop bridge
so catch blocks (`app().toast(e.message, 'warning')`) do not recurse:

```
[UniGuard dispatch] Dispatch bridge missing: window.UG_APP is undefined.
The console cannot re-render or toast. Reload the page; if this persists,
the app.js boot did not finish.
```

If you see this toast during a real session, it means `app.js` did not
finish booting (a JS error earlier in the bundle, a missing script tag,
or a CDN failure). Open the browser console for the actual error.
