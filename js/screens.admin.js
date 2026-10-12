/* UniGuard · administration screens
 * User management and the audit log for the command console, plus the responder
 * assignment control used on the incident detail screen. Same visual language as
 * the rest of the console: ug-card, ug-table, ug-btn, ug-badge.
 */
const UG_ADMIN = (function () {
  const esc = UG_UTIL.esc;
  const I = UG.icon;
  const U = UG;
  const ROUTES = ['users', 'audit', 'response-team', 'dispatch-units'];

  const handles = (route) => ROUTES.indexOf(route) !== -1;

  const ROLE_LABEL = {
    citizen: 'Citizen',
    barangay_official: 'Barangay Official',
    lgu_ldrrmc: 'LDRRMO Staff',
    /* not a database role: an lgu_ldrrmc account with is_super_admin = true */
    super_admin: 'Super Admin',
    dispatch_team: 'Dispatch Team'
  };
  /* The role shown for an account: LGU accounts split into two tiers. */
  const roleOf = (u) => (u && u.role === 'lgu_ldrrmc' && u.is_super_admin === true) ? 'super_admin' : ((u && u.role) || 'citizen');
  const isSuper = (st) => !!(st.session && st.session.role === 'lgu_ldrrmc' && st.session.superAdmin);
  const superOnly = (title) => '<div class="ug-col" style="gap:16px">' + head(title, 'Restricted to the Super Admin.') +
    statePanel('empty', 'Super Admin only', 'Accounts, roles and the activity log are managed by the Super Admin. Ask them if you need a change made.') + '</div>';

  function head(title, sub, actions) {
    return '<div class="ug-rowf ug-between ug-wrap" style="gap:14px;align-items:flex-end">' +
      '<div><h2 style="font-size:20px">' + esc(title) + '</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:4px">' + esc(sub) + '</p></div>' +
      '<div class="ug-rowf ug-gap8" style="gap:8px">' + (actions || '') + '</div></div>';
  }

  function statePanel(kind, title, sub, action) {
    if (kind === 'loading') {
      return '<div class="ug-card"><div class="ug-card-b ug-col" style="gap:10px">' +
        '<div class="ug-skel" style="height:14px;width:38%"></div>' +
        '<div class="ug-skel" style="height:14px;width:72%"></div>' +
        '<div class="ug-skel" style="height:14px;width:56%"></div>' +
        '<div class="ug-skel" style="height:14px;width:64%"></div></div></div>';
    }
    if (kind === 'error') {
      return '<div class="ug-card"><div class="ug-card-b ug-rowf ug-gap10" style="gap:10px;align-items:flex-start">' +
        '<span style="color:var(--ug-emergency);display:flex">' + I('alert', 18) + '</span>' +
        '<div><div style="font-size:12.5px;font-weight:700;color:var(--ug-emergency)">' + esc(title) + '</div>' +
        '<div class="ug-note" style="margin-top:4px">' + esc(sub) + '</div>' +
        (action || '') + '</div></div></div>';
    }
    return '<div class="ug-card"><div class="ug-empty"><span class="e-ico">' + I('inbox', 20) + '</span>' +
      '<div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">' + esc(title) + '</div>' +
      '<div style="font-size:11px">' + esc(sub) + '</div></div></div>';
  }

  /* --------------------------------------------------------------- users */
  function users(st) {
    if (!isSuper(st)) return superOnly('User Management');
    if (st.loading) return '<div class="ug-col" style="gap:16px">' + head('User Management', 'Create and manage accounts, roles and barangay assignments.') + statePanel('loading') + '</div>';
    if (st.error) return '<div class="ug-col" style="gap:16px">' + head('User Management', 'Create and manage accounts, roles and barangay assignments.') +
      statePanel('error', 'Could not load accounts', st.error,
        '<button class="ug-btn ug-btn--sm" data-act="admin-load" style="margin-top:10px">Try Again</button>') + '</div>';

    const users = UG.DATA.users || [];
    const barangays = (st.barangays || []).map((b) => ({ id: b.id, name: b.name }));

    const rows = users.map((u) => {
      const cur = roleOf(u);
      const roleOpts = ['citizen', 'barangay_official', 'lgu_ldrrmc', 'super_admin', 'dispatch_team'].map((r) =>
        '<option value="' + r + '"' + (cur === r ? ' selected' : '') + '>' + esc(ROLE_LABEL[r] || r) + '</option>').join('');
      const brgyOpts = '<option value="">Not set</option>' + barangays.map((b) =>
        '<option value="' + esc(b.id) + '"' + (u.barangay_id === b.id ? ' selected' : '') + '>' + esc(b.name) + '</option>').join('');
      return '<tr data-user="' + esc(u.id) + '">' +
        '<td><div style="font-weight:600">' + esc(u.full_name || '(no name)') + '</div>' +
          '<div class="ug-dimmer" style="font-size:10.5px">' + esc(u.email || '') + (u.unit_role ? ' · ' + u.unit_role : '') + '</div></td>' +
        '<td><select class="ug-sel-inline" data-act="admin-role" data-id="' + esc(u.id) + '" aria-label="Role">' + roleOpts + '</select></td>' +
        '<td><select class="ug-sel-inline" data-act="admin-barangay" data-id="' + esc(u.id) + '" aria-label="Barangay">' + brgyOpts + '</select></td>' +
        '<td>' + (u.disabled ? U.badge('closed', 'Disabled') : U.badge('open', 'Active')) + '</td>' +
        '<td><div class="ug-mono" style="font-size:10.5px;color:var(--ug-ink-3)">' + esc(UG_UTIL.relTime(u.created_at)) + '</div></td>' +
        '<td class="t-right"><button class="ug-btn ug-btn--sm' + (u.disabled ? '' : ' ug-btn--ghost') + '" data-act="admin-disable" data-id="' + esc(u.id) + '" data-next="' + (u.disabled ? 'false' : 'true') + '">' +
          (u.disabled ? 'Enable' : 'Disable') + '</button></td>' +
        '</tr>';
    }).join('');

    const table = users.length
      ? '<div class="ug-card" style="overflow:hidden"><table class="ug-table">' +
        '<thead><tr><th>Account</th><th>Role</th><th>Barangay</th><th>Status</th><th>Created</th><th class="t-right">Action</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>'
      : statePanel('empty', 'No accounts yet', 'Accounts appear here as residents register and officials are created.');

    return '<div class="ug-col" style="gap:16px">' +
      head('User Management', 'Officials and LGU staff are created and promoted here. Residents self-register.',
        '<button class="ug-btn ug-btn--ghost ug-btn--sm" data-act="admin-export-users">' + I('download', 15) + 'Export PDF</button>' +
        '<button class="ug-btn ug-btn--signal ug-btn--sm" data-act="admin-create">' + I('plus', 15) + 'Create Official</button>') +
      table +
      '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-rowf ug-gap10" style="gap:10px;align-items:flex-start">' +
        '<span style="color:var(--ug-signal);display:flex">' + I('info', 17) + '</span>' +
        '<div class="ug-note">Four roles: <b>Super Admin</b> (accounts, roles, activity log), <b>LDRRMO Staff</b> (daily operations), <b>Barangay Official</b> (their own barangay) and <b>Dispatch Team</b> (responders, tied to one unit). Creating or promoting an account runs through a server function that checks the caller is the Super Admin and writes an activity log entry. It is the only way a role other than citizen can be assigned.</div>' +
      '</div></div>' +
    '</div>';
  }

  /* ------------------------------------------------------- activity log */
  /* Module H: "who changed what". Rows come from audit_log, which only the
     database writes (triggers and security definer functions). */
  const ENTITY_LABEL = {
    profiles: 'Accounts', reports: 'Incidents', advisories: 'Advisories', evacuation_centers: 'Evacuation centers',
    road_status: 'Road status', road_work_posts: 'Road works', emergency_hotlines: 'Hotlines',
    preparedness_guides: 'Guides', faqs: 'FAQs', sos_log: 'SOS', report_dispatches: 'Dispatches',
    dispatch_units: 'Dispatch units', dispatch_equipment: 'Equipment', damage_assessments: 'Damage assessments',
    situation_reports: 'Situation reports'
  };
  const entityLabel = (e) => ENTITY_LABEL[e] || (e ? String(e).replace(/_/g, ' ') : 'System');
  const actorOf = (a) => a.actor_name || (a.actor_id ? String(a.actor_id).slice(0, 8) : 'System');
  const short = (v) => {
    if (v === null || v === undefined || v === '') return '(empty)';
    const t = (typeof v === 'object') ? JSON.stringify(v) : String(v);
    return t.length > 60 ? t.slice(0, 57) + '…' : t;
  };

  /* One readable line for "what changed" instead of raw JSON. */
  function describe(a) {
    const m = a.meta || {};
    try {
      if (m.changed && typeof m.changed === 'object') {
        return Object.keys(m.changed).map((k) => k.replace(/_/g, ' ') + ': ' + short(m.changed[k].from) + ' → ' + short(m.changed[k].to)).join('; ');
      }
      if (m.from !== undefined && m.to !== undefined) return short(m.from) + ' → ' + short(m.to);
      const row = m.after || m.before;
      if (row && typeof row === 'object') {
        const name = row.title || row.name || row.road_name || row.agency_name || row.question || row.barangay || row.code || '';
        return (m.after ? 'Created' : 'Deleted') + (name ? ': ' + short(name) : '');
      }
      const keys = Object.keys(m);
      if (!keys.length) return '';
      return keys.slice(0, 5).map((k) => k.replace(/_/g, ' ') + ': ' + short(m[k])).join('; ');
    } catch (e) { return ''; }
  }

  function filterAudit(st) {
    const q = String(st.auditQ || '').trim().toLowerCase();
    const from = st.auditFrom ? new Date(st.auditFrom + 'T00:00:00').getTime() : null;
    const to = st.auditTo ? new Date(st.auditTo + 'T23:59:59').getTime() : null;
    return (UG.DATA.audit || []).filter((a) => {
      if (st.auditEntity && st.auditEntity !== 'All' && (a.entity || '') !== st.auditEntity) return false;
      if (st.auditActor && st.auditActor !== 'All' && actorOf(a) !== st.auditActor) return false;
      const t = a.created_at ? new Date(a.created_at).getTime() : null;
      if (from !== null && t !== null && t < from) return false;
      if (to !== null && t !== null && t > to) return false;
      if (q && (actorOf(a) + ' ' + (a.action || '') + ' ' + entityLabel(a.entity) + ' ' + describe(a)).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }

  function audit(st) {
    const TITLE = 'Activity Log', SUB = 'Who changed what, and when. Newest first.';
    if (!isSuper(st)) return superOnly(TITLE);
    if (st.loading) return '<div class="ug-col" style="gap:16px">' + head(TITLE, SUB) + statePanel('loading') + '</div>';
    if (st.error) return '<div class="ug-col" style="gap:16px">' + head(TITLE, SUB) +
      statePanel('error', 'Could not load the activity log', st.error,
        '<button class="ug-btn ug-btn--sm" data-act="admin-load" style="margin-top:10px">Try Again</button>') + '</div>';

    const all = UG.DATA.audit || [];
    const rows = filterAudit(st);
    const uniq = (list) => list.filter((v, i) => v && list.indexOf(v) === i).sort();
    const entities = uniq(all.map((a) => a.entity || ''));
    const actors = uniq(all.map(actorOf));
    const opt = (v, label, cur) => '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' + esc(label) + '</option>';
    const fld = (label, inner, style) => '<div class="ug-field" style="margin:0;' + (style || '') + '"><label class="ug-lab">' + label + '</label>' + inner + '</div>';

    const filters = '<div class="ug-card"><div class="ug-card-b ug-rowf ug-gap12 ug-wrap" style="gap:12px;align-items:flex-end">' +
      fld('Search', '<input class="ug-in" data-field="auditQ" value="' + esc(st.auditQ || '') + '" placeholder="Name, action or changed value">', 'flex:1;min-width:200px') +
      fld('Record type', '<select class="ug-sel" data-field="auditEntity">' + opt('All', 'All records', st.auditEntity || 'All') +
        entities.map((e) => opt(e, entityLabel(e), st.auditEntity)).join('') + '</select>', 'min-width:170px') +
      fld('Changed by', '<select class="ug-sel" data-field="auditActor">' + opt('All', 'Everyone', st.auditActor || 'All') +
        actors.map((n) => opt(n, n, st.auditActor)).join('') + '</select>', 'min-width:170px') +
      fld('From', '<input class="ug-in" type="date" data-field="auditFrom" value="' + esc(st.auditFrom || '') + '">') +
      fld('To', '<input class="ug-in" type="date" data-field="auditTo" value="' + esc(st.auditTo || '') + '">') +
      '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="audit-clear">Clear</button>' +
      '</div></div>';

    const body = rows.map((a) => '<tr data-act="open-audit" data-id="' + esc(a.id) + '" style="cursor:pointer" title="Open the full entry">' +
      '<td class="t-num" style="white-space:nowrap">' + esc(UG_UTIL.absTime(a.created_at) || UG_UTIL.relTime(a.created_at)) + '</td>' +
      '<td style="font-weight:600">' + esc(actorOf(a)) + '</td>' +
      '<td>' + esc(entityLabel(a.entity)) + '</td>' +
      '<td><span class="ug-badge ug-badge--id">' + esc(a.action) + '</span></td>' +
      '<td style="font-size:11.5px;max-width:420px">' + esc(describe(a) || '—') + '</td>' +
      '</tr>').join('');

    const table = rows.length
      ? '<div class="ug-card" style="overflow:hidden"><table class="ug-table">' +
        '<thead><tr><th>When</th><th>Who</th><th>Record</th><th>Action</th><th>What changed</th></tr></thead>' +
        '<tbody>' + body + '</tbody></table></div>'
      : (all.length
          ? statePanel('empty', 'No entries match these filters', 'Clear the filters to see every entry.')
          : statePanel('empty', 'Nothing recorded yet', 'Role changes, advisories, shelter updates and incident moves show up here.'));

    return '<div class="ug-col" style="gap:16px">' +
      head(TITLE, SUB,
        '<span class="ug-chip">' + rows.length + ' of ' + all.length + ' entries</span>' +
        '<button class="ug-btn ug-btn--ghost ug-btn--sm" data-act="admin-load">' + I('wave', 15) + 'Refresh</button>' +
        '<button class="ug-btn ug-btn--ghost ug-btn--sm" data-act="admin-export-audit">' + I('download', 15) + 'Export PDF</button>') +
      filters + table +
      '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-note">Entries are written by the database itself when a record changes, so they cannot be edited or removed from the console. ' +
      'Covered: accounts and roles, incident status moves and edits, dispatches, advisories, evacuation centers, road status, hotlines, guides, FAQs, SOS, damage assessments and situation reports.</div></div>' +
      '</div>';
  }

  /* ------------------------------------------------- responder assignment */
  function assignmentPanel(st, incident) {
    const responders = UG.DATA.responders || [];
    if (!responders.length) {
      return '<div class="ug-rowf ug-between" style="gap:10px;font-size:12px">' +
        '<span class="ug-dim">Responder roster</span>' +
        '<button class="ug-btn ug-btn--sm" data-act="load-responders">' + I('users', 14) + 'Load roster</button></div>';
    }
    const opts = responders.map((r) =>
      '<option value="' + esc(r.id) + '">' + esc(r.name + (r.unit ? ' · ' + r.unit : '')) + '</option>').join('');
    return '<div class="ug-field" style="margin-bottom:10px"><label class="ug-lab">Assign a responder unit</label>' +
      '<div class="ug-rowf" style="gap:8px">' +
        '<select class="ug-sel-inline" style="flex:1;max-width:none" data-field="assignResponder">' +
          '<option value="">Select a unit</option>' + opts + '</select>' +
        '<button class="ug-btn ug-btn--sm ug-btn--signal" data-act="assign-responder" data-id="' + esc(incident.uuid || incident.id) + '">Assign</button>' +
      '</div></div>';
  }

  /* ---------------------------------------------------------- barangay Response Team
   * The barangay_official's Response Team console: incoming dispatches,
   * roster (responders + status), equipment (barangay-owned) and a
   * read-only dispatch directory. Reuses the UG_ADMIN data shape and the
   * existing responder + dispatch helpers in Repo.
   */
  function responseTeam(st) {
    const me = st.session || {};
    const isLgu = me.role === 'lgu_ldrrmc';
    const myBrgyId = me.barangay_id;
    const brgyName = me.barangay || 'your barangay';

    /* dispatches — Barangay Response Team rows for the caller's barangay
       (LGU sees every barangay) */
    const disp = (UG.DATA.dispatches ? Object.values(UG.DATA.dispatches).flat() : [])
      .filter((d) => d.team === 'Barangay Response Team')
      .filter((d) => !isLgu || true);  /* LGU sees all; the server enforces the rest */

    const responders = (UG.DATA.responders || [])
      .filter((r) => isLgu || r.barangay_id === myBrgyId || r.barangay_id == null);

    const dispatchRow = (d) => '<tr>' +
      '<td class="t-num">' + esc(UG_UTIL.absTime(d.dispatched_at) || '') + '</td>' +
      '<td>' + esc(d.team) + '</td>' +
      '<td class="ug-dimmer" style="font-size:11px">' + esc(d.instructions || '') + '</td>' +
      '<td>' + esc(d.dispatched_by_name || '') + '</td>' +
      '<td>' + esc(d.dispatch_status || (d.done_at ? 'done' : 'sent')) + '</td>' +
    '</tr>';

    const responderRow = (r) => '<tr>' +
      '<td><div style="font-weight:600">' + esc(r.name || '') + '</div>' +
        '<div class="ug-dimmer" style="font-size:10.5px">' + esc(r.unit || '') + '</div></td>' +
      '<td>' + esc(r.contact || '') + '</td>' +
      '<td>' + esc(r.status || 'available') + '</td>' +
      '<td class="t-right"><button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="admin-responders-toggle" data-id="' + esc(r.id) + '" data-next="' + (r.status === 'off_duty' ? 'available' : 'off_duty') + '">' + (r.status === 'off_duty' ? 'Set available' : 'Set off duty') + '</button></td>' +
    '</tr>';

    const units = (UG.DATA.dispatchUnits || []).map((u) => '<tr><td><div style="font-weight:600">' + esc(u.name) + '</div></td>' +
      '<td>' + esc(u.unit_type) + '</td>' +
      '<td>' + esc(u.contact_number || '') + '</td>' +
      '<td>' + esc(u.status) + '</td>' +
      '<td class="t-right"><a class="ug-btn ug-btn--sm ug-btn--signal" href="tel:' + esc(String(u.contact_number).replace(/[^+\d]/g, '')) + '">' + I('phone', 13) + 'Call</a></td>' +
    '</tr>').join('');

    return '<div class="ug-col" style="gap:18px">' +
      head('Barangay Response Team', 'Incoming dispatches, roster and equipment for ' + (isLgu ? 'every barangay' : 'Barangay ' + brgyName) + '.') +
      (disp.length ? '<div class="ug-card" style="overflow:hidden"><table class="ug-table"><thead><tr><th>When</th><th>Team</th><th>Instructions</th><th>By</th><th>Status</th></tr></thead><tbody>' + disp.map(dispatchRow).join('') + '</tbody></table></div>'
        : statePanel('empty', 'No Response Team dispatches yet', 'When your barangay\'s Response Team is dispatched, the alert lands here.')) +
      '<div class="ug-card" style="overflow:hidden"><table class="ug-table"><thead><tr><th>Name / unit</th><th>Contact</th><th>Status</th><th class="t-right">Action</th></tr></thead><tbody>' +
        (responders.length ? responders.map(responderRow).join('') : '<tr><td colspan="4" style="text-align:center;padding:20px">No responders yet</td></tr>') + '</tbody></table></div>' +
      (units ? '<div class="ug-card" style="overflow:hidden"><table class="ug-table"><thead><tr><th>Unit</th><th>Type</th><th>Contact</th><th>Status</th><th class="t-right">Action</th></tr></thead><tbody>' + units + '</tbody></table></div>' : '') +
    '</div>';
  }

  /* ---------------------------------------------------------- LGU Dispatch Units
   * The LGU's municipality-wide dispatch unit console: list units, manage
   * accounts (via admin-users), and the support request inbox.
   */
  function dispatchUnits(st) {
    const units = UG.DATA.dispatchUnits || [];
    const requests = UG.DATA.unitRequests || [];
    const unitRow = (u) => '<tr>' +
      '<td><div style="font-weight:600">' + esc(u.name) + '</div>' +
        '<div class="ug-dimmer" style="font-size:10.5px">' + esc(u.address || '') + '</div></td>' +
      '<td>' + esc(u.unit_type) + '</td>' +
      '<td>' + esc(u.contact_number || '') + '</td>' +
      '<td>' + esc(u.status) + '</td>' +
      '<td>' + (u.active ? U.badge('open', 'Active') : U.badge('closed', 'Inactive')) + '</td>' +
      '<td class="t-right"><button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="admin-edit-unit" data-id="' + esc(u.id) + '">' + I('settings', 14) + 'Edit</button></td>' +
    '</tr>';
    const requestRow = (r) => '<tr>' +
      '<td class="t-num">' + esc(UG_UTIL.absTime(r.created_at) || '') + '</td>' +
      '<td>' + esc(r.unit_id) + '</td>' +
      '<td><span class="ug-badge ug-badge--id">' + esc(r.kind) + '</span></td>' +
      '<td class="ug-dimmer" style="font-size:11px">' + esc(r.details) + '</td>' +
      '<td>' + esc(r.status) + '</td>' +
      '<td class="t-right">' + (r.status === 'pending' ? '<button class="ug-btn ug-btn--sm ug-btn--signal" data-act="admin-decide-request" data-id="' + esc(r.id) + '" data-decision="approved">Approve</button> <button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="admin-decide-request" data-id="' + esc(r.id) + '" data-decision="declined">Decline</button>' : '') + '</td>' +
    '</tr>';
    return '<div class="ug-col" style="gap:18px">' +
      head('Dispatch Units', 'BFP, PNP, Rescue and Hospital units · municipality-wide.',
        /* a new unit invites its first admin account, so it is a Super Admin action */
        isSuper(st) ? '<button class="ug-btn ug-btn--signal ug-btn--sm" data-act="admin-create-unit">' + I('plus', 14) + 'New unit</button>' : '') +
      '<div class="ug-card" style="overflow:hidden"><table class="ug-table">' +
      '<thead><tr><th>Name / address</th><th>Type</th><th>Contact</th><th>Status</th><th>Active</th><th class="t-right">Action</th></tr></thead>' +
      '<tbody>' + (units.length ? units.map(unitRow).join('') : '<tr><td colspan="6" style="text-align:center;padding:20px">No units yet</td></tr>') + '</tbody></table></div>' +
      head('Support request inbox', 'Unit support requests, pending first.') +
      '<div class="ug-card" style="overflow:hidden"><table class="ug-table">' +
      '<thead><tr><th>When</th><th>Unit</th><th>Kind</th><th>Details</th><th>Status</th><th class="t-right">Action</th></tr></thead>' +
      '<tbody>' + (requests.length ? requests.map(requestRow).join('') : '<tr><td colspan="6" style="text-align:center;padding:20px">No support requests</td></tr>') + '</tbody></table></div>' +
    '</div>';
  }

  function body(st) {
    if (st.route === 'users') return users(st);
    if (st.route === 'audit') return audit(st);
    if (st.route === 'response-team') return responseTeam(st);
    if (st.route === 'dispatch-units') return dispatchUnits(st);
    return '';
  }

  return { handles, body, users, audit, responseTeam, dispatchUnits, assignmentPanel, ROLE_LABEL, roleOf, describe, filterAudit, entityLabel, head, statePanel };
})();
