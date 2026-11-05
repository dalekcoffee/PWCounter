# PW Counter

A life counter for the Palworld card game, built to sit on the table between two players (or just you).

- **Life** (starts at 10), **Material** and **Ingredient** (start at 0) for one or two players. Tap anywhere on the left half of a counter to take one off, anywhere on the right half to add one; hold to repeat. Counters never go below 0.
- **Day / Night**, shared by the table, with a day sky and a night sky on the board.
- **End Turn** with a turn count; the player whose turn it is glows.
- **Calculator**: × and ÷ before + and −, with +100 / +300 / +500 / +1000 / −500 / −1000 shortcuts.
- **Dice and coin**.
- **Settings**: one or two players, landscape by setting (the board turns, the phone does not have to), face to face, keep the screen on, and Reset game (asks first).
- Credits in Settings: inspired by [Palify](https://palify.org/tools/counter), made by [Dalek](https://dalek.coffee), built with Claude.
- Saved in this browser only: no login, no server, nothing sent anywhere. Installable (Add to Home Screen) and works offline.

## Run it locally

```bash
node tools/serve.mjs
```

Then open http://127.0.0.1:5174. No build step and no dependencies.

```bash
npm test
```

## Deploy (GitHub Pages)

1. Repository Settings → Pages → Source: **Deploy from a branch**, branch `main`, folder `/ (root)`.
2. Same page → Custom domain: `pwcounter.dalek.coffee` (the `CNAME` file in this repo already says so), then tick **Enforce HTTPS** once the certificate is issued.
3. At the DNS host of `dalek.coffee`: a `CNAME` record `pwcounter` → `dalekcoffee.github.io` (the account's github.io name, not the repository and not the `*.pages.github.io` name). Add the domain on GitHub before the DNS record.

## Releasing a change

Bump the version in `js/version.js`, `package.json`, `sw.js` (`VERSION`) and add a line to `CHANGELOG.md` (`npm test` checks they agree). The new `VERSION` makes installed copies replace their offline cache on the next visit.
