// Groove City College, multiplayer. The Worker serves the map page and relays
// each visitor's position to everyone else through one Durable Object (the "room").

const MAX_PLAYERS = 40;     // one room; keeps the fan-out of position updates small
const MIN_MOVE_MS = 60;     // ignore position updates arriving faster than this from one visitor
// the campus is about 1634 x 1272 m, centred on 0,0 (same coordinates as the page)
const BOUNDS = { x: 900, z: 700, yMin: -50, yMax: 700 };
const MAX_MSG = 512;        // longest message accepted from a browser
const CAR_IDS = 5000;       // parked-car ids are indexes into the page's car list
const MAX_CARS = 600;       // most moved cars remembered
const CAR_TTL = 6 * 3600 * 1000;   // a car nobody has touched for this long goes back to its stall
const EVENTS = new Set(['knock', 'po', 'pulled', 'free', 'chase', 'caught', 'calm']);   // short gameplay events relayed as-is (see the page's Vehicles.onEvt and Bank.onEvt)
const VAULT_MS = 5 * 60 * 1000;   // a robbed bank vault stays open (and empty) this long, for everyone
const RATE = { burst: 16, perSec: 8 };   // token bucket for everything except moves

const ADJECTIVES = ['Brisk', 'Calm', 'Dapper', 'Eager', 'Fuzzy', 'Gentle', 'Hasty', 'Jolly', 'Keen', 'Lucky',
  'Merry', 'Nimble', 'Plucky', 'Quiet', 'Rapid', 'Sunny', 'Swift', 'Tidy', 'Vivid', 'Witty', 'Zesty',
  'Bold', 'Brave', 'Chill', 'Cosmic', 'Dizzy', 'Golden', 'Happy', 'Lively', 'Mellow', 'Peppy', 'Rustic',
  'Silly', 'Sleepy', 'Stout', 'Wacky'];
const NOUNS = ['Otter', 'Badger', 'Falcon', 'Beaver', 'Heron', 'Walrus', 'Panda', 'Lynx', 'Moose', 'Penguin',
  'Tiger', 'Koala', 'Gopher', 'Raven', 'Wombat', 'Pelican', 'Bison', 'Ferret', 'Hedgehog', 'Narwhal',
  'Quokka', 'Sloth', 'Yak', 'Owl', 'Fox', 'Hippo', 'Lemur', 'Gecko'];

const pick = list => list[Math.floor(Math.random() * list.length)];
// a number from the client, or null if it is missing or not finite; clamped to the allowed range
const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);
const int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);

