# Black Valley — fixes and Engine wiring (Jack's side, 2026-11-04)

What changed in this package compared with the art team's delivery of 2026-11-04:

1. **Cascades on real rounds** (`06_playable_game/round.js`). Engine's `tumbleBoard` event carries `explodingSymbols`
   and `newSymbols`, not a board. `tumble()` now rebuilds the board from the current board, the removed cells and the
   symbols that drop in (keeping the hidden top row). Before this, every real round with a cascade froze the game.
2. **103 duplicate files removed** (`... 2.png`, `... 3.png` etc., a Mac copy artefact). Each was byte-identical to its
   original.
3. **Engine wiring** (`06_playable_game/engine.js` + `06_playable_game/shell/`). When Engine opens the game
   (`sessionID` + `rgs_url`, or a replay link), every result comes from Engine's server through the studio shell:
   login, play, settle, resume of an unfinished round, bet levels from the session, the player's currency,
   confirmation of autoplay and of modes over 2x, social-mode wording, the current disclaimer, and bet replay with no
   wallet calls (balance, play, spin, auto and bonus buttons hidden; loader, then the replay card on the board).
   `round.js` got small hooks for this (`BV_SPIN`, `BV_AUTO`, `BV_WIN`, `BV_BAL`, `window.BVGame`); it still only
   presents events and decides nothing.
4. **Rules disclaimer** replaced with Engine's current text.

Opened without an Engine session (from this folder, for review), the game behaves as before: the review build draws
its own demo rounds, `?book=` plays real maths rounds, `?dev=1` shows the CHECK menu.

## Tested

- 9 real maths rounds (Knock, Fire, Village, Pit, 4-step cascade, Strike with retrigger, Uprising 339.70x, Final Stand,
  max win 20,000x): all play to the end with no errors and pay exactly the maths.
- Against a mock Engine server: login, 2 spins and a bought Strike (confirmed first), each settled; balance exact to the
  cent in EUR. Replay in social mode (SC): only the replay call, real cost shown, no restricted words.

## Still open

- Real iPhone check.
- Token plates and win scenes show amounts with 2 decimals; at the smallest bets (0.01) sub-cent wins round on the
  plates (the WIN field shows them exactly).
