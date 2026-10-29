/* ---------------- profile & bank: the player's money and flags ----------------
   Game code only talks to Profile, never to storage. Storage is an adapter { id, load() -> state | null, save(state) }.
   Today that is LocalStore: localStorage keyed by a profile id made up in this browser (memory only if storage is blocked).
   When accounts arrive, a server-backed adapter with the same shape goes in through Profile.useStore(adapter) and no game
   code changes. Money may go negative; debtSince marks when, and after DEBT_GRACE the player is kicked and reset. */
const CURRENT_UPDATE_ID = '2026-11-jobs-cars-trains';
// shared clock: the Worker's time (welcome / pong) minus ours; trains, lights and NPC traffic all run on netNow()
let clockOffset = 0, clockRtt = 1e9;
const netNow = () => Date.now() + clockOffset;
const START_MONEY = 10, DEBT_GRACE = 10 * 60 * 1000, LOG_MAX = 50;
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
  const fresh = () => ({ version: 1, money: START_MONEY, seenUpdate: null, debtSince: null, earned: 0, spent: 0, created: Date.now() });
  const cents = v => Math.round(v * 100) / 100;
  let store = LocalStore, state = Object.assign(fresh(), store.load() || {});
  const log = [], subs = new Set();   // log: recent transactions, this session only
  const commit = tx => {
    if (state.money < 0) { if (state.debtSince == null) state.debtSince = Date.now(); } else state.debtSince = null;
    try { store.save(state); } catch (e) { console.error(e); }
    for (const f of subs) { try { f(state, tx); } catch (e) { console.error(e); } }
  };
  const record = (amount, reason, opt) => { const t = { t: Date.now(), amount, reason, balance: state.money, quiet: !!(opt && opt.quiet) }; log.push(t); if (log.length > LOG_MAX) log.shift(); return t; };
  return {
    get id() { return store.id; },
    get state() { return state; },
    log,
    balance: () => state.money,
    canAfford: amount => state.money >= amount,
    // opt.quiet: no toast (for per-second charges like rent)
    earn(amount, reason = '', opt) { amount = cents(Math.abs(+amount || 0)); state.money = cents(state.money + amount); state.earned = cents(state.earned + amount); commit(record(amount, reason, opt)); return state.money; },
    charge(amount, reason = '', opt) { amount = cents(Math.abs(+amount || 0)); state.money = cents(state.money - amount); state.spent = cents(state.spent + amount); commit(record(-amount, reason, opt)); return state.money; },
    set(patch) { Object.assign(state, patch); commit(null); },
    markSeen(updateId) { this.set({ seenUpdate: updateId }); },
    inDebt: () => state.money < 0,
    debtDeadline: () => state.debtSince == null ? null : state.debtSince + DEBT_GRACE,
    debtLeft() { const d = this.debtDeadline(); return d == null ? null : Math.max(0, d - Date.now()); },
    // a fresh start; the update popup stays dismissed
    reset() { const seen = state.seenUpdate; state = fresh(); state.seenUpdate = seen; log.length = 0; commit(record(0, 'reset')); },
    onChange(fn) { subs.add(fn); return () => subs.delete(fn); },
    useStore(adapter) { store = adapter; state = Object.assign(fresh(), adapter.load() || {}); commit(null); },
  };
})();

