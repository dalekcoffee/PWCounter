# PW Counter: build notes

Static PWA served by GitHub Pages at pwcounter.dalek.coffee. Vanilla ES modules, no build step, no npm dependencies, no backend, no login: every browser keeps its own game in localStorage (`pwc.state`).

- `js/state.js`, `js/calc.js`, `js/random.js` are pure and tested (`npm test`, node:test). `js/app.js` is the DOM.
- Style follows PalVault (dark palette, Figtree / Newsreader / JetBrains Mono). Day and night must stay obviously different on the board.
- Counter tiles: the whole left half is the minus button, the whole right half the plus button, with a visible divider and −/+ chips in ONE uniform colour (never a colour per sign). Counters never go below 0.
- Souls (experimental, `state.souls`): rules in state.js follow the official Comprehensive Rules (cited in its header); numbers in two-player view, cards allowed for one player only.
- Tiles: the number sits on the tile's centre line, level with the −/+ buttons; icon and word above it. Never hide the Material / Ingredient words.
- Overlays are divs inside `#stage` (never a native dialog element, which would not turn with the landscape setting).
- Every file the app needs must be in `sw.js` SHELL (tested). Version lives in js/version.js, package.json, sw.js VERSION and CHANGELOG.md (tested equal); bump on every change.
- Original design only: never copy another site's markup, art or branding.
- Commit identity: `dalekcoffee <78516780+dalekcoffee@users.noreply.github.com>`.

## Online rooms (experimental, 0.1.0)
- Pure rules: `js/room-proto.js` (codes, messages, turn passing), `js/room-game.js` (mapping shared state / my seat), `js/drawer.js`, `js/qr.js`; connection `js/room.js` (transport factory, backoff, sessionStorage resume); DOM `js/room-ui.js`. Relay in `worker/room/` stores nothing; one Durable Object per code, roles host/guest (`?role=&sid=`), a second host gets 4002 (the client draws a new code, max 5), a second guest 4001, the same `sid` replaces its own stale socket.
- Each phone owns its seat (seat 0 = me); the opponent is held in memory only, never in localStorage. Shared: night, active (0 me / 1 them), turn, last writer wins by rev, host wins ties.
- Room mode forces the one-player layout (`stage[data-room=on]`); the opponent drawer is a div in `#stage` (stage coordinates, so landscape works). `?fakeRoom=1` on localhost uses a BroadcastChannel transport for tests.
