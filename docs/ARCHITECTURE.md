# Groove City: architecture and roadmap

This is the plan the game is being rebuilt toward. Claude designs it and Haiku agents build it, one phase at a time. Each phase has a brief. Agents must read this file first and must not drift from it without saying so.

## Principles

1. **One map at a time.** The browser loads one map: an outdoor area such as Grove City, or an interior such as a house, the casino or Chick-fil-A. Moving between them goes through a short loading screen.
2. **The server owns shared state; the browser renders.** Each map instance is one Durable Object (DO), which holds that map's objects: who is driving which car, house owners, the vault, casino tables and so on. Ambient motion (trains, traffic lights, NPC traffic, the time of day) is computed from a shared clock, so it costs no bandwidth.
3. **Everything is an entity with a stable id.** Buildings, cars, NPCs and items all have ids. Behaviour comes from data plus small modules, never from one-off code buried in a 3,000-line file.
4. **Server-authoritative economy.** The client asks the server to do things ("serve sandwich", "spin roulette"). The server checks the request, then changes the balance. The client never sets money directly.
5. **Ultra compact.** Network messages are short arrays, not verbose JSON. Money is integer cents. Map data is a static asset, not code. No frameworks.

## Layout (target)

```
shared/                 imported by both the client and the Worker
  attrs.js              attribute registry (see "Accounts")
  protocol.js           message type codes + encoders/decoders
  maps.js               map registry: id -> manifest url, kind, DO naming rule
client/
  main.js               boot, map loader, transitions
  engine/               renderer, terrain, player physics, camera, sky (day/night)
  input/                actions layer: keyboard+mouse, touch, gamepad -> the same actions; glyphs for hints
  audio/                positional sound (PannerNode), engine synth, generative music
  ui/                   HUD, menus (What to do, update notes, death screen, chat, ATM, shop)
  systems/              rail, traffic, vehicles, cops, npcs, jobs, economy client, fuel
  buildings/            styles/*.js (facade builders), registry.js (merges defaults + overrides)
  maps/grove-city/      manifest.js, buildings.js (overrides by id), roads.js (street design)
  maps/slippery-rock/   (future; context only: a "drunken wasteland" parody of Slippery Rock)
  interiors/            house.js, cfa.js, bank.js, casino.js, marathon.js, little-caesars.js ...
worker/src/
  worker.js             router: /, /assets, /api/auth/*, /ws/:mapKey
  auth.js               signup/login/logout, PBKDF2, sessions
  room.js               MapRoom DO (one class, behaviour chosen by the map manifest)
  rules/                server-side action handlers: economy, jobs, casino, property
  schema.sql            D1 schema
tools/                  map data pipeline (OSM + elevation -> maps/<id>.bin/json)
```

The client is bundled with esbuild into `worker/public/` and served as Workers static assets. Map data ships as `public/maps/<id>.json` (gzip/brotli is automatic). This also keeps the Worker script small: today the whole ~950 KB page is inlined into the Worker.

## Maps and transitions

Each map has a manifest:

```js
export default {
  id: 'grove-city', kind: 'outdoor', name: 'Grove City',
  data: '/maps/grove-city.json', spawn: 'breen-front',
  systems: ['rail', 'traffic', 'npcTraffic', 'cops', 'dayNight'],
  exits: [{ id: 'bus-slip', trigger: { x, z, r }, to: 'slippery-rock', at: 'bus-stop' }],
  music: 'calm',
};
```

- **Interiors are maps too** (`kind: 'interior'`), built by a function in `client/interiors/`.
- **DO key rule:**
  - Shared places are one room each: `cfa`, `bank`, `casino`.
  - Each house is its own room, `house:<buildingId>`, because one house is one owner's space and holds their furniture.
  - Outdoor maps shard when full: `grove-city#1`, `grove-city#2` and so on, with a cap of about 60 players per room.
- **Transition:** trigger (door or bus) → fade to a loading card → close the socket → fetch the map → open the socket to the new room → spawn at the named entry point. Player state lives on the account, so nothing is lost.

## Buildings

A building is an entity:

```js
{ id: 'gc:w123456', name: 'PNC Bank', kind: 'bank', style: 'classical', floors: 2,
  doors: [...], interior: 'bank', sale: null }
```

- Defaults are generated from OSM for every building: the id comes from the OSM way, and the kind comes from tags or a heuristic.
- `maps/grove-city/buildings.js` overrides by id. That is how a building is renamed, restyled, enlarged or given an interior.
- `kind: 'house'` buildings can be bought. The owner is stored in D1, and the price can float.
- Style builders (`brick-campus`, `classical`, `storefront`, `house`, `casino`, `gas-station` and so on) are small functions that take the footprint and options and return geometry.

## Accounts and attributes

- **Storage:** D1 (SQLite).
  - `users(id, username UNIQUE NOCASE, pass_hash, salt, created, attrs JSON, ver)`
  - `sessions(token PK, user_id, expires)`
  - `properties(building_id PK, map, owner_id, price, attrs JSON)`
  - `inventory(user_id, item_id, qty)`
  - Furniture lives in each house DO's own SQLite storage.
- **Passwords:** PBKDF2-SHA256 through WebCrypto, 100k iterations, a per-user 16-byte salt and a constant-time compare. Session: a random 32-byte token in an HttpOnly, Secure, SameSite=Lax cookie. Login is rate-limited per IP and per username.
- **The attribute registry is the scaling point.** Adding an attribute is one line:

```js
// shared/attrs.js
export const ATTRS = {
  cash:   { type: 'cents', def: 1000, onDeath: 'reset' },       // money on your person
  bank:   { type: 'cents', def: 0,    onDeath: 'keep' },        // money at the ATM
  xp:     { type: 'int',   def: 0,    public: true, board: true },
  title:  { type: 'str',   def: '',   public: true, max: 24 },
  status: { type: 'set',   def: [],   public: true },           // 'cop', 'wanted', 'drunk'...
  // age, score, reputation ... add here; the server validates by type, public ones go to other players
};
```

- Attributes live in the `attrs` JSON column.
  - **Leaderboards:** an attribute marked `board: true` also gets a generated column plus an index, so it can be ranked.
  - **Concurrency:** the `ver` column handles optimistic writes.
  - **Write cost:** the room DO caches attributes for online players and flushes them every 10 seconds, so D1 writes stay low.
- **Chat:** each room relays chat to everyone in it, capped at 200 characters and about 1 message a second, with a simple word filter. Messages are not stored.

## Scale and limits (Cloudflare)

- **The Worker script stays small**, about 100 KB of logic, once the page and map are static assets. Workers limits are 3 MB compressed on the free plan and 10 MB on paid.
- **D1** holds 500 MB per database on the free plan and 10 GB on paid. At about 400 bytes per user, 500 MB is over a million accounts.
- **DO storage** is SQLite per room. House rooms store only furniture, so a few KB each.
- **Message fan-out is the real cost.** Moves go out at 8 Hz as about 40-byte arrays, and each room is capped at about 60 players, with shards beyond that. Thousands of players means many rooms, not bigger ones.
- **Costs to watch:** DO requests (each WebSocket message counts, hibernation keeps idle rooms free) and D1 reads.

## Input and UX

- **One actions layer:** `move`, `look`, `jump`, `run`, `use`, `fly`, `map`, `menu`, `chat`, `exit`, `camera`, `siren`, `lights`, `gas`, `brake`.
- **Each device** (keyboard+mouse, touch, Xbox pad) maps to those actions.
- **Hints:** a hint is always written as `hint('use', 'to serve')`, and the glyph shown follows the last device used. Never hard-code `<kbd>E</kbd>`.
- **Touch** gets on-screen buttons of at least 44 px. Controllers get a virtual cursor in menus and on the map.
- **Accessibility:** focus outlines, readable contrast, text at 14 px or larger, and no information carried by colour alone.

## Feature list → phases

| Phase | Contents |
|---|---|
| **0 (now)** | Controller hints + map cursor + double-tap A to fly; fullscreen button; Chick-fil-A redesigned from `reference/cfa/*.jpg` |
| **1: Restructure** | Split `src/template.html` into the layout above, esbuild bundle, map data as a static asset, map manifest + loader, building registry with ids, actions-based input. **No gameplay change.** |
| **2: Accounts** | D1, sign up and log in, usernames, attribute registry, server-authoritative cash/bank in cents, chat, migrate `Profile` |
| **3: World and feel** | Synced 20-minute day/night (sun, moon, stars, on-screen clock); positional audio (train, cars); generative calm music; engine revs; fuel + Marathon gas pump animation; street redesign (bike lanes, raised crosswalks, curb extensions, street trees, calmer lanes); parked cop cars around town and at the police station; "What to do" menu |
| **4: Interiors as maps** | Loader and transitions; move CFA and the bank into interiors; standard house interior; buying and selling houses |
| **5: Death and money** | "Unalived" screen + Respawn (cash → 0, bank kept); ATM with animations to deposit and withdraw; rentals billed every 10 s at $5/min (83¢ per 10 s, the user's choice); animated ticket cutscene with goofy characters |
| **6: Jobs and casino** | Jobs at Little Caesars, the Marathon gas station and other shops; Broad Street Gambling House (where Crimson Vapes is) with roulette, blackjack and slots, in-game currency only, server RNG |
| **7: Competitive** | Leaderboards (net worth, top cop, most wanted, sandwich streak); daily and weekly challenges; seasons |
| **Later** | Item shop + house decorating; bus to Slippery Rock map (context only for now) |

## Ideas to make it worth coming back to

- **Leaderboards with titles.** The #1 earner each week becomes "Mayor", and the top cop becomes "Chief". Titles show over the player's head.
- **Cops vs robbers.** Players who are cops get a bounty for catching players who are wanted. Robbers earn more the longer they evade.
- **Heists.** A 2–4 player bank job: one player drills while others keep watch, and the payout is split.
- **Player businesses.** Buy a storefront and set prices. Other players working there earn you a cut.
- **Property market.** House prices drift with demand, so players can flip houses.
- **Races.** Time trials down Broad Street with a ghost of the current record. Speed cameras make it risky.
- **Daily jobs board.** "Serve 20 sandwiches", "Deliver 5 pizzas", "Write 3 tickets" pay a bonus and keep a streak.
- **Reputation.** Good deeds lower the cop heat on you, and crimes raise a visible wanted level.
- **Events.** A Friday-night campus party, a train-robbery event, and a snow day that changes how cars handle.