// Hibernating WebSocket room. Each socket's state (id, name, last position) lives in its
// attachment, so the room keeps working while Durable Object memory is evicted between messages.
// Cars that players have driven somewhere are kept in storage ('cars': id -> { x, z, h, d (driver id or null), t }),
// so a car stays where it was left for everyone, and the room decides who gets a car when two people grab it.
export class MapRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.cars = null;
    this.vault = null;
  }

  // the PNC Bank vault: { until (ms, server clock), by (who cracked it) }
  async loadVault() {
    if (!this.vault) this.vault = (await this.ctx.storage.get('vault')) || { until: 0, by: null };
    return this.vault;
  }

  async loadCars() {
    if (!this.cars) {
      const saved = (await this.ctx.storage.get('cars')) || {}, now = Date.now();
      this.cars = new Map(Object.entries(saved).map(([k, v]) => [+k, v]).filter(([, c]) => c.d || now - c.t < CAR_TTL));
    }
    return this.cars;
  }

  saveCars() { this.ctx.storage.put('cars', Object.fromEntries(this.cars)); }

  liveIds() { return new Set(this.ctx.getWebSockets().map(s => s.deserializeAttachment()?.id).filter(Boolean)); }

  // car id -> { x, z, h }: put it down where its driver left it and tell everyone
  park(id, x, z, h) {
    this.cars.set(id, { x, z, h, d: null, t: Date.now() });
    this.saveCars();
    this.broadcast(JSON.stringify({ t: 'car', id, x, z, h, d: null }));
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket upgrade', { status: 426 });
    }
    const [client, server] = Object.values(new WebSocketPair());
    const sockets = this.ctx.getWebSockets();
    this.ctx.acceptWebSocket(server);

    if (sockets.length >= MAX_PLAYERS) {
      server.send(JSON.stringify({ t: 'full' }));
      server.close(1013, 'room full');
      return new Response(null, { status: 101, webSocket: client });
    }

    const taken = new Set(sockets.map(s => s.deserializeAttachment()?.name));
    const me = { id: crypto.randomUUID().slice(0, 8), name: this.pickName(taken), x: null, y: null, z: null, yaw: 0, last: 0, v: -1, cy: 0, f: 0, car: null, tk: RATE.burst, tt: Date.now() };
    server.serializeAttachment(me);

    // players who have sent at least one position; the others appear once they move
    const players = sockets
      .map(s => s.deserializeAttachment())
      .filter(p => p && p.x !== null)
      .map(({ id, name, x, y, z, yaw, v, cy, f }) => ({ id, name, x, y, z, yaw, v, cy, f }));
    const live = new Set(players.map(p => p.id)), cars = [...(await this.loadCars())].map(([id, c]) => [id, c.x, c.z, c.h, c.d && live.has(c.d) ? c.d : null]);
    const vault = await this.loadVault();
    server.send(JSON.stringify({ t: 'welcome', id: me.id, name: me.name, now: Date.now(), players, cars, vault: vault.until > Date.now() ? vault : null }));
    this.broadcast(JSON.stringify({ t: 'join', id: me.id, name: me.name }), server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    if (typeof message !== 'string' || message.length > MAX_MSG) return;
    let m;
    try { m = JSON.parse(message); } catch { return; }
    if (typeof m?.t !== 'string') return;
    if (m.t === 'take' || m.t === 'park') await this.loadCars();
    if (m.t === 'rob') await this.loadVault();
    const me = ws.deserializeAttachment();
    if (!me) return;
    const now = Date.now();

    if (m.t === 'move') {
      if (now - me.last < MIN_MOVE_MS) return;
      const x = num(m.x, -BOUNDS.x, BOUNDS.x), y = num(m.y, BOUNDS.yMin, BOUNDS.yMax);
      const z = num(m.z, -BOUNDS.z, BOUNDS.z), yaw = num(m.yaw, -1e6, 1e6);
      if (x === null || y === null || z === null || yaw === null) return;
      // a car only counts if the room gave it to this visitor
      const v = me.car !== null && int(m.v, 0, CAR_IDS - 1) === me.car ? me.car : -1;
      const cy = v >= 0 ? (num(m.cy, -1e3, 1e3) ?? 0) : 0, f = v >= 0 ? (int(m.f, 0, 3) ?? 0) : 0;
      Object.assign(me, { x, y, z, yaw, v, cy, f, last: now });
      ws.serializeAttachment(me);
      const out = { t: 'move', id: me.id, x, y, z, yaw };
      if (v >= 0) Object.assign(out, { v, cy, f });
      this.broadcast(JSON.stringify(out), ws);
      return;
    }

    // everything else is rate limited
    me.tk = Math.min(RATE.burst, (me.tk ?? RATE.burst) + (now - (me.tt || now)) / 1000 * RATE.perSec); me.tt = now;
    if (me.tk < 1) { ws.serializeAttachment(me); return; }
    me.tk -= 1;

    if (m.t === 'ping') {
      ws.send(JSON.stringify({ t: 'pong', c: num(m.c, 0, 1e15) ?? 0, now }));
    } else if (m.t === 'take') {
      const id = int(m.id, 0, CAR_IDS - 1);
      if (id === null) { ws.serializeAttachment(me); return; }
      const c = this.cars.get(id);
      if ((c?.d && c.d !== me.id && this.liveIds().has(c.d)) || (!c && this.cars.size >= MAX_CARS)) {
        ws.send(JSON.stringify({ t: 'deny', id }));
      } else {
        if (me.car !== null && me.car !== id && this.cars.get(me.car)?.d === me.id) this.park(me.car, me.x ?? 0, me.z ?? 0, me.cy);
        this.cars.set(id, { x: c?.x ?? null, z: c?.z ?? null, h: c?.h ?? 0, d: me.id, t: now });
        this.saveCars();
        me.car = id;
        ws.send(JSON.stringify({ t: 'took', id }));
        this.broadcast(JSON.stringify({ t: 'car', id, d: me.id }), ws);
      }
    } else if (m.t === 'park') {
      const id = int(m.id, 0, CAR_IDS - 1), x = num(m.x, -BOUNDS.x, BOUNDS.x), z = num(m.z, -BOUNDS.z, BOUNDS.z), h = num(m.h, -1e3, 1e3);
      if (id !== null && x !== null && z !== null && h !== null && this.cars.get(id)?.d === me.id) {
        this.park(id, x, z, h);
        if (me.car === id) me.car = null;
      }
    } else if (m.t === 'rob') {
      // first to ask cracks it: everyone hears {t: 'vault', until, by}; anyone asking while it is open just gets the state back
      if (this.vault.until > now) ws.send(JSON.stringify({ t: 'vault', ...this.vault }));
      else {
        this.vault = { until: now + VAULT_MS, by: me.id };
        this.ctx.storage.put('vault', this.vault);
        this.broadcast(JSON.stringify({ t: 'vault', ...this.vault }));
      }
    } else if (m.t === 'evt') {
      const a = Array.isArray(m.a) && m.a.length <= 6 && m.a.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 1e5) ? m.a.map(n => Math.round(n * 100) / 100) : null;
      if (EVENTS.has(m.k) && a) this.broadcast(JSON.stringify({ t: 'evt', id: me.id, k: m.k, a }), ws);
    }
    ws.serializeAttachment(me);
  }

  async webSocketClose(ws, code, reason) {
    const me = ws.deserializeAttachment();
    if (me) {
      this.broadcast(JSON.stringify({ t: 'leave', id: me.id }), ws);
      if (me.car !== null && me.car !== undefined) {   // they drove off and left: the car stays where they were
        await this.loadCars();
        if (this.cars.get(me.car)?.d === me.id) this.park(me.car, me.x ?? 0, me.z ?? 0, me.cy ?? 0);
      }
    }
    try { ws.close(code, reason); } catch { /* already closed */ }
  }

  webSocketError(ws) {
    this.webSocketClose(ws, 1011, 'error');
  }

  broadcast(msg, except) {
    for (const s of this.ctx.getWebSockets()) {
      if (s === except) continue;
      try { s.send(msg); } catch { /* socket is closing; its close handler will tell the room */ }
    }
  }

  pickName(taken) {
    for (let i = 0; i < 50; i++) {
      const name = pick(ADJECTIVES) + pick(NOUNS) + (10 + Math.floor(Math.random() * 90));
      if (!taken.has(name)) return name;
    }
    return pick(ADJECTIVES) + pick(NOUNS) + crypto.randomUUID().slice(0, 4);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      return env.ROOM.get(env.ROOM.idFromName('campus')).fetch(request);
    }
    // the page and map data are static assets (public/), served before the Worker runs; this is the fallback
    return env.ASSETS.fetch(request);
  },
};
