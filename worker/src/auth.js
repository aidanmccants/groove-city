// Accounts, guest accounts and sessions. handleApi answers the /api/ routes; sessionUser tells /ws who is connecting.
// Passwords: PBKDF2-SHA256 through WebCrypto. Guest secrets and session tokens are random 32-byte values; only their SHA-256 is stored.

const COOKIE = 'gcs';
const SESSION_MS = 30 * 24 * 3600e3;   // a session lasts 30 days
const SEEN_EVERY_MS = 3600e3;          // users.seen is written at most once an hour per user
const START_ATTRS = '{"cash":1000}';   // $10, in cents
const ITER = 100000;                   // PBKDF2 iterations (the Workers maximum)
const MAX_BODY = 2048;                 // bytes accepted in a request body
const TOO_MANY = 'too many tries, wait a few minutes';
const BAD_BODY = 'send a JSON object of at most 2 KB';
const DUMMY_SALT = new Uint8Array(16); // hashed when the username doesn't exist, so the reply takes as long as a real check
const USER_RE = /^[A-Za-z0-9_]{3,20}$/;
const enc = new TextEncoder();

// guest display names, such as SwiftOtter42
export const ADJECTIVES = ['Brisk', 'Calm', 'Dapper', 'Eager', 'Fuzzy', 'Gentle', 'Hasty', 'Jolly', 'Keen', 'Lucky',
  'Merry', 'Nimble', 'Plucky', 'Quiet', 'Rapid', 'Sunny', 'Swift', 'Tidy', 'Vivid', 'Witty', 'Zesty',
  'Bold', 'Brave', 'Chill', 'Cosmic', 'Dizzy', 'Golden', 'Happy', 'Lively', 'Mellow', 'Peppy', 'Rustic',
  'Silly', 'Sleepy', 'Stout', 'Wacky'];
export const NOUNS = ['Otter', 'Badger', 'Falcon', 'Beaver', 'Heron', 'Walrus', 'Panda', 'Lynx', 'Moose', 'Penguin',
  'Tiger', 'Koala', 'Gopher', 'Raven', 'Wombat', 'Pelican', 'Bison', 'Ferret', 'Hedgehog', 'Narwhal',
  'Quokka', 'Sloth', 'Yak', 'Owl', 'Fox', 'Hippo', 'Lemur', 'Gecko'];
const pick = list => list[Math.floor(Math.random() * list.length)];
export const pickName = () => pick(ADJECTIVES) + pick(NOUNS) + (10 + Math.floor(Math.random() * 90));

// ---- crypto ----
const b64 = bytes => btoa(String.fromCharCode(...bytes));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
// 32 random bytes, base64url: guest secrets and session tokens
const randomToken = () => b64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
// SHA-256 as hex
async function sha256hex(str) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(str)));
  return [...d].map(b => b.toString(16).padStart(2, '0')).join('');
}
// PBKDF2-SHA256 of the password with saltBytes, 256 bits, base64
async function pbkdf2(password, saltBytes) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: ITER }, key, 256);
  return b64(new Uint8Array(bits));
}
// a new random salt and the password's hash, both base64
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: b64(salt), pass_hash: await pbkdf2(password, salt) };
}
// constant-time equality of two byte arrays
const same = (a, b) => a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b);

