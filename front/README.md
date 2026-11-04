# Black Valley — the game page

The whole game in one page (`index.html` + `round.js`, Pixi 8 + spine-pixi-v8 4.2): the 5 × 5 board, the cast alive,
the sound, every scene. Needs a local server (Spine and audio load by fetch): `Open game (Mac).command` or
`Open game (Windows).bat` (Python 3). Commit `50d81b3`.

- It opens like the live game: the title (valley, logo, loading bar) → TAP TO PLAY → the 5-page intro (SKIP) → the
  board. `?title=0` opens straight on the board.
- `round.js` plays rounds as events, in the shapes of your books (`playRound(events)`). Without a books file, SPIN (or
  Space) makes a round locally with your odds per mode; `?book=URL` plays a real books file (a JSON list of rounds, or
  one round) instead.
- BONUS (the lamp, top left; beside the spin on phones): The Strike, The Uprising, Final Stand (they start straight
  away) and the modes Standard, More Features, Bonus Chance. Your front end's own mode menu can replace it.
- TURBO (lightning) runs every round 2.2× faster (big wins skip to their end); AUTO plays 10 / 25 / 50 / 100 spins.
- Round buttons (top right): sound and the rules page (final maths: 25 lines, cascades, features, bonuses, modes,
  RTP 96.50%, the 25-line sheet).
- For review only: `?dev=1` shows a CHECK menu with one entry per event (line win, cascade, The Knock, The Fire, The
  Pit, tokens + collect, the three bonuses, Big / Mega / Epic, max win, intro, lamp out, the xerox switch). Players
  never see it.
- A tap skips any scene. Portrait screens get the phone page (or add `?port=1`).
