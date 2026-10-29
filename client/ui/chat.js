/* ---------------- chat: one log for everyone on the map (the Worker caps, filters and rate-limits each line) ---------------- */
let chatOpen = false;   // the chat box is open: the game stands still and the pointer is free
const Chat = (() => {
  const SHOWN = 6, FADE_MS = 12000;   // the last six lines; each fades after 12 s, and all come back while the box is open
  const COLOURS = ['#ffcf3a', '#7fd1ff', '#9fdc8a', '#ff9ec7', '#c3a6ff', '#ffb36b', '#6fe7d0', '#ff8a9a'];
  const box = $('chat'), log = $('chatLog'), form = $('chatForm'), input = $('chatIn');
  let wasLocked = false;
  // a name keeps its colour: a hash of the account id picks one from COLOURS
  const colour = id => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) | 0; return COLOURS[Math.abs(h) % COLOURS.length]; };
  const can = () => started && !!netSock && netSock.readyState === 1;   // connected to the room: no chat in single-player or offline
  // sits just above the highest thing on the left edge: the keys chip, the driving card or the joystick
  function layout() {
    let floor = innerHeight - 12;
    for (const id of ['keys', 'drive', 'joy']) { const el = $(id); if (el && el.getClientRects().length) floor = Math.min(floor, el.getBoundingClientRect().top); }
    box.style.bottom = (innerHeight - floor + 8) + 'px';
  }
  // one line: the name in its colour, then the text (textContent only, so nothing in a message is markup)
  function add(m) {
    const line = document.createElement('div'), who = document.createElement('b'), text = document.createElement('span');
    line.className = 'msg';
    who.textContent = String(m.name); who.style.color = colour(m.id);
    text.textContent = ': ' + String(m.text);
    line.append(who, text); log.appendChild(line);
    while (log.children.length > SHOWN) log.firstElementChild.remove();
    setTimeout(() => line.classList.add('old'), FADE_MS);
  }
  function shut(relock = true) {
    if (!chatOpen) return;
    chatOpen = false; box.classList.remove('open'); form.hidden = true; input.blur();
    if (relock && wasLocked) lockPointer();
    wasLocked = false;
  }
  form.addEventListener('submit', e => {
    e.preventDefault();
    const text = input.value.trim();
    if (text && can()) netSock.send(JSON.stringify({ t: 'chat', text }));   // the Worker checks and relays it
    shut();
  });
  input.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); shut(); } });
  $('chatClose').addEventListener('click', () => shut());
  $('tChat').addEventListener('click', () => Chat.open());
  addEventListener('resize', layout);
  if (window.ResizeObserver) { const ro = new ResizeObserver(layout); for (const id of ['keys', 'drive', 'joy']) ro.observe($(id)); }
  return {
    onMsg(m) { if (typeof m.name === 'string' && typeof m.text === 'string') add(m); },
    // shows or hides the log and the touch button with the connection; leaving the room closes the box
    sync() {
      const on = can();
      box.hidden = !on; $('tChat').hidden = !on;
      if (!on) { log.replaceChildren(); if (chatOpen) shut(false); }
      layout();
    },
    open() {
      if (chatOpen || !can() || mapOpen || newsOpen || acctOpen) return false;
      chatOpen = true; wasLocked = locked(); keys.clear();
      if (wasLocked) document.exitPointerLock();
      box.classList.add('open'); form.hidden = false; input.value = ''; input.focus();
      return true;
    },
    close(relock = true) { shut(relock); },
    focus() { input.focus(); },
  };
})();
