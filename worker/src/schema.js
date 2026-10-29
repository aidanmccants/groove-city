// Account tables. ensureSchema creates them on the first request of each isolate; IF NOT EXISTS makes later runs no-ops.

export const SCHEMA = [
  // a guest has guest_hash and no username; a named account has username, pass_hash and salt
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE COLLATE NOCASE,
    pass_hash TEXT,
    salt TEXT,
    guest_hash TEXT UNIQUE,
    name TEXT NOT NULL,
    created INTEGER NOT NULL,
    seen INTEGER NOT NULL,
    attrs TEXT NOT NULL DEFAULT '{}',
    ver INTEGER NOT NULL DEFAULT 0
  )`,
  // token_hash is the SHA-256 of the cookie's token; expires is epoch ms
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id)`,
  // attempts per key (ip:..., user:...) in the current window; reset is when that window ends (epoch ms)
  `CREATE TABLE IF NOT EXISTS throttle (
    key TEXT PRIMARY KEY,
    n INTEGER NOT NULL,
    reset INTEGER NOT NULL
  )`,
];

let ready = null;

// runs SCHEMA once per isolate, as one batch; if that fails, the next request tries again
export async function ensureSchema(db) {
  if (!ready) ready = db.batch(SCHEMA.map(sql => db.prepare(sql))).catch(err => { ready = null; throw err; });
  await ready;
}
