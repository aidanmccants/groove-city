/* ---------------- debt: ten minutes below $0 and the player is sent back to the start with a fresh profile ---------------- */
let kicked = false;
function checkDebt() {
  // a signed-in player waits while the socket is still connecting, so the server's money is known before the ten minutes can end
  const connecting = !!Account.me && !!netSock && netSock.readyState === 0;
  if (started && !connecting && Profile.inDebt() && Profile.debtLeft() === 0) kickAndReset('You spent ten minutes in debt, so your campus life starts over with ' + money(startMoney()) + '.');
}
function kickAndReset(msg) {
  Econ.act('die');   // signed in: the server zeroes the cash before this socket closes (the bank is kept)
  Vehicles.exit(true);
  Profile.reset(); kicked = true;
  netOff = true; const s = netSock; netSock = null; if (s) { try { s.close(); } catch (e) { } }
  Econ.dropPending();
  for (const id of [...remotes.keys()]) dropRemote(id); myName = '';
  started = false; keys.clear(); if (mapOpen) toggleMap(false); if (newsOpen) { newsOpen = false; $('news').hidden = true; } if (locked()) document.exitPointerLock();
  for (const id of ['where', 'mini', 'mode', 'cross', 'keys', 'touch', 'online', 'money', 'hint', 'acct', 'chat']) $(id).hidden = true;
  Account.closePanel(false); Chat.sync();
  setHint(''); CFA.reset(); Bank.reset();
  if (flying) toggleFly();
  const sp = D.specials.spawn || [0, 0]; teleport(sp[0], sp[1]);
  $('intro').hidden = false; status(msg); $('go').textContent = 'ENTER CAMPUS';
}

