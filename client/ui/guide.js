/* ---------------- What to do: a guide to everything on the map (G, or the ? button); the music switch lives here too ---------------- */
const GUIDE_ITEMS = [
  ['🥪', 'Chick-fil-A counter', 'Step behind the counter in Breen Student Union to start a shift. Hand out sandwiches with E (or a click) for $1 each.'],
  ['🚗', 'Rent a car', 'Look at a parked car and press E to rent it: $5 a minute, billed every 10 seconds. Press E or F to get out and hand it back.'],
  ['⛽', 'Fill up at the Marathon', 'Stop beside a red pump outside the Marathon and press E. A full tank costs $8. A tank lasts about 6 km of driving. An empty car coasts to a stop.'],
  ['🚓', 'Become a cop', 'Get in a parked police car, then H for the siren and L for the lights. Stay behind a speeder with the siren on for 3 seconds to pull them over for $5.'],
  ['🎫', 'Speeding and red lights', 'Go over 25 mph, or run a red light, with a cop within 20 ft, and you are pulled over for a $10 ticket.'],
  ['🏦', 'PNC Bank', 'Smash the vault door for $100 (five hits). Then you are wanted for two minutes. Keep away from the police.'],
  ['🚂', 'Trains', 'A freight train runs through town on a schedule, and the gates come down before it. Wait for it to pass. You cannot drive through one.'],
  ['🚦', 'Traffic lights', 'Everyone shares the same signals. Running a red near a cop gets you pulled over.'],
  ['🌗', 'Day and night', 'One day lasts 20 minutes, and the clock at the top right is the same for everyone. The sun sets at 6 PM and rises at 6 AM. The lamps come on at night.'],
  ['🚲', 'Streets', 'The big roads have painted bike lanes and narrower car lanes. Zebra crossings sit before each signal, with curb extensions on the corners. Street trees line the main roads.'],
  ['💬', 'Chat and map', 'T or Enter to chat with everyone on the map. M opens the map.'],
];
let guideOpen = false;
function openGuide() {
  if (guideOpen || !started) return;
  const ul = $('guideList'); ul.innerHTML = '';
  for (const [icon, title, text] of GUIDE_ITEMS) {
    const li = document.createElement('li'), i = document.createElement('i'), b = document.createElement('b'), sp = document.createElement('span');
    i.textContent = icon; i.setAttribute('aria-hidden', 'true'); b.textContent = title; sp.textContent = text; li.append(i, b, sp); ul.appendChild(li);
  }
  $('guideMusic').textContent = 'Music: ' + (Music.on ? 'on' : 'off');
  guideOpen = true; keys.clear(); if (locked()) document.exitPointerLock();
  $('guide').hidden = false; $('guideOk').focus();
}
function closeGuide() {
  if (!guideOpen) return;
  guideOpen = false; $('guide').hidden = true; lockPointer();
}
$('guideOk').addEventListener('click', closeGuide);
$('guideBtn').addEventListener('click', openGuide);
$('guideMusic').addEventListener('click', () => { $('guideMusic').textContent = 'Music: ' + (Music.toggle() ? 'on' : 'off'); });
