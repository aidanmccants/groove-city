# Groove City to-do

Add ideas anywhere, as `- [ ] your idea`. Claude reads this file before each round of work and ticks items off as they ship. The design behind these items is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Done
- [x] Update pop-up shown once, the first time you log in
- [x] Fixed every doorway and gave each building a sensible entrance
- [x] Money system, with the balance on screen
- [x] Chick-fil-A job: stand behind the counter and hand out sandwiches for $1 each; walkers come to buy and leave sad if they aren't served
- [x] Sandwich hand-over animation
- [x] Rent any car for $5/min; driver's-seat or top-down view
- [x] Hitting pedestrians knocks them over
- [x] NPC cops: speeding (25 mph within 20 ft) means you're pulled over and get a $10 ticket
- [x] Negative balance: 10 minutes to earn it back at CFA, or you're kicked and reset
- [x] Drive a cop car to become a cop; $5 per pull-over
- [x] Proper train tracks, a freight train every so often, crossing gates
- [x] Traffic lights; running a red near a cop gets you pulled over
- [x] PNC Bank on Broad Street: bank building and interior, smash the vault for $100
- [x] Bank chase: cops within 50 ft chase you for 2 min (on foot or by car), and getting caught or hit means you're kicked; no flying away
- [x] Everything synced for all players: trains, lights, cars, NPC traffic
- [x] Favicon
- [x] Xbox controller support (Gamepad API)
- [x] On-screen hints show Xbox buttons when you're using a controller
- [x] Controller cursor on the map screen
- [x] Double-tap A to fly
- [x] Fullscreen button
- [x] Saved the CFA reference photos (`reference/cfa/`)
- [x] Added `youtube_uploader_mcp.log` to .gitignore
- [x] Chick-fil-A redesigned to look like the real one in the photos

## In progress
- [ ] Quick fixes from your ideas (brake lights, police livery, cops on the map, minimap clipping)

## Up next: restructure (Phase 1)
- [ ] Split the single game file into modules (no gameplay change)
- [ ] Map data as a separate file, so the Worker stays small
- [ ] Map system: the game loads one map at a time, with a loading screen between maps
- [ ] Every building is its own entity with an ID, easy to edit, expand or restyle
- [ ] One input system for keyboard and mouse, touch and controller

## Accounts and players
- [ ] Accounts with a username and password (password hashed and stored in a database, hash checked at login)
- [ ] Users pick their own username
- [ ] Chat between players
- [ ] Account attributes that are easy to add and scale (money, score, age, name, statuses, …)
- [ ] Money handled by the server, so it can't be cheated

## Maps and buildings
- [ ] Each map is separate; the server holds the map's objects and the browser draws them, so everyone sees the same thing
- [ ] Walking into a building loads its interior as its own small map
- [ ] Move the CFA and bank interiors into their own maps
- [ ] Houses can be bought and sold and belong to a user
- [ ] Entering your house loads a standard house interior (the same default for everyone)
- [ ] Item shop for decorating your house
- [ ] Broad Street Gambling House, where Crimson Vapes was: a well-designed building with roulette, blackjack and slots inside; in-game money only
- [ ] Park cop cars around town and at the police station so players can become cops
- [ ] Bus to Slippery Rock, and a Slippery Rock map that looks normal but is a drunken-wasteland parody (idea only for now, don't build)

## Jobs and money
- [ ] More jobs at the shops: gas stations, Little Caesars, etc.
- [ ] ATM: talk to it to deposit and withdraw, with ATM animations
- [ ] Money in the bank is kept when you die; money you're carrying is lost
- [ ] Car rentals deduct money as you drive, every 10 s at $5/min (83¢ per 10 s)
- [ ] Cars need gas; fill up at the Marathon, with a gas-pump animation

## Feel and presentation
- [ ] Day/night cycle, the same for everyone; on-screen clock; sunrise, sunset, stars and moon; 20 minutes per full day
- [ ] Sound gets quieter with distance (train, cars, etc.)
- [ ] Gentle background music, something like Minecraft's
- [ ] Car engine sounds that rev
- [ ] Animated ticket cutscene with goofy, over-the-top characters
- [ ] Dying: show "Unalived" with a Respawn button instead of kicking you straight out; respawning sets carried money to 0 and keeps bank money
- [ ] Streets like a walkability nerd would design them: bike lanes, traffic calming, good street design (better than the real Grove City)
- [ ] A "What to do" menu explaining everything on the map
- [ ] All UI/UX makes sense and is accessible on mobile, controller and keyboard and mouse

## Competitive and replay
- [ ] Leaderboards (net worth, top cop, most wanted, sandwich streak)
- [ ] Weekly titles, such as Mayor (top earner) and Chief (top cop)
- [ ] Daily jobs board and streaks
- [ ] Cops vs robbers bounties; co-op heists
- [ ] Property market, races, events (see the idea list in ARCHITECTURE.md)

## Scale
- [ ] Keep everything ultra compact and lightweight; make sure the Worker and database won't run out of space
- [ ] Easy to expand: new maps, buildings, jobs and attributes should each be a small addition

## Known bugs (from testing)
- [ ] Bank: cops are often out of range when the robbery starts
- [ ] Cops on foot run through walls; chase cars bump into buildings
- [ ] Players who join mid-chase don't see the chase
- [ ] NPC cars overlap each other and pass through your car
- [ ] NPC cops don't pull over NPC drivers
- [ ] Off-route cops drive in straight lines instead of along roads
- [ ] Front wheels don't turn when steering
- [ ] Measure frame rate in a normal browser window
- [ ] $1 showed up twice with no sandwich served (seen once in testing)
- [ ] Decide the starting money ($10 was a placeholder)
- [ ] Deploy to the live site (`npm run deploy` in `worker/`)

## Your ideas
- [ ] Cars need break lights
- [ ] cop cars should say "groove city police"
- [ ] cops should show up on the map when chasing you with little  lights blinking. 
- [ ] hud map is clipping, make it not clip? 
- [ ] fix the bridges, they look like they're falling in the ocean, and just do a whole urbansim street design
