# Review: art team final package (Black_Valley_Final, 2026-11-04)

Checked by playing real rounds from the maths (100k books per mode) through `06_playable_game` with `?book=`.

## Result

All ten pieces from `docs/art-brief.md` are delivered (tokens 3 tiers x 3, collector, 25 lines, bonus intros, HUD,
Knock, Fire, cascades, Pit stamp, Uprising meter, max win), approved by Tomás 2026-11-03. The 25 lines match the
maths exactly. With one fix (below), every kind of round plays end to end with no errors and pays exactly what the
maths says:

| Real round | Pays | Result |
|---|---|---|
| Knock + cascade | 25.30x | OK |
| Strike with retrigger | 34.70x | OK (plays ~2.5 min untouched) |
| Village + cascade | 11.20x | OK |
| Fire + 2 cascades | 6.00x | OK |
| 4 cascades | 6.00x | OK |
| The Pit | 8.60x | OK |
| Uprising | 339.70x | OK |
| Final Stand | 163.50x | OK |
| Max win | 20,000x | OK (balance 1,000 -> 20,999, ~2 min untouched) |

Balance after the first eight rounds reconciles to the cent (1,000 + 595.00 - 8 spins = 1,587.00).

## Must fix (art team)

1. **Cascades crash on real rounds.** `tumble()` reads `e.board`, but Engine's `tumbleBoard` event carries only
   `explodingSymbols` and `newSymbols` (as in the spec). Every real round with a cascade throws
   "Cannot read properties of undefined (reading '0')" and the game freezes. Fix:
   `round.js.cascade-fix.patch` (tested: applies cleanly, all rounds above pass). It rebuilds the board from the
   current board, the removed cells and the dropped symbols, keeping the hidden top row.
2. **83 duplicate files** named `... 2.png`, `... 2.mp3`, `... 3.png` (a Mac Finder copy artefact) across
   `01_runtime/` and `02_source_masters/`. Remove them before anything goes to Engine.
3. **Outcomes for Stake must come from the RGS.** In normal play the page draws its own random outcomes in the
   browser (fine for review). For Engine, `playRound(events)` must be fed the RGS round (`round.state`) through the
   studio shell; the page must never decide a result.

## Fixed on the maths side (2026-11-04)

`tumbleBoard` used to list every winning position, including burning Fire reels that stay on the board. It now lists
only cells that really break (commit c880a96). Payouts unchanged; Engine checks still pass.

## Still open

- Wire `round.js` to the shell (RGS, replay, social mode, currencies, rules page) - Jack's side.
- Real iPhone check (not done by the art team).
- Long bonuses (Strike ~2.5 min, max win ~2 min untouched): confirm turbo and tap-skip feel right.
