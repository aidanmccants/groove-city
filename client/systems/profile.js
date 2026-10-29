/* ---------------- profile & bank: the player's money and flags ----------------
   Money belongs to the server when signed in. The Worker keeps the account's attributes (shared/attrs.js), sends them as
   {t: 'attrs'} messages and applies every money change (shared/economy.js). Game code speaks dollars through Profile, and
   changes money only through Econ.act(name): the client never sets money. Offline (no account, or the socket is down) the same
   rules run here on this browser's copy. That copy is always the last state the server sent, so a reconnect replaces it.
   Storage is an adapter { id, load() -> state | null, save(state) }; today that is LocalStore (localStorage, or memory if blocked).
   Money may go negative; debtSince marks when, and after DEBT_GRACE the player is kicked and reset (debt.js). */
const CURRENT_UPDATE_ID = '2026-11-accounts';
// shared clock: the Worker's time (welcome / pong) minus ours; trains, lights and NPC traffic all run on netNow()
let clockOffset = 0, clockRtt = 1e9;
const netNow = () => Date.now() + clockOffset;
const moneyClock = () => (Account.me ? netNow() : Date.now());   // debt and rule times: the server's clock when signed in
const START_MONEY = 10, DEBT_GRACE = 10 * 60 * 1000;
const startMoney = () => (Account.me ? 0 : START_MONEY);   // after a kick: signed in, the server has zeroed the cash
const LocalStore = (() => {
  const mem = {}; let ls = null;
  try { ls = window.localStorage; ls.setItem('gcc.t', '1'); ls.removeItem('gcc.t'); } catch (e) { ls = null; }
  const get = k => { try { if (ls) return ls.getItem(k); } catch (e) { } return mem[k] ?? null; };
  const set = (k, v) => { mem[k] = v; try { if (ls) ls.setItem(k, v); } catch (e) { } };
  let id = get('gcc.profile.id');
  if (!id) { id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); set('gcc.profile.id', id); }
  return {
    id, persistent: !!ls,
    load() { try { return JSON.parse(get('gcc.profile.' + id)); } catch (e) { return null; } },
    save(state) { set('gcc.profile.' + id, JSON.stringify(state)); },
  };
})();
const Profile = (() => {
  const cents = d => Math.round(d * 100);
  // a saved profile: attributes in cents (version 2); a version-1 profile kept money in dollars
  const fromSaved = raw => {
    const s = { attrs: defaults(), seenUpdate: null, created: Date.now() };
    if (!raw) return s;
    s.attrs = raw.attrs ? clean(raw.attrs) : clean({ cash: cents(raw.money == null ? START_MONEY : +raw.money), debtSince: raw.debtSince || 0 });
    s.seenUpdate = raw.seenUpdate ?? null; s.created = raw.created || s.created;
    return s;
  };
  let store = LocalStore, state = fromSaved(store.load());
  const subs = new Set();
  const commit = () => {
    try { store.save(state); } catch (e) { console.error(e); }
    for (const f of subs) { try { f(state); } catch (e) { console.error(e); } }
  };
  return {
    get id() { return store.id; },
    get state() { return state; },
    balance: () => state.attrs.cash / 100,
    canAfford: amount => state.attrs.cash >= cents(amount),
    inDebt: () => state.attrs.cash < 0,
    debtSince: () => state.attrs.debtSince || null,
    debtDeadline() { const d = this.debtSince(); return d == null ? null : d + DEBT_GRACE; },
    debtLeft() { const d = this.debtDeadline(); return d == null ? null : Math.max(0, d - moneyClock()); },
    // the server's attributes (its {t: 'attrs'} message) replace ours, and this browser keeps a copy
    server(attrs) { state = { ...state, attrs: clean(attrs) }; commit(); },
    // offline: one rule applied to this browser's copy, with the same arithmetic as the server
    applyLocal(rule) {
      const r = apply(state.attrs, rule, moneyClock());
      if (r.ok) { state = { ...state, attrs: r.attrs }; commit(); }
      return r;
    },
    markSeen(updateId) { state = { ...state, seenUpdate: updateId }; commit(); },
    // a fresh start. Signed in, the server zeroes the cash ('die'; the bank and stats are kept), and the copy follows it: no $10 back
    reset() {
      state = Account.me
        ? { ...state, attrs: apply(state.attrs, RULES.die, moneyClock()).attrs }
        : { attrs: defaults(), seenUpdate: state.seenUpdate, created: Date.now() };
      commit();
    },
    onChange(fn) { subs.add(fn); return () => subs.delete(fn); },
    useStore(adapter) { store = adapter; state = fromSaved(adapter.load()); commit(); },
  };
})();
// Econ.act(name, extra): one money change by rule name (shared/economy.js). Signed in and connected, the server applies it and
// answers {t: 'attrs', act, ok}; offline the same rule runs on this browser's copy. The chip only moves on the answer (about
// 100 ms online). extra: { quiet: no toast, done(result) } where result is { ok, reason }.
const Econ = (() => {
  // the word after the amount in the toast: "+$1 sandwich"
  const LABEL = { 'cfa.serve': 'sandwich', 'bank.rob': 'bank robbery', 'cop.pullover': 'pull-over', 'ticket': 'ticket', 'rent.start': 'car rental', 'rent.tick': 'car rental' };
  const waiting = {};   // action -> extras sent to the server and not answered yet, oldest first
  const lastRun = {};   // offline cooldowns: action -> when it last ran
  const connected = () => !!(Account.me && netSock && netSock.readyState === 1);
  // one answer, online or off: a toast for money that moved (unless quiet), then the caller's done()
  const landed = (name, res, extra) => {
    const rule = RULES[name];
    if (res.ok && rule && rule.cash && !extra.quiet && LABEL[name]) toast(`${rule.cash > 0 ? '+' : '-'}${money(Math.abs(rule.cash) / 100)} ${LABEL[name]}`, rule.cash > 0 ? '' : 'bad');
    if (!res.ok && res.reason === 'not enough money' && !extra.quiet) toast('Not enough money', 'bad');
    if (extra.done) extra.done(res);
  };
  return {
    act(name, extra = {}) {
      const rule = RULES[name];
      if (!rule) return;
      if (connected()) {
        (waiting[name] = waiting[name] || []).push(extra);
        netSock.send(JSON.stringify({ t: 'act', a: name }));
        return;
      }
      const now = moneyClock();
      if (rule.cool && now - (lastRun[name] || 0) < rule.cool) return landed(name, { ok: false, reason: 'cooldown' }, extra);
      const r = Profile.applyLocal(rule);
      if (r.ok) lastRun[name] = now;
      landed(name, { ok: r.ok, reason: r.reason }, extra);
    },
    // the server's answer to an act (net.js). Without a caller waiting (bank.rob is the server's own), the toast still shows
    answered(m) { const q = waiting[m.act] || []; landed(m.act, { ok: !!m.ok, reason: m.reason }, q.shift() || {}); },
    // a socket that closes never answers, so the callers still waiting hear 'offline'
    dropPending() {
      for (const name of Object.keys(waiting)) for (const extra of waiting[name].splice(0)) if (extra.done) extra.done({ ok: false, reason: 'offline' });
    },
  };
})();
