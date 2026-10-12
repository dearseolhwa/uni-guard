/* UniGuard · authentication
 *
 * Sign in, create account, forgot and reset password. Role and barangay are
 * always read from public.profiles after the session exists. Nothing here ever
 * trusts client input or auth metadata for authorisation.
 */
const Auth = (function () {
  const LOCAL_KEY = 'uniguard.local-accounts';
  const SESSION_KEY = 'uniguard.session';

  const state = { session: null, profile: null, pendingEmail: null, recovery: false };
  const watchers = new Set();
  function onChange(fn) { watchers.add(fn); return () => watchers.delete(fn); }
  function emit() { watchers.forEach((fn) => { try { fn(state); } catch (e) {} }); }

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  function buildProfile(p, email) {
    return {
      id: p.id,
      full_name: p.full_name || (email ? email.split('@')[0] : ''),
      email: p.email || email || '',
      phone: p.phone || '',
      role: p.role || 'citizen',
      barangay_id: p.barangay_id || null,
      barangay: p.barangay || '',
      disabled: !!p.disabled,
      dispatch_unit_id: p.dispatch_unit_id || null,
      unit_role: p.unit_role || '',
      /* Super Admin is an LGU account with profiles.is_super_admin = true
         (migration 043). Before that migration the column does not exist; every
         LGU account then keeps the administration screens it has today, so
         nobody is locked out between deploying the app and running the SQL. */
      is_super_admin: (p.role === 'lgu_ldrrmc') &&
        (p.is_super_admin === true || !Object.prototype.hasOwnProperty.call(p, 'is_super_admin'))
    };
  }

  function sessionFor(profile) {
    const info = UG_WEB.ROLE_INFO[profile.role] || UG_WEB.ROLE_INFO.citizen;
    return {
      id: profile.id,
      email: profile.email,
      name: profile.full_name,
      initials: UG_UTIL.initials(profile.full_name, '?'),
      role: info.key,
      superAdmin: profile.is_super_admin === true,
      title: profile.is_super_admin === true ? UG_WEB.SUPER_ADMIN_LABEL : info.label,
      barangay: profile.barangay || '',
      barangay_id: profile.barangay_id || null,
      dispatch_unit_id: profile.dispatch_unit_id || null,
      unit_role: profile.unit_role || '',
      scope: info.scope(profile.barangay, profile)
    };
  }

  /* Load the authoritative profile row for a signed in user. */
  async function loadProfile(userId, email) {
    const c = Repo.client();
    if (!c) {
      const local = store.get(SESSION_KEY, null);
      if (local && local.profile) return buildProfile(local.profile, email);
      throw new Error('Your account could not be loaded. Contact your LGU administrator.');
    }
    const { data, error } = await c.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw new Error('Could not read your profile. ' + error.message);
    if (!data) throw new Error('Profile not found. Contact your LGU administrator to finish setting up your account.');
    return buildProfile(data, email);
  }

  async function apply(profile) {
    if (profile.disabled) {
      const c = Repo.client();
      if (c) { try { await c.auth.signOut(); } catch (e) {} }
      throw new Error('This account has been disabled. Contact your LGU administrator.');
    }
    state.profile = profile;
    state.session = sessionFor(profile);
    Repo.state.profile = profile;
    store.set(SESSION_KEY, { profile: profile, at: Date.now() });
    emit();
    return state.session;
  }

  /* ----------------------------------------------------- onboarding detection
   * An invited account (barangay_official, lgu_ldrrmc, dispatch_team) lands
   * here after accepting the email invitation. The edge function auto-set
   * full_name to the email prefix and the account has no password yet (the
   * invite flow creates the auth user but doesn't set a password). We detect
   * this state so the app can show the onboarding screen instead of dropping
   * them into the dashboard with a placeholder name. */
  function needsOnboarding(profile, email) {
    if (!profile) return false;
    /* only non-citizen roles go through onboarding (citizens self-signup with
       their full name during the signup form, so they're already complete) */
    if (profile.role === 'citizen') return false;
    /* if full_name is empty or matches the email prefix, the user hasn't
       filled in their real name yet → onboarding needed */
    const emailPrefix = (email || profile.email || '').split('@')[0].toLowerCase();
    const fullName = (profile.full_name || '').trim().toLowerCase();
    if (!fullName || fullName === emailPrefix) return true;
    return false;
  }

  /* Load the dispatch unit name for a dispatch_team profile so the onboarding
   * screen can show "You are the Unit Administrator of Lingayen BFP". */
  async function loadUnitName(profile) {
    if (!profile || profile.role !== 'dispatch_team' || !profile.dispatch_unit_id) return null;
    const c = Repo.client();
    if (!c) return null;
    try {
      const { data } = await c.from('dispatch_units')
        .select('name, unit_type').eq('id', profile.dispatch_unit_id).maybeSingle();
      return data || null;
    } catch (e) { return null; }
  }

  /* ------------------------------------------------- complete onboarding
   * Called when the invited user fills in the onboarding form. Sets their
   * password via Supabase Auth (only if they entered one — if they already
   * have a password set by the LGU in the dashboard, they can leave it
   * blank to keep it), then updates their profile (full_name, phone,
   * barangay_id), then reloads the profile and enters the app. */
  async function completeOnboarding(input) {
    const c = Repo.client();
    if (!c) throw new Error('Connect Supabase to complete onboarding.');
    /* 1. set the password on the auth user (only if provided). If the user
       already has a password (set by the LGU in the Supabase dashboard),
       they can leave the password field blank to keep their current one. */
    if (input.password && input.password.length > 0) {
      const { error: pwErr } = await c.auth.updateUser({ password: input.password });
      if (pwErr) throw new Error(UG_UTIL.authError(pwErr.message, pwErr.status));
    }
    /* 2. update the profile (full_name + phone + barangay_id for officials).
       We can update our own profile row directly — RLS allows it for the
       authenticated user updating their own row. */
    const patch = {
      full_name: input.name,
      phone: input.phone || '',
      updated_at: new Date().toISOString()
    };
    if (input.barangay_id) {
      patch.barangay_id = input.barangay_id;
      /* look up the barangay name so the profile is complete */
      try {
        const { data: b } = await c.from('barangays').select('name').eq('id', input.barangay_id).maybeSingle();
        if (b) patch.barangay = b.name;
      } catch (e) {}
    }
    const { error: upErr } = await c.from('profiles').update(patch).eq('id', state.profile.id);
    if (upErr) throw new Error('Could not update your profile: ' + upErr.message);
    /* 3. reload the profile so the session reflects the new name, then apply */
    const updated = await loadProfile(state.profile.id, state.profile.email);
    return apply(updated);
  }

  /* --------------------------------------------------------------- sign in */
  async function signIn(email, password) {
    const c = Repo.client();
    if (!c) {
      const list = store.get(LOCAL_KEY, []) || [];
      const acc = list.find((a) => String(a.email).toLowerCase() === String(email).toLowerCase());
      if (!acc) throw new Error('No account found for that email.');
      if (acc.password !== password) throw new Error('invalid login credentials');
      return apply(buildProfile({
        id: acc.id || 'local', full_name: acc.full_name, email: acc.email, phone: acc.phone,
        role: acc.role || 'citizen', barangay: acc.barangay || ''
      }, email));
    }

    const { data, error } = await c.auth.signInWithPassword({ email: email, password: password });
    if (error) throw new Error(UG_UTIL.authError(error.message, error.status));
    const profile = await loadProfile(data.user.id, data.user.email);
    return apply(profile);
  }

  /* --------------------------------------------------------- create account */
  /* Self signup always produces a citizen. Role is forced server side and here. */
  async function signUp(input) {
    const c = Repo.client();
    if (!c) {
      const list = store.get(LOCAL_KEY, []) || [];
      if (list.some((a) => String(a.email).toLowerCase() === String(input.email).toLowerCase())) {
        throw new Error('already registered');
      }
      const acc = {
        id: 'local-' + Date.now(), email: input.email, password: input.password,
        full_name: input.fullName, phone: input.phone, role: 'citizen', barangay: input.barangay
      };
      list.push(acc);
      store.set(LOCAL_KEY, list);
      state.pendingEmail = input.email;
      /* With no project configured there is no mail service, so the account is
         usable straight away. A configured project always uses the email flow. */
      return apply(buildProfile(acc, input.email));
    }

    const { data, error } = await c.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: UG_CONFIG.APP_PUBLIC_URL,
        /* metadata is convenience only; the database trigger forces role citizen */
        data: { full_name: input.fullName, phone: input.phone, barangay: input.barangay }
      }
    });
    if (error) throw new Error(UG_UTIL.authError(error.message, error.status));

    state.pendingEmail = input.email;

    /* the profile row is created by a trigger on auth.users */
    if (data && data.session && data.user) {
      try { return await apply(await loadProfile(data.user.id, data.user.email)); }
      catch (e) { /* fall through to the confirmation screen */ }
    }
    emit();
    return { needsConfirmation: true };
  }

  async function resendConfirmation(email) {
    const c = Repo.client();
    if (!c) return { local: true };
    const redirectTo = (typeof window !== 'undefined' ? window.location.origin : '') || UG_CONFIG.APP_PUBLIC_URL;
    const { error } = await c.auth.resend({ type: 'signup', email: email, options: { emailRedirectTo: redirectTo } });
    if (error) throw new Error(UG_UTIL.authError(error.message, error.status));
    return { sent: true };
  }

  /* ------------------------------------------------------ forgot / recovery */
  /* Always resolves the same way so we never reveal which emails exist.
   * The redirect URL is window.location.origin so the reset email's link
   * points back to the site the user is currently on (localhost:5500 during
   * dev, the production URL when deployed). Falls back to UG_CONFIG.APP_PUBLIC_URL
   * if window is not available. */
  async function resetPassword(email) {
    const c = Repo.client();
    if (c) {
      /* detect the rate limit before swallowing the error, so we can surface
         a helpful toast instead of silently doing nothing. Supabase returns
         a 429 with "Email rate limit exceeded" when the free-tier cap is hit. */
      const redirectTo = (typeof window !== 'undefined' ? window.location.origin : '') || UG_CONFIG.APP_PUBLIC_URL;
      try {
        const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: redirectTo });
        if (error) {
          if (/rate limit|429|too many/i.test(error.message)) {
            throw new Error('Supabase email rate limit reached. Wait 1 hour and try again, or set a temp password in the Supabase dashboard.');
          }
          /* other errors are swallowed so the UI stays neutral (never reveal
             whether the email exists) */
        }
      } catch (e) {
        if (/rate limit/i.test(e.message)) throw e;
        /* swallow everything else */
      }
    }
    return { sent: true };
  }

  async function updatePassword(newPassword) {
    const c = Repo.client();
    if (!c) {
      const local = store.get(SESSION_KEY, null);
      if (local && local.profile) {
        const list = store.get(LOCAL_KEY, []) || [];
        const acc = list.find((a) => a.email === local.profile.email);
        if (acc) { acc.password = newPassword; store.set(LOCAL_KEY, list); }
      }
      return { updated: true };
    }
    const { error } = await c.auth.updateUser({ password: newPassword });
    if (error) throw new Error(UG_UTIL.authError(error.message, error.status));
    return { updated: true };
  }

  /* Attach the auth listener once, so password recovery links open the reset screen. */
  function listen() {
    const c = Repo.client();
    if (!c || c.__uniguardListening) return;
    c.__uniguardListening = true;
    c.auth.onAuthStateChange(function (event) {
      if (event === 'PASSWORD_RECOVERY') { state.recovery = true; emit(); }
      if (event === 'SIGNED_OUT') { state.session = null; state.profile = null; emit(); }
    });
  }

  async function restore() {
    const c = Repo.client();
    listen();
    if (!c) {
      const local = store.get(SESSION_KEY, null);
      if (local && local.profile) {
        try { return await apply(buildProfile(local.profile, local.profile.email)); } catch (e) { return null; }
      }
      return null;
    }
    const { data } = await c.auth.getSession();
    if (!data || !data.session) return null;
    try {
      return await apply(await loadProfile(data.session.user.id, data.session.user.email));
    } catch (e) {
      try { await c.auth.signOut(); } catch (e2) {}
      return null;
    }
  }

  async function signOut() {
    const c = Repo.client();
    if (c) { try { await c.auth.signOut(); } catch (e) {} }
    state.session = null;
    state.profile = null;
    state.recovery = false;
    Repo.state.profile = null;
    store.del(SESSION_KEY);
    emit();
  }

  return {
    state, onChange, restore, signIn, signUp, resetPassword, updatePassword,
    resendConfirmation, signOut, loadProfile,
    needsOnboarding, loadUnitName, completeOnboarding
  };
})();
