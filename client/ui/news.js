/* ---------------- what's new: shown once per profile per update; edit UPDATE_NOTES for the next one ---------------- */
const UPDATE_NOTES = {
  title: 'Jobs, cars, traffic & a bank job',
  items: [
    ['🎮', 'Xbox controller support', 'Plug in or pair a controller. Left stick moves, right stick looks, A jumps (double-tap A to fly), LB runs, X uses (serve, smash, get in), Y flies, View opens the map, Menu goes fullscreen. Driving: RT gas, LT brake/reverse, A handbrake, Y camera, X exit, RB siren, LB lights.'],
    ['💵', 'Money & jobs', 'You now carry cash (top right). Earn it, spend it, and keep out of the red: ten minutes in debt and you start over.'],
    ['🥪', 'Work the Chick-fil-A counter', 'Step behind the counter in Breen Student Union to start a shift. Hand customers a sandwich with E or a click for $1 each. Make them wait too long and they leave unhappy.'],
    ['🚗', 'Rent any car', 'Look at a parked car and press E (or click) to rent it: $5 up front, then $5 for every started minute. W/S drive, A/D steer, Space brakes, V swaps the driver\'s seat for a top-down view, E gets you out and the car stays where you left it, for everyone.'],
    ['🚓', 'Cops & tickets', 'Police cars patrol downtown and campus. Go over 25 mph or run a red within 20 ft of a cop and you are pulled over for a $10 ticket. Mind the walkers too.'],
    ['👮', 'Become a cop', 'Get in a parked police car to go on patrol. H for the siren, L for the lights. Flagged drivers show their speed: get behind one with the siren on for 3 seconds to pull them over and earn $5.'],
    ['🌐', 'Shared with everyone', 'Other players see your car, its lights and where you park it, and everyone sees the same trains, signals and traffic.'],
    ['🚂', 'Freight trains', 'Proper tracks with a freight train that rolls through on a schedule, with crossing gates that come down.'],
    ['🚦', 'Traffic lights', 'Intersections now have working signals.'],
    ['🏦', 'Rob the PNC Bank', 'The PNC Bank on South Broad Street is open: walk in, slip past the teller counter to the vault and smash its door (E or a click, five hits) for $100. The vault stays empty for everyone for five minutes. Then you are WANTED for two minutes: any cop within 50 ft gives chase on foot or by car, and if one touches you or rams you, you lose all your money and start over. No flying until it is over.'],
    ['🚪', 'Fixed doorways', 'Every building has a proper door at ground level, facing the path, and Breen\'s doors open into the building.'],
  ],
};
let newsOpen = false;
function openNews() {
  $('newsSub').textContent = UPDATE_NOTES.title.toUpperCase();
  $('newsList').innerHTML = '';
  for (const [icon, title, text] of UPDATE_NOTES.items) {
    const li = document.createElement('li'), i = document.createElement('i'), b = document.createElement('b'), sp = document.createElement('span');
    i.textContent = icon; i.setAttribute('aria-hidden', 'true'); b.textContent = title; sp.textContent = text; li.append(i, b, sp); $('newsList').appendChild(li);
  }
  newsOpen = true; keys.clear(); if (locked()) document.exitPointerLock();
  $('news').hidden = false; $('newsOk').focus();
}
function closeNews() {
  if (!newsOpen) return;
  newsOpen = false; $('news').hidden = true; Profile.markSeen(CURRENT_UPDATE_ID); lockPointer();
}
$('newsOk').addEventListener('click', closeNews);

