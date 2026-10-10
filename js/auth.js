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
      disabled: !!p.disabled
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
      title: info.label,
      barangay: profile.barangay || '',
      barangay_id: profile.barangay_id || null,
      scope: info.scope(profile.barangay)
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
    const { error } = await c.auth.resend({ type: 'signup', email: email, options: { emailRedirectTo: UG_CONFIG.APP_PUBLIC_URL } });
    if (error) throw new Error(UG_UTIL.authError(error.message, error.status));
    return { sent: true };
  }

  /* ------------------------------------------------------ forgot / recovery */
  /* Always resolves the same way so we never reveal which emails exist. */
  async function resetPassword(email) {
    const c = Repo.client();
    if (c) {
      try { await c.auth.resetPasswordForEmail(email, { redirectTo: UG_CONFIG.APP_PUBLIC_URL }); }
      catch (e) { /* swallow: the UI must stay neutral */ }
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
    resendConfirmation, signOut, loadProfile
  };
})();
