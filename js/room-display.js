// Pure rules for the big-screen display (watching a room read only). No DOM, no network.
export const SEAT_NAMES = { host: 'Player 1', guest: 'Player 2' };
export const ROLES = ['host', 'guest'];
export const MAX_VIEWERS_TEXT = 'Too many viewers. Only 8 can watch one game.';
export const AUTO_WATCH_NOTICE = "This game already has two players. You're watching.";

/** The room's viewer state (room.js) -> what the display draws. */
export function displayView(room) {
  const sh = room.wshared;
  const players = ROLES.map((role) => {
    const here = !!room.here?.[role];
    const hello = room.seats?.[role] || null;
    return {
      role,
      here,
      ready: here && !!hello, // the hello with the numbers has arrived
      name: hello?.name || SEAT_NAMES[role],
      life: hello?.seat.life ?? null,
      mat: hello?.seat.mat ?? null,
      ing: hello?.seat.ing ?? null,
      souls: !!hello?.souls,
      soul: hello?.seat.soul ?? 0,
      up: hello?.seat.up ?? 0,
      active: here && !!sh && sh.active === role,
    };
  });
  let line = '';
  if (room.status === 'viewers') line = MAX_VIEWERS_TEXT;
  else if (room.status === 'reconnecting' || room.status === 'connecting') line = room.status === 'connecting' ? 'Connecting…' : 'Reconnecting…';
  else if (!players.some((p) => p.here)) line = `Waiting for players… Room ${room.code}`;
  return { code: room.code, night: !!sh?.night, turn: sh ? sh.turn : null, line, players };
}

/**
 * The "+2" / "−3" badges: changes within `ttl` ms add up, then they fade (the same 5 s as the board).
 * note(key, value, now) -> the badge number now (0 = none). A key's first value is only a baseline.
 */
export function createDeltas(ttl = 5000) {
  const seen = new Map();
  return {
    note(key, value, now) {
      if (value === null || value === undefined) { seen.delete(key); return 0; }
      const e = seen.get(key);
      if (!e) { seen.set(key, { value, sum: 0, at: 0 }); return 0; }
      if (e.value !== value) {
        e.sum = now - e.at < ttl ? e.sum + (value - e.value) : value - e.value;
        e.value = value; e.at = now;
      }
      return e.sum !== 0 && now - e.at < ttl ? e.sum : 0;
    },
    forget(key) { seen.delete(key); },
    clear() { seen.clear(); },
  };
}
export const deltaText = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '');
