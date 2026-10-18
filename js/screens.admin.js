/* UniGuard · administration screens
 * User management and the audit log for the command console, plus the responder
 * assignment control used on the incident detail screen. Same visual language as
 * the rest of the console: ug-card, ug-table, ug-btn, ug-badge.
 */
const UG_ADMIN = (function () {
  const esc = UG_UTIL.esc;
  const I = UG.icon;
  const U = UG;
  const T = (k) => (typeof UG_I18N !== 'undefined' ? UG_I18N.t(k) : k);
  const ROUTES = ['users', 'audit', 'response-team', 'dispatch-units'];

  const handles = (route) => ROUTES.indexOf(route) !== -1;

  const ROLE_LABEL = {
    citizen: T('admin.roleCitizen'),
    barangay_official: T('admin.roleBarangay'),
    lgu_ldrrmc: T('admin.roleLgu'),
    /* not a database role: an lgu_ldrrmc account with is_super_admin = true */
    super_admin: T('admin.roleSuperAdmin'),
    dispatch_team: T('admin.roleDispatch')
  };
  /* The role shown for an account: LGU accounts split into two tiers. */
  const roleOf = (u) => (u && u.role === 'lgu_ldrrmc' && u.is_super_admin === true) ? 'super_admin' : ((u && u.role) || 'citizen');
  const isSuper = (st) => !!(st.session && st.session.role === 'lgu_ldrrmc' && st.session.superAdmin);
  const superOnly = (title) => '<div class="ug-col" style="gap:16px">' + head(title, T('admin.superOnly')) +
    statePanel('empty', T('admin.unitAdminOnlyShort'), T('admin.superOnlyHint')) + '</div>';

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
    if (st.loading) return '<div class="ug-col" style="gap:16px">' + head(T('admin.usersTitle'), T('admin.usersSub')) + statePanel('loading') + '</div>';
    if (st.error) return '<div class="ug-col" style="gap:16px">' + head(T('admin.usersTitle'), T('admin.usersSub')) +
      statePanel('error', T('admin.auditCouldNotLoadAccounts'), st.error,
        '<button class="ug-btn ug-btn--sm" data-act="admin-load" style="margin-top:10px">' + esc(T('action.tryAgain')) + '</button>') + '</div>';

    const users = UG.DATA.users || [];
    const barangays = (st.barangays || []).map((b) => ({ id: b.id, name: b.name }));

    const rows = users.map((u) => {
      const cur = roleOf(u);
      const roleOpts = ['citizen', 'barangay_official', 'lgu_ldrrmc', 'super_admin', 'dispatch_team'].map((r) =>
        '<option value="' + r + '"' + (cur === r ? ' selected' : '') + '>' + esc(ROLE_LABEL[r] || r) + '</option>').join('');
      const brgyOpts = '<option value="">' + esc(T('admin.notSet')) + '</option>' + barangays.map((b) =>
        '<option value="' + esc(b.id) + '"' + (u.barangay_id === b.id ? ' selected' : '') + '>' + esc(b.name) + '</option>').join('');
      return '<tr data-user="' + esc(u.id) + '">' +
        '<td><div style="font-weight:600">' + esc(u.full_name || '(no name)') + '</div>' +
          '<div class="ug-dimmer" style="font-size:10.5px">' + esc(u.email || '') + (u.unit_role ? ' · ' + u.unit_role : '') + '</div></td>' +
        '<td><select class="ug-sel-inline" data-act="admin-role" data-id="' + esc(u.id) + '" aria-label="' + esc(T('label.role')) + '">' + roleOpts + '</select></td>' +
        '<td><select class="ug-sel-inline" data-act="admin-barangay" data-id="' + esc(u.id) + '" aria-label="' + esc(T('label.barangay')) + '">' + brgyOpts + '</select></td>' +
        '<td>' + (u.disabled ? U.badge('closed', T('admin.disable')) : U.badge('open', T('label.active'))) + '</td>' +
        '<td><div class="ug-mono" style="font-size:10.5px;color:var(--ug-ink-3)">' + esc(UG_UTIL.relTime(u.created_at)) + '</div></td>' +
        '<td class="t-right"><button class="ug-btn ug-btn--sm' + (u.disabled ? '' : ' ug-btn--ghost') + '" data-act="admin-disable" data-id="' + esc(u.id) + '" data-next="' + (u.disabled ? 'false' : 'true') + '">' +
          (u.disabled ? esc(T('action.enable')) : esc(T('action.disable'))) + '</button></td>' +
        '</tr>';
    }).join('');

    const table = users.length
      ? '<div class="ug-card" style="overflow:hidden"><table class="ug-table">' +
        '<thead><tr><th>' + esc(T('admin.accountColumn')) + '</th><th>' + esc(T('label.role')) + '</th><th>' + esc(T('label.barangay')) + '</th><th>' + esc(T('label.status')) + '</th><th>' + esc(T('admin.createdColumn')) + '</th><th class="t-right">' + esc(T('admin.actionColumn')) + '</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>'
      : statePanel('empty', T('admin.noAccounts'), T('admin.noAccountsHint'));

    return '<div class="ug-col" style="gap:16px">' +
      head(T('admin.usersTitle'), T('admin.usersSub'),
        '<button class="ug-btn ug-btn--ghost ug-btn--sm" data-act="admin-export-users">' + I('download', 15) + esc(T('action.exportPdf')) + '</button>' +
        '<button class="ug-btn ug-btn--signal ug-btn--sm" data-act="admin-create">' + I('plus', 15) + esc(T('admin.createOfficial')) + '</button>') +
      table +
      '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-rowf ug-gap10" style="gap:10px;align-items:flex-start">' +
        '<span style="color:var(--ug-signal);display:flex">' + I('info', 17) + '</span>' +
        '<div class="ug-note">' + T('admin.roleHelp') + '</div>' +
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
    const TITLE = T('admin.auditTitle'), SUB = T('admin.auditSub');
    if (!isSuper(st)) return superOnly(TITLE);
    if (st.loading) return '<div class="ug-col" style="gap:16px">' + head(TITLE, SUB) + statePanel('loading') + '</div>';
    if (st.error) return '<div class="ug-col" style="gap:16px">' + head(TITLE, SUB) +
      statePanel('error', T('admin.auditCouldNotLoad'), st.error,
        '<button class="ug-btn ug-btn--sm" data-act="admin-load" style="margin-top:10px">' + esc(T('action.tryAgain')) + '</button>') + '</div>';

    const all = UG.DATA.audit || [];
    const rows = filterAudit(st);
    const uniq = (list) => list.filter((v, i) => v && list.indexOf(v) === i).sort();
    const entities = uniq(all.map((a) => a.entity || ''));
    const actors = uniq(all.map(actorOf));
    const opt = (v, label, cur) => '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' + esc(label) + '</option>';
    const fld = (label, inner, style) => '<div class="ug-field" style="margin:0;' + (style || '') + '"><label class="ug-lab">' + label + '</label>' + inner + '</div>';

    const filters = '<div class="ug-card"><div class="ug-card-b ug-rowf ug-gap12 ug-wrap" style="gap:12px;align-items:flex-end">' +
      fld(T('action.search'), '<input class="ug-in" data-field="auditQ" value="' + esc(st.auditQ || '') + '" placeholder="' + esc(T('label.search')) + '">', 'flex:1;min-width:200px') +
      fld(T('admin.recordType'), '<select class="ug-sel" data-field="auditEntity">' + opt('All', T('admin.allRecords'), st.auditEntity || 'All') +
        entities.map((e) => opt(e, entityLabel(e), st.auditEntity)).join('') + '</select>', 'min-width:170px') +
      fld(T('admin.changedBy'), '<select class="ug-sel" data-field="auditActor">' + opt('All', T('admin.everyone'), st.auditActor || 'All') +
        actors.map((n) => opt(n, n, st.auditActor)).join('') + '</select>', 'min-width:170px') +
      fld(T('admin.from'), '<input class="ug-in" type="date" data-field="auditFrom" value="' + esc(st.auditFrom || '') + '">') +
      fld(T('admin.to'), '<input class="ug-in" type="date" data-field="auditTo" value="' + esc(st.auditTo || '') + '">') +
      '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="audit-clear">' + esc(T('action.clear')) + '</button>' +
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
          ? statePanel('empty', T('admin.noAuditMatch'), T('admin.noAuditMatchHint'))
          : statePanel('empty', T('admin.nothingRecorded'), T('admin.nothingRecordedHint')));

    return '<div class="ug-col" style="gap:16px">' +
      head(TITLE, SUB,
        '<span class="ug-chip">' + rows.length + ' / ' + all.length + ' ' + esc(T('admin.entriesOf')) + '</span>' +
        '<button class="ug-btn ug-btn--ghost ug-btn--sm" data-act="admin-load">' + I('wave', 15) + esc(T('action.refresh')) + '</button>' +
        '<button class="ug-btn ug-btn--ghost ug-btn--sm" data-act="admin-export-audit">' + I('download', 15) + esc(T('action.exportPdf')) + '</button>') +
      filters + table +
      '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-note">' + T('admin.auditFooter') + '</div></div>' +
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
      '<td class="t-right"><button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="admin-responders-toggle" data-id="' + esc(r.id) + '" data-next="' + (r.status === 'off_duty' ? 'available' : 'off_duty') + '">' + (r.status === 'off_duty' ? esc(T('action.setAvailable')) : esc(T('action.setOffDuty'))) + '</button></td>' +
    '</tr>';

    const units = (UG.DATA.dispatchUnits || []).map((u) => '<tr><td><div style="font-weight:600">' + esc(u.name) + '</div></td>' +
      '<td>' + esc(u.unit_type) + '</td>' +
      '<td>' + esc(u.contact_number || '') + '</td>' +
      '<td>' + esc(u.status) + '</td>' +
      '<td class="t-right"><a class="ug-btn ug-btn--sm ug-btn--signal" href="tel:' + esc(String(u.contact_number).replace(/[^+\d]/g, '')) + '">' + I('phone', 13) + esc(T('action.call')) + '</a></td>' +
    '</tr>').join('');

    return '<div class="ug-col" style="gap:18px">' +
      head(T('admin.responseTeamTitle'), isLgu ? T('admin.responseTeamSub') : (T('admin.responseTeamSubBrgy') + ' ' + esc(brgyName) + '.')) +
      (disp.length ? '<div class="ug-card" style="overflow:hidden"><table class="ug-table"><thead><tr><th>' + esc(T('label.when')) + '</th><th>' + esc(T('label.unit')) + '</th><th>' + esc(T('label.details')) + '</th><th>' + esc(T('label.who')) + '</th><th>' + esc(T('label.status')) + '</th></tr></thead><tbody>' + disp.map(dispatchRow).join('') + '</tbody></table></div>'
        : statePanel('empty', T('admin.noResponseTeamDispatches'), T('admin.noResponseTeamDispatchesHint'))) +
      '<div class="ug-card" style="overflow:hidden"><table class="ug-table"><thead><tr><th>' + esc(T('label.name')) + ' / ' + esc(T('label.unit')) + '</th><th>' + esc(T('label.contact')) + '</th><th>' + esc(T('label.status')) + '</th><th class="t-right">' + esc(T('label.action')) + '</th></tr></thead><tbody>' +
        (responders.length ? responders.map(responderRow).join('') : '<tr><td colspan="4" style="text-align:center;padding:20px">' + esc(T('admin.noResponders')) + '</td></tr>') + '</tbody></table></div>' +
      (units ? '<div class="ug-card" style="overflow:hidden"><table class="ug-table"><thead><tr><th>' + esc(T('label.unit')) + '</th><th>' + esc(T('label.type')) + '</th><th>' + esc(T('label.contact')) + '</th><th>' + esc(T('label.status')) + '</th><th class="t-right">' + esc(T('label.action')) + '</th></tr></thead><tbody>' + units + '</tbody></table></div>' : '') +
    '</div>';
  }

  /* ---------------------------------------------------------- LGU Dispatch Units
   * The LGU's municipality-wide dispatch unit console: list units, manage
   * accounts (via admin-users), and the support request inbox.
   *
   * Power hierarchy (per the issue list):
   *  - Super Admin: can create + view + account + delete a unit. Cannot edit
   *    operational details — operational edits belong to the unit admin / LGU.
   *  - LGU staff (non-super-admin): can edit operational details of a unit.
   *  - Unit admin: can edit their own unit and invite members.
   *  - The hidden red Delete button next to Edit is now visible to authorised
   *    Super Admin users with a confirmation step.
   */
  function dispatchUnits(st) {
    const units = UG.DATA.dispatchUnits || [];
    const requests = UG.DATA.unitRequests || [];
    const superAdmin = isSuper(st);
    const lguStaff = !!((st.session && st.session.role === 'lgu_ldrrmc') && !superAdmin);
    const canEdit = lguStaff; /* operational edits belong to LGU staff, not Super Admin */
    const canDelete = superAdmin; /* only the Super Admin can permanently remove a unit */

    const unitRow = (u) => '<tr>' +
      '<td><div style="font-weight:600">' + esc(u.name) + '</div>' +
        '<div class="ug-dimmer" style="font-size:10.5px">' + esc(u.address || '') + '</div></td>' +
      '<td>' + esc(u.unit_type) + '</td>' +
      '<td>' + esc(u.contact_number || '') + '</td>' +
      '<td>' + esc(u.status || '—') + '</td>' +
      '<td>' + (u.active ? U.badge('open', T('admin.unitDetailActive')) : U.badge('closed', T('admin.unitDetailInactive'))) + '</td>' +
      '<td class="t-right"><div class="ug-rowf ug-gap6" style="gap:6px;justify-content:flex-end;flex-wrap:wrap">' +
        /* View — every authorised role can inspect a unit's details. */
        '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="admin-view-unit" data-id="' + esc(u.id) + '" title="' + esc(T('action.viewDetails')) + '">' + I('eye', 14) + esc(T('action.view')) + '</button>' +
        /* Account — opens a unit-members panel (Super Admin + unit admin). */
        (superAdmin || lguStaff ? '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="admin-unit-account" data-id="' + esc(u.id) + '" title="' + esc(T('admin.unitAccountHint')) + '">' + I('users', 14) + esc(T('admin.unitAccount')) + '</button>' : '') +
        /* Edit — operational edits belong to LGU staff / unit admin, NOT Super Admin
           (Super Admin is read-only here per the documented restriction). */
        (canEdit ? '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="admin-edit-unit" data-id="' + esc(u.id) + '" title="' + esc(T('action.edit')) + '">' + I('settings', 14) + esc(T('action.edit')) + '</button>' : '') +
        /* Delete — visible red destructive button, Super Admin only. */
        (canDelete ? '<button class="ug-btn ug-btn--sm ug-btn--danger" data-act="admin-delete-unit" data-id="' + esc(u.id) + '" title="' + esc(T('action.delete')) + '" style="background:linear-gradient(180deg,#EF4444 0%,#B91C1C 100%);color:#fff;border:1px solid rgba(255,255,255,.15)">' + I('x', 14) + esc(T('action.delete')) + '</button>' : '') +
      '</div></td>' +
    '</tr>';
    const requestRow = (r) => '<tr>' +
      '<td class="t-num">' + esc(UG_UTIL.absTime(r.created_at) || '') + '</td>' +
      '<td>' + esc(r.unit_id) + '</td>' +
      '<td><span class="ug-badge ug-badge--id">' + esc(r.kind) + '</span></td>' +
      '<td class="ug-dimmer" style="font-size:11px">' + esc(r.details) + '</td>' +
      '<td>' + esc(r.status) + '</td>' +
      '<td class="t-right">' + (r.status === 'pending' ? '<button class="ug-btn ug-btn--sm ug-btn--signal" data-act="admin-decide-request" data-id="' + esc(r.id) + '" data-decision="approved">' + esc(T('action.approve')) + '</button> <button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="admin-decide-request" data-id="' + esc(r.id) + '" data-decision="declined">' + esc(T('action.decline')) + '</button>' : '') + '</td>' +
    '</tr>';
    return '<div class="ug-col" style="gap:18px">' +
      head(T('admin.dispatchUnitsTitle'), T('admin.dispatchUnitsSub'),
        /* a new unit invites its first admin account, so it is a Super Admin action */
        superAdmin ? '<button class="ug-btn ug-btn--signal ug-btn--sm" data-act="admin-create-unit">' + I('plus', 14) + esc(T('action.newUnit')) + '</button>' : '') +
      '<div class="ug-card" style="overflow:hidden"><table class="ug-table">' +
      '<thead><tr><th>' + esc(T('label.name')) + ' / ' + esc(T('label.address')) + '</th><th>' + esc(T('label.type')) + '</th><th>' + esc(T('label.contact')) + '</th><th>' + esc(T('label.status')) + '</th><th>' + esc(T('label.active')) + '</th><th class="t-right">' + esc(T('label.actions')) + '</th></tr></thead>' +
      '<tbody>' + (units.length ? units.map(unitRow).join('') : '<tr><td colspan="6" style="text-align:center;padding:20px">' + esc(T('admin.noUnits')) + '</td></tr>') + '</tbody></table></div>' +
      head(T('admin.supportRequestInbox'), T('admin.supportRequestInboxSub')) +
      '<div class="ug-card" style="overflow:hidden"><table class="ug-table">' +
      '<thead><tr><th>' + esc(T('label.when')) + '</th><th>' + esc(T('label.unit')) + '</th><th>' + esc(T('label.kind')) + '</th><th>' + esc(T('label.details')) + '</th><th>' + esc(T('label.status')) + '</th><th class="t-right">' + esc(T('label.action')) + '</th></tr></thead>' +
      '<tbody>' + (requests.length ? requests.map(requestRow).join('') : '<tr><td colspan="6" style="text-align:center;padding:20px">' + esc(T('admin.noSupportRequests')) + '</td></tr>') + '</tbody></table></div>' +
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
