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

    const allUsers = UG.DATA.users || [];
    /* user search box: filter by name, email, role or barangay */
    const uq = (st.userSearch || '').trim().toLowerCase();
    const users = uq
      ? allUsers.filter((u) => (u.full_name || '').toLowerCase().indexOf(uq) >= 0 ||
                                (u.email || '').toLowerCase().indexOf(uq) >= 0 ||
                                (u.role || '').toLowerCase().indexOf(uq) >= 0 ||
                                (u.barangay || '').toLowerCase().indexOf(uq) >= 0 ||
                                (u.unit_role || '').toLowerCase().indexOf(uq) >= 0)
      : allUsers;
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
      '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-rowf ug-gap8" style="gap:8px;align-items:flex-end">' +
        '<div class="ug-field" style="margin:0;flex:1;min-width:240px"><label class="ug-lab">Search accounts</label>' +
          '<input class="ug-in" data-field="userSearch" value="' + esc(st.userSearch || '') + '" placeholder="Name, email, role or barangay"></div>' +
        (st.userSearch ? '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="user-clear-search">Clear</button>' : '') +
        '<span class="ug-dimmer" style="font-size:11px;margin-left:auto">' + users.length + ' of ' + allUsers.length + ' accounts</span>' +
      '</div></div>' +
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
      if (st.auditRole && st.auditRole !== 'All') {
        const r = (a.actor_role === 'super_admin' ? 'super_admin' : (a.actor_role || ''));
        if (r !== st.auditRole) {
          /* "lgu_ldrrmc" filter should also include super_admin (super_admin is
             a tier of lgu_ldrrmc, but in this view we surface them distinctly) */
          if (!(st.auditRole === 'lgu_ldrrmc' && r === 'lgu_ldrrmc')) return false;
        }
      }
      if (st.auditAction && st.auditAction !== 'All') {
        /* action type bucketing: group similar actions (create / edit / delete / status / role / etc) */
        const bucket = actionBucket(a.action || '');
        if (bucket !== st.auditAction) return false;
      }
      if (st.auditBarangay && st.auditBarangay !== 'All') {
        if ((a.actor_barangay || '') !== st.auditBarangay) return false;
      }
      const t = a.created_at ? new Date(a.created_at).getTime() : null;
      if (from !== null && t !== null && t < from) return false;
      if (to !== null && t !== null && t > to) return false;
      if (q && (actorOf(a) + ' ' + (a.action || '') + ' ' + entityLabel(a.entity) + ' ' + describe(a)).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }

  /* action type bucket: groups similar actions (e.g. reports.update, advisories.update → "edit") */
  function actionBucket(action) {
    if (!action) return 'other';
    const a = action.toLowerCase();
    if (/\.create|\.insert|invited|received|published|fanned_out|member_invited/.test(a)) return 'create';
    if (/\.update|\.edit|role_changed|barangay_changed|status_changed/.test(a)) return 'edit';
    if (/\.delete|\.deleted/.test(a)) return 'delete';
    if (/verified|lgu-?verify|verify/.test(a)) return 'verify';
    if (/dispatch|advance|resolved|rejected|disabled|enabled|deactivated/.test(a)) return 'status';
    return 'other';
  }

  /* readable label for the actor's role */
  const ROLE_LABEL_AUDIT = {
    citizen: 'Citizen',
    barangay_official: 'Barangay Official',
    lgu_ldrrmc: 'LDRRMO Staff',
    super_admin: 'Super Admin',
    dispatch_team: 'Dispatch Team',
    '': 'System'
  };
  const roleLabelAudit = (r) => ROLE_LABEL_AUDIT[r] || (r ? r.replace(/_/g, ' ') : 'System');

  /* readable label for the action bucket */
  const ACTION_LABEL_AUDIT = {
    create: 'Create', edit: 'Edit / Update', delete: 'Delete',
    verify: 'Verify', status: 'Status / Dispatch', other: 'Other'
  };

  function audit(st) {
    const TITLE = T('title.audit'), SUB = T('admin.auditSub');
    if (!isSuper(st)) return superOnly(TITLE);
    if (st.loading) return '<div class="ug-col" style="gap:16px">' + head(TITLE, SUB) + statePanel('loading') + '</div>';
    if (st.error) return '<div class="ug-col" style="gap:16px">' + head(TITLE, SUB) +
      statePanel('error', T('admin.auditCouldNotLoad'), st.error,
        '<button class="ug-btn ug-btn--sm" data-act="admin-load" style="margin-top:10px">' + esc(T('action.tryAgain')) + '</button>') + '</div>';

    const all = UG.DATA.audit || [];
    const filtered = filterAudit(st);
    const page = st.auditPage || 1;
    const pageSize = st.auditPageSize || 25;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const curPage = Math.min(page, totalPages);
    const rows = filtered.slice((curPage - 1) * pageSize, curPage * pageSize);
    const uniq = (list) => list.filter((v, i) => v && list.indexOf(v) === i).sort();
    const entities = uniq(all.map((a) => a.entity || ''));
    const actors = uniq(all.map(actorOf));
    const brgys = uniq(all.map((a) => a.actor_barangay || ''));
    const opt = (v, label, cur) => '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' + esc(label) + '</option>';
    const fld = (label, inner, style) => '<div class="ug-field" style="margin:0;' + (style || '') + '"><label class="ug-lab">' + label + '</label>' + inner + '</div>';

    const filters = '<div class="ug-card"><div class="ug-card-b ug-col" style="gap:12px">' +
      '<div class="ug-rowf ug-gap12 ug-wrap" style="gap:12px;align-items:flex-end">' +
        fld(T('action.search'), '<input class="ug-in" data-field="auditQ" value="' + esc(st.auditQ || '') + '" placeholder="' + esc(T('label.search')) + '">', 'flex:1;min-width:200px') +
        fld(T('admin.auditRecordType'), '<select class="ug-sel" data-field="auditEntity">' + opt('All', T('admin.auditAllRecords'), st.auditEntity || 'All') +
          entities.map((e) => opt(e, entityLabel(e), st.auditEntity)).join('') + '</select>', 'min-width:170px') +
        fld(T('admin.auditActionType'), '<select class="ug-sel" data-field="auditAction">' + opt('All', T('admin.auditAllActions'), st.auditAction || 'All') +
          Object.keys(ACTION_LABEL_AUDIT).map((k) => opt(k, ACTION_LABEL_AUDIT[k], st.auditAction)).join('') + '</select>', 'min-width:140px') +
        fld(T('admin.auditChangedBy'), '<select class="ug-sel" data-field="auditActor">' + opt('All', T('admin.auditEveryone'), st.auditActor || 'All') +
          actors.map((n) => opt(n, n, st.auditActor)).join('') + '</select>', 'min-width:170px') +
      '</div>' +
      '<div class="ug-rowf ug-gap12 ug-wrap" style="gap:12px;align-items:flex-end">' +
        fld(T('admin.auditRole'), '<select class="ug-sel" data-field="auditRole">' + opt('All', T('admin.auditAllRoles'), st.auditRole || 'All') +
          opt('super_admin', T('admin.roleSuperAdmin'), st.auditRole) +
          opt('lgu_ldrrmc', T('admin.roleLgu'), st.auditRole) +
          opt('barangay_official', T('admin.roleBarangay'), st.auditRole) +
          opt('dispatch_team', T('admin.roleDispatch'), st.auditRole) +
          opt('citizen', T('admin.roleCitizen'), st.auditRole) +
          opt('system', 'System', st.auditRole) +
          '</select>', 'min-width:170px') +
        fld(T('admin.auditBarangay'), '<select class="ug-sel" data-field="auditBarangay">' + opt('All', T('admin.auditAllBarangays'), st.auditBarangay || 'All') +
          brgys.map((b) => opt(b, b, st.auditBarangay)).join('') + '</select>', 'min-width:170px') +
        fld(T('admin.from'), '<input class="ug-in" type="date" data-field="auditFrom" value="' + esc(st.auditFrom || '') + '">') +
        fld(T('admin.to'), '<input class="ug-in" type="date" data-field="auditTo" value="' + esc(st.auditTo || '') + '">') +
        '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="audit-clear">' + esc(T('action.clear')) + '</button>' +
      '</div></div>';

    const body = rows.map((a) => '<tr data-act="open-audit" data-id="' + esc(a.id) + '" style="cursor:pointer" title="' + esc(T('admin.auditOpenRecord')) + '">' +
      '<td class="t-num" style="white-space:nowrap">' + esc(UG_UTIL.absTime(a.created_at) || UG_UTIL.relTime(a.created_at)) + '</td>' +
      '<td><div style="font-weight:600">' + esc(actorOf(a)) + '</div>' +
        '<div class="ug-dimmer" style="font-size:10.5px">' + esc(roleLabelAudit(a.actor_role === 'super_admin' ? 'super_admin' : a.actor_role)) + (a.actor_barangay ? ' · ' + esc(a.actor_barangay) : '') + '</div></td>' +
      '<td>' + esc(entityLabel(a.entity)) + '</td>' +
      '<td><span class="ug-badge ug-badge--id">' + esc(a.action) + '</span></td>' +
      '<td style="font-size:11.5px;max-width:420px">' + esc(describe(a) || '—') + '</td>' +
      '</tr>').join('');

    /* pagination row */
    const pagination = totalPages > 1
      ? '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-rowf ug-between" style="gap:10px;font-size:12px;align-items:center">' +
          '<span class="ug-dim">Page ' + curPage + ' of ' + totalPages + ' · ' + filtered.length + ' entries match the filters</span>' +
          '<div class="ug-rowf ug-gap6" style="gap:6px">' +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + (curPage <= 1 ? ' disabled' : '') + ' data-act="audit-page" data-p="' + Math.max(1, curPage - 1) + '">Prev</button>' +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + (curPage >= totalPages ? ' disabled' : '') + ' data-act="audit-page" data-p="' + Math.min(totalPages, curPage + 1) + '">Next</button>' +
          '</div></div></div>'
      : (filtered.length ? '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-rowf ug-between" style="gap:10px;font-size:12px;align-items:center">' +
          '<span class="ug-dim">' + filtered.length + ' entries match the filters</span>' +
          '<span class="ug-dimmer" style="font-size:11px">All on one page</span></div></div>' : '');

    const table = rows.length
      ? '<div class="ug-card" style="overflow:hidden"><table class="ug-table">' +
        '<thead><tr><th>' + esc(T('admin.auditWhen')) + '</th><th>' + esc(T('admin.auditWho')) + ' · ' + esc(T('admin.auditRole')) + ' · ' + esc(T('admin.auditBarangay')) + '</th><th>' + esc(T('admin.auditModule')) + '</th><th>' + esc(T('admin.auditAction')) + '</th><th>' + esc(T('admin.auditWhatChanged')) + '</th></tr></thead>' +
        '<tbody>' + body + '</tbody></table></div>'
      : (all.length
          ? statePanel('empty', T('admin.auditNoMatch'), T('admin.auditNoMatchHint'))
          : statePanel('empty', T('admin.auditNothingRecorded'), T('admin.auditNothingRecordedHint')));

    return '<div class="ug-col" style="gap:16px">' +
      head(TITLE, SUB,
        '<span class="ug-chip">' + filtered.length + ' / ' + all.length + ' ' + esc(T('admin.auditEntriesOf')) + '</span>' +
        '<button class="ug-btn ug-btn--ghost ug-btn--sm" data-act="admin-load">' + I('wave', 15) + esc(T('action.refresh')) + '</button>' +
        '<button class="ug-btn ug-btn--ghost ug-btn--sm" data-act="admin-export-audit">' + I('download', 15) + esc(T('action.exportPdf')) + '</button>') +
      filters + table + pagination +
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
   *
   * Oct 24 2026 additions:
   *   B1 — each dispatch row now has an inline roster picker using the
   *        existing assign-responder action (only this barangay's
   *        available responders). The trigger sync_responder_duty still
   *        sets On duty on assignment and back to Available on close
   *        (release_on_close).
   *   A1 — a "Can't respond" button on each open dispatch.
   *   A2 — a status chip + a "Need help" button on each open dispatch.
   *   B4 — a "Beyond our capacity" button on each open dispatch.
   *   D2 — shelter patrol list (LGU/official sees the toggle; the PNP
   *        console reads it).
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

    /* B1: available responders for this barangay, for the inline picker.
       Only 'available' responders can be assigned; the sync_responder_duty
       trigger sets them On duty on assignment. */
    const availResponders = responders.filter((r) => (r.status || 'available') === 'available');

    const dispatchRow = (d) => {
      const open = d.dispatch_status && !['done','declined'].includes(d.dispatch_status);
      const statusBadge = U.badge(
        d.dispatch_status === 'declined' ? 'closed'
          : d.dispatch_status === 'on_hold' ? 'warning'
          : d.dispatch_status === 'done' ? 'prepared'
          : 'open',
        d.dispatch_status || (d.done_at ? 'done' : 'sent')
      );
      /* B1: the inline assign-responder picker */
      const opts = ['<option value="">Assign a responder…</option>']
        .concat(availResponders.map((r) => '<option value="' + esc(r.id) + '">' + esc(r.name || '') + '</option>'))
        .join('');
      const roster = open
        ? '<div class="ug-rowf" style="gap:6px;margin-top:6px">' +
            '<select class="ug-sel-inline" style="flex:1;max-width:none" data-field="assignResponder" data-dispatch="' + esc(d.id) + '">' + opts + '</select>' +
            '<button class="ug-btn ug-btn--sm ug-btn--signal" data-act="assign-responder" data-id="' + esc(d.report_id || '') + '">Assign</button>' +
          '</div>'
        : '';
      /* A1 / A2 / B4 actions */
      const canAct = open && (me.role === 'barangay_official' || isLgu);
      const actions = canAct
        ? '<div class="ug-rowf ug-gap6" style="gap:6px;margin-top:6px;flex-wrap:wrap">' +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="dispatch-decline" data-id="' + esc(d.id) + '" data-report-id="' + esc(d.report_id || '') + '">Can\'t respond</button>' +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="dispatch-help-new" data-id="' + esc(d.id) + '" data-report-id="' + esc(d.report_id || '') + '">Need help</button>' +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="dispatch-beyond-capacity" data-id="' + esc(d.id) + '" data-report-id="' + esc(d.report_id || '') + '">Beyond capacity</button>' +
          '</div>'
        : '';
      return '<tr>' +
        '<td class="t-num">' + esc(UG_UTIL.absTime(d.dispatched_at) || '') + '</td>' +
        '<td>' + esc(d.team) + '</td>' +
        '<td class="ug-dimmer" style="font-size:11px">' + esc(d.instructions || '') + '</td>' +
        '<td>' + esc(d.dispatched_by_name || '') + '</td>' +
        '<td>' + statusBadge + '</td>' +
        '<td style="min-width:240px">' + roster + actions + '</td>' +
      '</tr>';
    };

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

    /* D2: shelters needing patrol (LGU + the barangay's officials can
       toggle the flag through the existing center-edit modal; everyone
       reads the list. PNP sees it on its own console — we expose it
       here too for the Response Team to coordinate. */
    const patrolShelters = (UG.DATA.centers || [])
      .filter((c) => c.needs_patrol === true);
    const patrolRow = (c) => '<tr>' +
      '<td><div style="font-weight:600">' + esc(c.name || '') + '</div>' +
        '<div class="ug-dimmer" style="font-size:10.5px">' + esc(c.brgy || c.barangay || '') + '</div></td>' +
      '<td class="t-num">' + (c.needs_patrol_at ? esc(UG_UTIL.absTime(c.needs_patrol_at) || '') : '—') + '</td>' +
      '<td class="t-right"><button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="center-detail" data-id="' + esc(c.uuid || c.id) + '">Open</button></td>' +
    '</tr>';

    return '<div class="ug-col" style="gap:18px">' +
      head('Barangay Response Team', 'Incoming dispatches, roster and equipment for ' + (isLgu ? 'every barangay' : 'Barangay ' + brgyName) + '.') +
      (disp.length ? '<div class="ug-card" style="overflow:hidden"><table class="ug-table"><thead><tr><th>When</th><th>Team</th><th>Instructions</th><th>By</th><th>Status</th><th>Action</th></tr></thead><tbody>' + disp.map(dispatchRow).join('') + '</tbody></table></div>'
        : statePanel('empty', 'No Response Team dispatches yet', 'When your barangay\'s Response Team is dispatched, the alert lands here.')) +
      '<div class="ug-card" style="overflow:hidden"><table class="ug-table"><thead><tr><th>Name / unit</th><th>Contact</th><th>Status</th><th class="t-right">Action</th></tr></thead><tbody>' +
        (responders.length ? responders.map(responderRow).join('') : '<tr><td colspan="4" style="text-align:center;padding:20px">No responders yet</td></tr>') + '</tbody></table></div>' +
      (patrolShelters.length ? '<div class="ug-card" style="overflow:hidden"><table class="ug-table"><thead><tr><th>Shelter needing patrol</th><th>Flagged</th><th class="t-right">Action</th></tr></thead><tbody>' + patrolShelters.map(patrolRow).join('') + '</tbody></table></div>' : '') +
      (units ? '<div class="ug-card" style="overflow:hidden"><table class="ug-table"><thead><tr><th>Unit</th><th>Type</th><th>Contact</th><th>Status</th><th class="t-right">Action</th></tr></thead><tbody>' + units + '</tbody></table></div>' : '') +
    '</div>';
  }

  /* ---------------------------------------------------------- LGU Dispatch Units
   * The LGU's municipality-wide dispatch unit console: list units, manage
   * accounts (via admin-users), the support request inbox, the dispatch
   * help-request inbox (A2, Oct 24 2026) and the relief escort list (D3).
   */
  function dispatchUnits(st) {
    const allUnits = UG.DATA.dispatchUnits || [];
    const requests = UG.DATA.unitRequests || [];
    /* A2: dispatch_help_requests (per-dispatch "Need Help" messages from a
       unit or barangay official). The LGU moves them sent -> acknowledged
       -> resolved. */
    const helpReqs = UG.DATA.dispatchHelpRequests || [];
    /* D3: relief distributions with an active escort status. */
    const escortRows = (UG.DATA.relief || []).filter((r) => r.escort_status && r.escort_status !== 'none');
    /* search filter: match name, type, address or contact */
    const q = (st.unitSearch || '').trim().toLowerCase();
    const units = q
      ? allUnits.filter((u) => (u.name || '').toLowerCase().indexOf(q) >= 0 ||
                                 (u.unit_type || '').toLowerCase().indexOf(q) >= 0 ||
                                 (u.address || '').toLowerCase().indexOf(q) >= 0 ||
                                 (u.contact_number || '').toLowerCase().indexOf(q) >= 0)
      : allUnits;
    /* Power hierarchy (per the DOCX issue list + master prompt):
     *  - Super Admin: row click opens details, can Delete a unit (red button
     *    with confirm), can create new units, can manage Accounts. Cannot
     *    perform operational edits — operational edits belong to LGU staff.
     *  - LGU staff (non-super-admin): can edit operational details, manage
     *    accounts, but cannot Delete a unit.
     *  - The hidden red Delete button next to Edit is now visible to
     *    authorised Super Admin users with a confirmation step. */
    const superAdmin = isSuper(st);
    const canDelete = superAdmin;
    const unitRow = (u) => '<tr data-act="open-unit" data-id="' + esc(u.id) + '" style="cursor:pointer">' +
      '<td><div style="font-weight:600">' + esc(u.name) + '</div>' +
        '<div class="ug-dimmer" style="font-size:10.5px">' + esc(u.address || '') + '</div></td>' +
      '<td>' + esc(u.unit_type) + '</td>' +
      '<td>' + esc(u.contact_number || '') + '</td>' +
      '<td>' + esc(u.status || '—') + '</td>' +
      '<td>' + (u.active ? U.badge('open', T('admin.unitDetailActive')) : U.badge('closed', T('admin.unitDetailInactive'))) + '</td>' +
      '<td class="t-right"><div class="ug-rowf ug-gap6" style="gap:6px;justify-content:flex-end;flex-wrap:wrap">' +
        '<button class="ug-btn ug-btn--sm" data-act="admin-edit-unit" data-id="' + esc(u.id) + '" title="' + esc(T('action.edit')) + '">' + I('settings', 14) + esc(T('action.edit')) + '</button>' +
        '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="admin-unit-accounts" data-id="' + esc(u.id) + '" title="' + esc(T('admin.unitAccountHint')) + '">' + I('users', 14) + esc(T('admin.unitAccount')) + '</button>' +
        (canDelete ? '<button class="ug-btn ug-btn--sm" data-act="admin-delete-unit" data-id="' + esc(u.id) + '" title="' + esc(T('action.delete')) + '" style="background:linear-gradient(180deg,#EF4444 0%,#B91C1C 100%);color:#fff;border:1px solid rgba(255,255,255,.15)">' + I('x', 14) + esc(T('action.delete')) + '</button>' : '') +
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
    /* A2 row: a dispatch help request */
    const helpRow = (h) => '<tr>' +
      '<td class="t-num">' + esc(UG_UTIL.absTime(h.created_at) || '') + '</td>' +
      '<td><span class="ug-badge ug-badge--id">' + esc(h.kind) + '</span></td>' +
      '<td class="ug-dimmer" style="font-size:11px">' + esc(h.message || '') + '</td>' +
      '<td>' + esc(h.status || 'sent') + '</td>' +
      '<td class="t-right">' +
        (h.status === 'sent' ? '<button class="ug-btn ug-btn--sm ug-btn--signal" data-act="help-request-update" data-id="' + esc(h.id) + '" data-next="acknowledged">Acknowledge</button>' : '') +
        (h.status === 'acknowledged' ? '<button class="ug-btn ug-btn--sm ug-btn--signal" data-act="help-request-update" data-id="' + esc(h.id) + '" data-next="resolved">Resolve</button>' : '') +
      '</td>' +
    '</tr>';
    /* D3 row: a relief distribution with escort requested/confirmed */
    const escortRow = (r) => '<tr>' +
      '<td><div style="font-weight:600">' + esc(r.title || '') + '</div>' +
        '<div class="ug-dimmer" style="font-size:10.5px">' + esc(r.barangay || '') + '</div></td>' +
      '<td>' + U.badge(r.escort_status === 'confirmed' ? 'prepared' : 'warning', r.escort_status) + '</td>' +
      '<td class="ug-dimmer" style="font-size:11px">' + esc(r.escort_note || '') + '</td>' +
      '<td>' + esc(r.escort_unit_id || '—') + '</td>' +
      '<td class="t-right">' + (r.escort_status === 'requested'
        ? '<button class="ug-btn ug-btn--sm ug-btn--signal" data-act="relief-escort-confirm" data-id="' + esc(r.id) + '">Confirm escort</button>'
        : '') + '</td>' +
    '</tr>';
    return '<div class="ug-col" style="gap:18px">' +
      head(T('admin.dispatchUnitsTitle'), T('admin.dispatchUnitsSub'),
        /* a new unit invites its first admin account, so it is a Super Admin action */
        superAdmin ? '<button class="ug-btn ug-btn--signal ug-btn--sm" data-act="admin-create-unit">' + I('plus', 14) + esc(T('action.newUnit')) + '</button>' : '') +
      '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-rowf ug-gap8" style="gap:8px;align-items:flex-end">' +
        '<div class="ug-field" style="margin:0;flex:1;min-width:240px"><label class="ug-lab">' + esc(T('action.search')) + '</label>' +
          '<input class="ug-in" data-field="unitSearch" value="' + esc(st.unitSearch || '') + '" placeholder="' + esc(T('label.name')) + ', ' + esc(T('label.type')) + ', ' + esc(T('label.address')) + '"></div>' +
        (st.unitSearch ? '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="unit-clear-search">' + esc(T('action.clear')) + '</button>' : '') +
      '</div></div>' +
      '<div class="ug-card" style="overflow:hidden"><table class="ug-table">' +
      '<thead><tr><th>' + esc(T('label.name')) + ' / ' + esc(T('label.address')) + '</th><th>' + esc(T('label.type')) + '</th><th>' + esc(T('label.contact')) + '</th><th>' + esc(T('label.status')) + '</th><th>' + esc(T('label.active')) + '</th><th class="t-right">' + esc(T('label.actions')) + '</th></tr></thead>' +
      '<tbody>' + (units.length ? units.map(unitRow).join('') : '<tr><td colspan="6" style="text-align:center;padding:20px">' + (st.unitSearch ? esc(T('action.search')) + ' — ' + esc(q) : esc(T('admin.noUnits'))) + '</td></tr>') + '</tbody></table></div>' +
      head(T('admin.supportRequestInbox'), T('admin.supportRequestInboxSub')) +
      '<div class="ug-card" style="overflow:hidden"><table class="ug-table">' +
      '<thead><tr><th>' + esc(T('label.when')) + '</th><th>' + esc(T('label.unit')) + '</th><th>' + esc(T('label.kind')) + '</th><th>' + esc(T('label.details')) + '</th><th>' + esc(T('label.status')) + '</th><th class="t-right">' + esc(T('label.action')) + '</th></tr></thead>' +
      '<tbody>' + (requests.length ? requests.map(requestRow).join('') : '<tr><td colspan="6" style="text-align:center;padding:20px">' + esc(T('admin.noSupportRequests')) + '</td></tr>') + '</tbody></table></div>' +
      /* A2 inbox */
      head('Dispatch help requests', 'Need Help messages from a unit or a barangay official.') +
      '<div class="ug-card" style="overflow:hidden"><table class="ug-table">' +
      '<thead><tr><th>When</th><th>Kind</th><th>Message</th><th>Status</th><th class="t-right">Action</th></tr></thead>' +
      '<tbody>' + (helpReqs.length ? helpReqs.map(helpRow).join('') : '<tr><td colspan="5" style="text-align:center;padding:20px">No help requests</td></tr>') + '</tbody></table></div>' +
      /* D3 escort list */
      head('Relief escorts', 'Distributions with a PNP escort requested or confirmed.') +
      '<div class="ug-card" style="overflow:hidden"><table class="ug-table">' +
      '<thead><tr><th>Distribution</th><th>Escort</th><th>Note</th><th>Unit</th><th class="t-right">Action</th></tr></thead>' +
      '<tbody>' + (escortRows.length ? escortRows.map(escortRow).join('') : '<tr><td colspan="5" style="text-align:center;padding:20px">No active escorts</td></tr>') + '</tbody></table></div>' +
      '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-note">' + T('admin.dispatchUnitsHint') + '</div></div>' +
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
