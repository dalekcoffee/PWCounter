# Changelog

## 0.2.5
- Ingredient: the stalk is green with a darker-green outline, like the card game's fruit.

## 0.2.4
- Ingredient: the check mark is a dark-green line where the stalk goes into the fruit, and the stalk is brown with a dark-brown outline.
- Material: the log retraced against the card game's icon (longer, a big oval end), one brown for the whole log, dark-brown rings and grain.

## 0.2.3
- Ingredient icon redrawn from scratch against an upscaled reference of the card game's fruit: clean curves, the leaf in front of the fruit with its own outline, a light check-mark stem and a bean-shaped shine.

## 0.2.2
- Real 3D dice: each die is one bevelled block (rounded edges and corners, one continuous surface, no seams between faces) with pips set into the surface, drawn with WebGL. They tumble in 3D and land on the rolled numbers, slightly tipped so they read as solid. Without WebGL the flat dice are used.

## 0.2.1
- Dice: two dice roll side by side, each number under its die and the total below. They tumble seen from above (no 3D cube, so nothing clips mid-roll).
- Ingredient icon redrawn to the card game's fruit shape; the log's rings and grain lines are dark brown.
- Pop-ups open faster: no full-screen blur behind them, no blur on the tiles, and the stars rest while a pop-up is open.
- The installed app looks for a new version whenever it is opened or brought back, and reloads once onto it.

## 0.2.0
- Watch a game: the room relay has a read-only `watch` role (up to 8 viewers who never count as players). Open `#watch=CODE` (no experimental switch needed), choose "Watch a game" in the room sheet, or get switched to watching automatically when a game already has two players.
- Display mode for a TV or monitor: the two players side by side (stacked on a narrow screen), big life, Material, Ingredient and Souls, the player whose turn it is highlighted, day or night sky and the turn number, live "+2" / "−3" badges, a QR of the watch link. Read only, never upside down, ignores the landscape setting.
- Players see a faint "Room 0427 · watch at pwcounter.dalek.coffee/#watch=0427" line on the board, and the room sheet shows the watch link (Copy) and a QR.
- Life and Souls icons redrawn to match Material and Ingredient: flat, one colour each, an outline in a darker shade of the same colour, light details; all four the same visual size.
- Reset game moved to the top of Settings, full width.

## 0.1.11
- Material and Ingredient icons redrawn in the card game's flat sticker style (one colour, white details and outline), and the log is now as big as the fruit.

## 0.1.10
- The turn button fills the middle of the bar and its words scale to fit, so "Start game / Who goes first?" is always centred and never touches the edge. The word "Day" on the day/night button shows only on wide screens.

## 0.1.9
- Dice and coin: the sheet closes and the die or coin is thrown big across the screen, with the result in large type, Roll / Flip again and Done.
- The die has rounded corners with a solid body, so no square corners or gaps show while it tumbles; the coin has a gold edge.

## 0.1.8
- Installed app: goes full screen on the first tap even when the phone opened it as a window (Settings: "Full screen when installed", on by default). The full screen button stays available.

## 0.1.7
- With souls on, the turn button says "Start game" until who goes first is chosen, then "Start turn" / "End Turn".

## 0.1.6
- Souls show the "+1" / "−2" badge too (resting, standing, a tapped card, or adding / removing souls), like life and resources.

## 0.1.5
- Souls: one "Soul style" setting with four styles that always work: Numbers, Numbers on cards (cards drawn behind the count), Cards with tap a card, Cards with tap a side. − / + for adding or removing souls stay in every style. Games saved before keep their look.

## 0.1.4
- Experimental "Tap souls by": Card (tap a card to rest or stand it, the default) or Sides (left side rests one, right side stands one, like the other counters). The total − / + stay in the header, outside the tapping area.

## 0.1.3
- Landscape, one player, souls as cards: the souls row is taller and the cards bigger.
- The turn button (End Turn / Start turn) is bigger and easier to tap, wider in landscape.

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
