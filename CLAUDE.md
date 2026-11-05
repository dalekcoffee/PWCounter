# PW Counter: build notes

Static PWA served by GitHub Pages at pwcounter.dalek.coffee. Vanilla ES modules, no build step, no npm dependencies, no backend, no login: every browser keeps its own game in localStorage (`pwc.state`).

- `js/state.js`, `js/calc.js`, `js/random.js` are pure and tested (`npm test`, node:test). `js/app.js` is the DOM.
- Style follows PalVault (dark palette, Figtree / Newsreader / JetBrains Mono). Day and night must stay obviously different on the board.
- Counter tiles: the whole left half is the minus button, the whole right half the plus button, with a visible divider and −/+ chips in ONE uniform colour (never a colour per sign). Counters never go below 0.
- Souls (`state.souls`, a normal setting since 0.2.7; style default `numbersCards`, the style options show only while souls are on): rules in state.js follow the official Comprehensive Rules (cited in its header); numbers in two-player view, cards allowed for one player only.
- Tiles: the number sits on the tile's centre line, level with the −/+ buttons; icon and word above it. Never hide the Material / Ingredient words.
- Overlays are divs inside `#stage` (never a native dialog element, which would not turn with the landscape setting).
- Every file the app needs must be in `sw.js` SHELL (tested). Version lives in js/version.js, package.json, sw.js VERSION and CHANGELOG.md (tested equal); bump on every change.
- Performance (0.2.8, for old tablets): write the DOM through js/dom-write.js (`setText`, `setHidden`, `setData`, `setAttr`, `setProp` only write a changed value); save through `saveSoon()` (flushed on hide / pagehide); no `backdrop-filter` and no animated `filter` / `box-shadow` (animate opacity or transform on a layer instead); nothing animates by day; the dice shader stays loop-free.
- Original design only: never copy another site's markup, art or branding.
- Commit identity: `dalekcoffee <78516780+dalekcoffee@users.noreply.github.com>`.

## Online rooms (experimental, 0.1.0)
- Pure rules: `js/room-proto.js` (codes, messages, turn passing), `js/room-game.js` (mapping shared state / my seat), `js/drawer.js`, `js/qr.js`; `js/room-memory.js` + `js/room-sync.js` (remembered room, rejoin compare), `js/dice-anim.js`; connection `js/room.js` (transport factory, backoff); DOM `js/room-ui.js`. Relay in `worker/room/` stores nothing; one Durable Object per code, roles host/guest (`?role=&sid=`), a second host gets 4002 (the client draws a new code, max 5), a second guest 4001, the same `sid` replaces its own stale socket.
- The last room is remembered in localStorage `pwc.room` (code, role, phone sid, peer name, last peer seat + shared game; under 48 h; never other opponent data). Rejoin prompt on open; after a rejoin both phones exchange a `check` and, if anything differs, #ov-sync makes the host-arbitrated `pick`; shared messages are held until then.
- Each phone owns its seat (seat 0 = me); the opponent is held in memory only, never in localStorage. Shared: night, active (0 me / 1 them), turn, last writer wins by rev, host wins ties.
- Room mode forces the one-player layout (`stage[data-room=on]`); the opponent drawer is a div in `#stage` (stage coordinates, so landscape works). `?fakeRoom=1` on localhost uses a BroadcastChannel transport for tests.

## Watching and display mode (0.2.0)
- Relay role `watch` (`?role=watch`): up to 8 viewers (`MAX_WATCHERS`, 4003 "Too many viewers"), never counted as players; a viewer's messages are dropped, players' messages reach the other player and every viewer; viewers get `{"t":"peer","role","here"}` per player, players get `{"t":"watcher"}` and resend hello + shared. Pure rules in worker/room/src/rules.js (`admit`, `routeTargets`, `joinNotices`, `leaveNotices`), reused by js/room-fake.js. `hello` and `shared` carry the sender's `role`.
- Watching needs no `rooms` switch and is remembered in sessionStorage `pwc.watch` only (never `pwc.room`, never touches `pwc.state`). A guest refused with 4001 becomes a watcher. Display mode = `stage[data-display=on]` with `#display` (built in js/room-ui.js, pure view in js/room-display.js): read only, side by side (stacked under 700 px), nothing rotated, ignores the landscape setting, carries the watch QR. Players see a faint `#room-mark` line above the bar.
- Icons: all four (heart, log, fruit, flame) are flat, one fill, an outline in a darker shade of the same colour, light details.
