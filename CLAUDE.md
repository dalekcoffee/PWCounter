# PW Counter: build notes

Static PWA served by GitHub Pages at pwcounter.dalek.coffee. Vanilla ES modules, no build step, no npm dependencies, no backend, no login: every browser keeps its own game in localStorage (`pwc.state`).

- `js/state.js`, `js/calc.js`, `js/random.js` are pure and tested (`npm test`, node:test). `js/app.js` is the DOM.
- Style follows PalVault (dark palette, Figtree / Newsreader / JetBrains Mono). Day and night must stay obviously different on the board.
- Counter tiles: the whole left half is the minus button, the whole right half the plus button, with a visible divider and tinted −/+ chips. Counters never go below 0.
- Overlays are divs inside `#stage` (never a native dialog element, which would not turn with the landscape setting).
- Every file the app needs must be in `sw.js` SHELL (tested). Version lives in js/version.js, package.json, sw.js VERSION and CHANGELOG.md (tested equal); bump on every change.
- Original design only: never copy another site's markup, art or branding.
- Commit identity: `dalekcoffee <78516780+dalekcoffee@users.noreply.github.com>`.
