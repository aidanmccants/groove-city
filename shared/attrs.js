// account attributes: add one line to add one; the server validates by type. money is integer cents.
export const ATTRS = {
  cash:      { type: 'cents', def: 1000, min: -100000000, max: 100000000000 },   // on your person: lost when you die
  bank:      { type: 'cents', def: 0,    min: 0,          max: 100000000000 },   // at the ATM (later): kept when you die
  debtSince: { type: 'int',   def: 0 },                                           // ms timestamp when cash went below 0 (0 = not in debt)
  served:    { type: 'int', def: 0, board: true },   // sandwiches
  tickets:   { type: 'int', def: 0 },
  pullovers: { type: 'int', def: 0, board: true },
  robberies: { type: 'int', def: 0, board: true },
};
export const defaults = () => Object.fromEntries(Object.entries(ATTRS).map(([k, a]) => [k, a.def]));
// attrs with every ATTRS key present: numbers rounded to integers and clamped to min/max (a missing or bad value gets its default); unknown keys dropped
export function clean(attrs) {
  const src = attrs && typeof attrs === 'object' ? attrs : {};
  const out = {};
  for (const [k, a] of Object.entries(ATTRS)) {
    const v = src[k], n = v === null || v === undefined || v === '' ? NaN : Math.round(Number(v));
    const lo = a.min ?? -Number.MAX_SAFE_INTEGER, hi = a.max ?? Number.MAX_SAFE_INTEGER;
    out[k] = Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : a.def;
  }
  return out;
}
