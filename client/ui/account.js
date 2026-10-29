/* ---------------- accounts: sign-in on the intro card, and the 👤 panel in the game ----------------
   The Worker keeps accounts (worker/src/auth.js); this file calls /api/* and shows the state. A guest's secret stays in
   localStorage (gcc.guest), so reopening the browser resumes the same guest. Where there is no account server (file://,
   the artifact preview), sign-in is skipped and the game runs single-player, as before. */
let acctOpen = false;        // the 👤 panel is open: the game stands still, as under the news or the map
let campusBooted = false;    // the world is built; ENTER also needs an account, or a fact that there is no server
const GUEST_KEY = 'gcc.guest';
const NET_ERR = "Can't reach the sign-in server. Check your connection and try again.";
const setMsg = (id, msg) => { $(id).textContent = msg; };
const Account = {
  me: null,            // { id, name, guest, attrs } once signed in
  offline: false,      // no account server here: single-player
  checked: false,      // the first /api/me answer has come in
  busy: false,
  formMode: null,      // 'login' | 'signup' while that form is open on the intro card

  // one JSON request: GET, or POST when a body is given. Returns { ok, status, data }; data is null for a network error or a non-JSON reply
  async api(path, body) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 10000);
    try {
      const res = await fetch(path, {
        method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', signal: ctl.signal,
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      let data = null;
      try { data = JSON.parse(text); } catch (e) { }
      return { ok: res.ok, status: res.status, data };
    } catch (e) {
      return { ok: false, status: 0, data: null };
    } finally { clearTimeout(timer); }
  },
  // the guest secret in localStorage: a per-browser convenience, so every access is guarded
  secret() { try { return localStorage.getItem(GUEST_KEY); } catch (e) { return null; } },
  rememberSecret(s) { try { localStorage.setItem(GUEST_KEY, s); } catch (e) { } },
  forgetSecret() { try { localStorage.removeItem(GUEST_KEY); } catch (e) { } },
  bold(text) { const b = document.createElement('b'); b.textContent = text; return b; },

  // page load: a session that is still signed in, else the guest kept in this browser, else the choices
  async init() {
    if (!/^https?:$/.test(location.protocol)) return this.goOffline();
    let r = await this.api('/api/me');
    if (r.data === null) return this.goOffline();          // no answer, or not JSON (the artifact preview)
    if (r.status === 200 && r.data.me) return this.setMe(r.data.me);
    if (r.status !== 401) return this.goOffline();
    const secret = this.secret();
    if (secret) {
      r = await this.api('/api/guest/resume', { secret });
      if (r.data === null) return this.goOffline();
      if (r.status === 200 && r.data.me) return this.setMe(r.data.me);
      if (r.status === 401) this.forgetSecret();           // the server does not know this guest any more
    }
    this.checked = true; this.render();
  },
  goOffline() { this.offline = true; this.checked = true; this.render(); },
  setMe(me) { this.me = me; this.checked = true; this.render(); },

  // the intro card: who is playing, or the three choices (with the form behind log in and sign up)
  render() {
    const have = !!this.me, who = $('authWho');
    $('auth').hidden = this.offline;
    who.hidden = this.checked && !have;
    if (!this.checked) who.textContent = 'Checking sign-in…';
    else if (have) who.replaceChildren(this.me.guest ? 'Playing as ' : 'Signed in as ', this.bold(this.me.name), this.me.guest ? ' (guest)' : '');
    $('authChoices').hidden = !this.checked || have || !!this.formMode;
    $('authForm').hidden = !this.checked || have || !this.formMode;
    if (acctOpen && have) this.renderPanel();
    if (acctOpen && !have) this.closePanel();
    this.paintChip(); this.gate();
  },
  // ENTER waits for the world and for an account (or for it to be known that there is no server)
  gate() {
    const ready = campusBooted && (!!this.me || this.offline), go = $('go');
    go.setAttribute('aria-disabled', String(!ready));
    if (campusBooted) go.textContent = 'ENTER CAMPUS';
    const note = !campusBooted || !this.checked ? '' : this.offline ? "Sign-in isn't available here, so you'll play single-player." : this.me ? '' : 'Choose how to play above to enter.';
    $('goNote').textContent = note; $('goNote').hidden = !note;
  },
  campusReady() { campusBooted = true; this.gate(); },
  // the 👤 chip in the game: shown while playing signed in
  paintChip() { const c = $('acct'); c.hidden = !(started && this.me && !this.offline); c.textContent = this.me ? '👤 ' + this.me.name : ''; },

  // play as a guest: the server makes the account and sends back its secret, which this browser keeps
  async guest() {
    if (this.busy) return;
    this.busy = true; $('authGuest').disabled = true; setMsg('authErr', '');
    const r = await this.api('/api/guest', {});
    this.busy = false; $('authGuest').disabled = false;
    if (r.data === null) return setMsg('authErr', NET_ERR);
    if (!r.ok || !r.data.me) return setMsg('authErr', r.data.error || 'Could not start a guest account.');
    if (typeof r.data.secret === 'string') this.rememberSecret(r.data.secret);
    this.setMe(r.data.me);
  },
  openForm(mode) {
    const su = mode === 'signup';
    this.formMode = mode;
    $('authFormH').textContent = su ? 'Sign up' : 'Log in';
    $('authSubmit').textContent = su ? 'Sign up' : 'Log in';
    $('authPass').autocomplete = su ? 'new-password' : 'current-password';
    $('authRules').hidden = !su;
    setMsg('authErr', ''); this.render(); $('authUser').focus();
  },
  closeForm() { this.formMode = null; setMsg('authErr', ''); this.render(); $('authGuest').focus(); },
  async submit(e) {
    e.preventDefault();
    if (this.busy || !this.formMode) return;
    this.busy = true; $('authSubmit').disabled = true; setMsg('authErr', '');
    const r = await this.api(this.formMode === 'signup' ? '/api/signup' : '/api/login', { username: $('authUser').value.trim(), password: $('authPass').value });
    this.busy = false; $('authSubmit').disabled = false;
    if (r.data === null) return setMsg('authErr', NET_ERR);
    if (!r.ok || !r.data.me) return setMsg('authErr', r.data.error || 'Could not sign in.');
    $('authPass').value = ''; this.formMode = null;
    this.setMe(r.data.me);
  },

  // the 👤 panel: a guest can save the account; anyone can log out
  openPanel() {
    if (!this.me || this.offline || !started || acctOpen || mapOpen || newsOpen) return;
    if (chatOpen) Chat.close(false);
    acctOpen = true; keys.clear(); if (locked()) document.exitPointerLock();
    setMsg('acctErr', ''); this.renderPanel(); $('acctPanel').hidden = false; $('acctClose').focus();
  },
  closePanel(relock = true) {
    if (!acctOpen) return;
    acctOpen = false;
    const a = document.activeElement; if (a && $('acctPanel').contains(a)) a.blur();   // so Space jumps instead of pressing the focused button
    $('acctPanel').hidden = true;
    if (relock) lockPointer();
  },
  renderPanel() {
    const g = !!this.me.guest;
    $('acctWho').replaceChildren(g ? 'Playing as ' : 'Signed in as ', this.bold(this.me.name), g ? ' (guest)' : '');
    $('acctGuest').hidden = !g; $('logoutWarn').hidden = !g;
  },
  async save(e) {
    e.preventDefault();
    if (this.busy) return;
    this.busy = true; setMsg('acctErr', '');
    const r = await this.api('/api/convert', { username: $('saveUser').value.trim(), password: $('savePass').value });
    this.busy = false;
    if (r.data === null) return setMsg('acctErr', NET_ERR);
    if (!r.ok || !r.data.me) return setMsg('acctErr', r.data.error || 'Could not save the account.');
    this.forgetSecret();
    $('savePass').value = '';
    this.me = r.data.me;
    this.render();
    toast('Account saved as ' + this.me.name);
    reconnectNet();   // the room learns the new name from a fresh connection
  },
  async logout() {
    if (this.busy) return;
    this.busy = true; setMsg('acctErr', '');
    const r = await this.api('/api/logout', {});
    this.busy = false;
    if (r.data === null) return setMsg('acctErr', NET_ERR);
    location.reload();
  },
  // the socket never opened and /api/me says 401: the session has ended
  async sessionEnded() {
    const r = await this.api('/api/me');
    if (r.status !== 401) return false;
    this.me = null; this.render();
    toast('Session expired — reload to sign in', 'bad');
    return true;
  },
};

$('authGuest').addEventListener('click', () => Account.guest());
$('authLogin').addEventListener('click', () => Account.openForm('login'));
$('authSignup').addEventListener('click', () => Account.openForm('signup'));
$('authBack').addEventListener('click', () => Account.closeForm());
$('authForm').addEventListener('submit', e => Account.submit(e));
$('acct').addEventListener('click', () => Account.openPanel());
$('saveForm').addEventListener('submit', e => Account.save(e));
$('logoutBtn').addEventListener('click', () => Account.logout());
$('acctClose').addEventListener('click', () => Account.closePanel());
$('acctPanel').addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); Account.closePanel(); } });   // Esc from inside a text box
Account.init().catch(() => Account.goOffline());
