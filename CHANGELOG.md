# Changelog

## 0.1.2
- The installed app opens full screen (Android; iPhone shows it without browser bars).
- Q&A: every rule number is a link to that page of its source.

## 0.1.1
- Settings Q&A: what Bushiroad allows for counters in casual games, at the Masters League and at other events (life and resources, souls as numbers, online play), with the Comprehensive Rules, Floor Rules and Masters League sources linked.

## 0.1.0
- Experimental, off by default: play with a friend online. One phone shows a 4-digit code (and a QR code), the other types or scans it. Each phone keeps its own counters; your friend's Life, Material, Ingredient and Souls show read only in a drawer you pull down from the top. Day/night and End Turn are shared.
- Come back later: the last room is remembered for 48 hours ("Rejoin your game?"). If the counters differ after both phones return, a sheet lets you pick whose to use.
- The +/− change badge is bigger and stays 5 seconds. Dice and coin roll in 3D and land on the result.
- Needs the small room relay (worker/room) to be deployed and its address put in js/room-config.js; until then the sheet says it isn't set up.

## 0.0.3
- Opens in one-player mode on a first visit.
- Only one game is ever saved. Opening the app more than 48 hours after it was last played asks: Continue, or New game.
- Your name (Settings) shows faintly behind your life number; the top player shows "Opponent".
- Experimental, off by default: "Play with a friend (online)". Not ready yet; turning it on shows the button, which says it is still being built.

## 0.0.2
- Life goes up to 99,999 (the rules set no upper limit); long numbers shrink to stay between the buttons.
- Settings: a Q&A after the credits (souls as numbers, rule 13.2, with a link to the rules).
- README: link to the live site; build and deploy notes removed.

## 0.0.1
First test release.
- Life (starts at 10), Material and Ingredient (start at 0) for one or two players. The whole left half of a tile takes one off, the whole right half adds one (hold to repeat); a dashed line marks the middle. Counters never go below 0.
- Two players face to face (the opponent's side is turned toward them); the player whose turn it is sits on a soft filled panel.
- Shared day / night: a clear blue day sky with a sun, a dark night sky with stars and a moon.
- End Turn with a turn count; one player has no turn tracking unless souls are on.
- Calculator (× and ÷ before + and −) with +100 / +300 / +500 / +1000 / −500 / −1000 shortcuts; dice and coin.
- Settings: players, landscape by setting (left / right) without turning the phone, face to face, keep the screen on, reset with a confirm; credits and the version.
- Experimental: track souls (official rules: the second player starts with 1, each turn all stand and 2 more come, max 10; one player can show them as cards), and icons only.
- Saved in this browser; installable and works offline.