// ---- cookies, sessions, throttle ----
// the session cookie; Secure only on https, so the local http dev server still gets a working cookie
const cookie = (value, secure, maxAge) => `${COOKIE}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
// the session token from the Cookie header, or null
const tokenOf = request => /(?:^|;\s*)gcs=([^;]+)/.exec(request.headers.get('Cookie') || '')?.[1] ?? null;
// the caller's address as Cloudflare reports it ('local' when there is none, e.g. on the dev server)
const ipOf = request => request.headers.get('CF-Connecting-IP') || 'local';
const str = v => (typeof v === 'string' ? v : '');

// a new 30-day session for this user: the table keeps the token's hash, the cookie carries the token
async function startSession(env, userId, secure) {
  const token = randomToken();
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires) VALUES (?, ?, ?)')
    .bind(await sha256hex(token), userId, Date.now() + SESSION_MS).run();
  return cookie(token, secure, SESSION_MS / 1000);
}

// the signed-in user's row (id, name, guest_hash, attrs), or null; writes users.seen at most once an hour
async function sessionRow(request, env) {
  const token = tokenOf(request);
  if (!token) return null;
  const now = Date.now();
  const row = await env.DB.prepare(
    'SELECT u.id, u.name, u.guest_hash, u.attrs, u.seen FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires > ?'
  ).bind(await sha256hex(token), now).first();
  if (row && now - row.seen > SEEN_EVERY_MS) {
    await env.DB.prepare('UPDATE users SET seen = ? WHERE id = ?').bind(now, row.id).run();
  }
  return row;
}

// the signed-in user for /ws: { id, name, guest }, or null
export async function sessionUser(request, env) {
  const row = await sessionRow(request, env);
  return row && { id: row.id, name: row.name, guest: !!row.guest_hash };
}

// counts one attempt under `key`; true when that key is over `max` attempts in the current window
async function throttle(env, key, max = 10, windowMs = 15 * 60e3) {
  const now = Date.now();
  const row = await env.DB.prepare(
    `INSERT INTO throttle (key, n, reset) VALUES (?1, 1, ?2)
     ON CONFLICT (key) DO UPDATE SET
       n = CASE WHEN throttle.reset < ?3 THEN 1 ELSE throttle.n + 1 END,
       reset = CASE WHEN throttle.reset < ?3 THEN ?2 ELSE throttle.reset END
     RETURNING n`
  ).bind(key, now + windowMs, now).first();
  return row.n > max;
}

// ---- request and response helpers ----
// the request's JSON object, if the body is at most 2 KB; otherwise null
async function readBody(request) {
  if (Number(request.headers.get('Content-Length') || 0) > MAX_BODY) return null;
  try {
    const reader = request.body.getReader(), dec = new TextDecoder();
    let text = '', size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) { await reader.cancel(); return null; }
      text += dec.decode(value, { stream: true });
    }
    const body = JSON.parse(text + dec.decode());
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;   // not JSON, or no body at all
  }
}

// what the page is allowed to know about an account
const meOf = u => ({ id: u.id, name: u.name, guest: !!u.guest_hash, attrs: JSON.parse(u.attrs) });
const reply = (body, status = 200, setCookie = null) => {
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  if (setCookie) headers.append('Set-Cookie', setCookie);
  return new Response(JSON.stringify(body), { status, headers });
};
const fail = (status, error) => reply({ error }, status);

// why this username and password break the rules, or null when they are fine
function badCreds(username, password) {
  if (typeof username !== 'string' || !USER_RE.test(username) || /^guest/i.test(username)) {
    return 'username must be 3-20 letters, numbers or _, and not start with guest';
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) return 'password must be 8-128 characters';
  return null;
}

// ---- routes ----
// POST /api/guest: a new guest account and its secret (the browser keeps the secret; the server keeps only its hash)
async function guest(request, env, secure) {
  if (await throttle(env, 'ip:guest:' + ipOf(request))) return fail(429, TOO_MANY);
  const secret = randomToken(), now = Date.now();
  const u = await env.DB.prepare(
    'INSERT INTO users (guest_hash, name, created, seen, attrs) VALUES (?, ?, ?, ?, ?) RETURNING id, name, guest_hash, attrs'
  ).bind(await sha256hex(secret), pickName(), now, now, START_ATTRS).first();
  return reply({ secret, me: meOf(u) }, 200, await startSession(env, u.id, secure));
}

// POST /api/guest/resume {secret}: signs back in to a guest account
async function resume(request, env, secure) {
  const b = await readBody(request);
  if (!b) return fail(400, BAD_BODY);
  const u = typeof b.secret === 'string' && await env.DB.prepare(
    'SELECT id, name, guest_hash, attrs FROM users WHERE guest_hash = ?'
  ).bind(await sha256hex(b.secret)).first();
  if (!u) return fail(401, 'guest not found');
  return reply({ me: meOf(u) }, 200, await startSession(env, u.id, secure));
}

// POST /api/signup {username, password}: a new named account, signed in
async function signup(request, env, secure) {
  const b = await readBody(request);
  if (!b) return fail(400, BAD_BODY);
  if (await throttle(env, 'ip:signup:' + ipOf(request))) return fail(429, TOO_MANY);
  const bad = badCreds(b.username, b.password);
  if (bad) return fail(400, bad);
  const { salt, pass_hash } = await hashPassword(b.password);
  const now = Date.now();
  try {
    const u = await env.DB.prepare(
      'INSERT INTO users (username, pass_hash, salt, name, created, seen, attrs) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id, name, guest_hash, attrs'
    ).bind(b.username, pass_hash, salt, b.username, now, now, START_ATTRS).first();
    return reply({ me: meOf(u) }, 200, await startSession(env, u.id, secure));
  } catch (e) {
    if (/UNIQUE/.test(e.message)) return fail(409, 'that username is taken');
    throw e;
  }
}

// POST /api/login {username, password}: a wrong username and a wrong password get the same reply
async function login(request, env, secure) {
  const b = await readBody(request);
  if (!b) return fail(400, BAD_BODY);
  const username = str(b.username), password = str(b.password);
  const byIp = await throttle(env, 'ip:login:' + ipOf(request));
  const byUser = await throttle(env, 'user:login:' + username.toLowerCase());
  if (byIp || byUser) return fail(429, TOO_MANY);
  const u = await env.DB.prepare(
    'SELECT id, name, guest_hash, attrs, pass_hash, salt FROM users WHERE username = ?'
  ).bind(username).first();
  // hash even when there is no such user, so both cases take about as long
  const hash = await pbkdf2(password, u?.salt ? unb64(u.salt) : DUMMY_SALT);
  if (!u?.pass_hash || !same(unb64(hash), unb64(u.pass_hash))) return fail(401, 'wrong username or password');
  return reply({ me: meOf(u) }, 200, await startSession(env, u.id, secure));
}

// POST /api/convert {username, password}: a guest becomes a named account; the same row keeps its money
async function convert(request, env, secure) {
  const u = await sessionRow(request, env);
  if (!u) return fail(401, 'sign in first');
  if (!u.guest_hash) return fail(400, 'not a guest');
  const b = await readBody(request);
  if (!b) return fail(400, BAD_BODY);
  if (await throttle(env, 'ip:signup:' + ipOf(request))) return fail(429, TOO_MANY);
  const bad = badCreds(b.username, b.password);
  if (bad) return fail(400, bad);
  const { salt, pass_hash } = await hashPassword(b.password);
  try {
    const v = await env.DB.prepare(
      'UPDATE users SET username = ?, pass_hash = ?, salt = ?, name = ?, guest_hash = NULL WHERE id = ? RETURNING id, name, guest_hash, attrs'
    ).bind(b.username, pass_hash, salt, b.username, u.id).first();
    return reply({ me: meOf(v) });
  } catch (e) {
    if (/UNIQUE/.test(e.message)) return fail(409, 'that username is taken');
    throw e;
  }
}

// POST /api/logout: ends this session and clears the cookie
async function logout(request, env, secure) {
  const token = tokenOf(request);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256hex(token)).run();
  return reply({ ok: true }, 200, cookie('', secure, 0));
}

// GET /api/me: the signed-in account, or 401
async function whoami(request, env) {
  const u = await sessionRow(request, env);
  return u ? reply({ me: meOf(u) }) : fail(401, 'not signed in');
}

const ROUTES = {
  'POST /api/guest': guest,
  'POST /api/guest/resume': resume,
  'POST /api/signup': signup,
  'POST /api/login': login,
  'POST /api/convert': convert,
  'POST /api/logout': logout,
  'GET /api/me': whoami,
};

// answers /api/ requests; null for any other path, so the Worker carries on
export async function handleApi(request, env, url) {
  if (!url.pathname.startsWith('/api/')) return null;
  const route = ROUTES[request.method + ' ' + url.pathname];
  if (!route) {
    const otherMethod = Object.keys(ROUTES).some(k => k.endsWith(' ' + url.pathname));
    return otherMethod ? fail(405, 'method not allowed') : fail(404, 'no such route');
  }
  return route(request, env, url.protocol === 'https:');
}
