import { clean } from './attrs.js';

// every way money changes: the server applies these; offline single-player applies them locally
export const RULES = {
  'cfa.serve':     { cash: +100,  cool: 600,   stat: 'served' },
  'bank.rob':      { cash: +10000, cool: 290000, stat: 'robberies' },
  'cop.pullover':  { cash: +500,  cool: 4000,  stat: 'pullovers' },
  'ticket':        { cash: -1000, cool: 5000,  stat: 'tickets' },
  'rent.start':    { cash: -83,   cool: 2000, need: 83 },   // car rental: $5/min, billed every 10 s (83 cents)
  'rent.tick':     { cash: -83,   cool: 9000 },
  'gas.fill':      { cash: -800, cool: 2000, need: 800 },   // fill-up at a Marathon pump: $8, whatever the tank had left
  'die':           { set: { cash: 0 } },                     // unalived / kicked: cash lost, bank kept
};

// applies one rule (an entry of RULES) to attrs, pure: returns { ok, attrs, reason } with a new, cleaned attrs object.
// Cooldowns are not here: the caller keeps them (the server per socket, offline per session).
export function apply(attrs, rule, now) {
  const a = clean(attrs);
  if (!rule) return { ok: false, attrs: a, reason: 'unknown action' };
  if (rule.need && a.cash < rule.need) return { ok: false, attrs: a, reason: 'not enough money' };
  const out = { ...a, cash: a.cash + (rule.cash || 0) };
  if (rule.stat) out[rule.stat] += 1;
  if (rule.set) Object.assign(out, rule.set);
  // debtSince: now when cash goes below 0 from 0 or more; 0 again once cash is back at 0 or more
  if (out.cash < 0) { if (a.cash >= 0 || !out.debtSince) out.debtSince = now; }
  else out.debtSince = 0;
  return { ok: true, attrs: clean(out) };
}
