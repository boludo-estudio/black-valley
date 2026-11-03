# Black Valley — Maths & Mechanics Spec (as built)

Nov 3, 2026 · Jack Brown · Live doc (with the draft history): https://claude.ai/artifact/4XG89X9usewmdRW8mHZDJ2
Code: `math/black_valley/` · Results and how to run: `math/README.md` · Original brief: `docs/brief-original.docx`

This repo copy carries the **final built values**. Where the live doc's later sections show starting targets, this file wins.

## Status

Option B from the brief, built in full on Engine's math-sdk: 25 lines with cascades, four base features, three
bonuses, two boosts and three buys, capped at 20,000×. All six modes tuned to 96.50% (Model A) and passing Engine's
checks (hashes OK, risk checks 6 of 6, bet levels up to $1,000). Tuned on 100,000 rounds per mode; run the
1,000,000 build before upload (`math/README.md`).

## Measured results (Model A, 100,000 rounds per mode)

| Mode (maths name) | Player sees | Cost | RTP | Hit rate | Beats the cost | Bonus odds | 20,000× |
| --- | --- | --- | --- | --- | --- | --- | --- |
| base | Standard | 1× | 96.50% | 39.0% | 14.5% | Strike 1 in 309 · Uprising 1 in 1,434 · Final Stand 1 in 14,621 | 1 in 8.0M |
| more_features | More Features | 1.5× | 96.50% | 43.4% | 15.7% | Strike 1 in 227 | 1 in 5.3M |
| bonus_chance | Bonus Chance | 2× | 96.50% | 40.2% | 8.5% | Strike 1 in 81 | 1 in 4.0M |
| strike | The Strike | 60× | 96.50% | 100% | 24.9% | — | max 1,778× |
| uprising | The Uprising | 120× | 96.50% | 100% | 24.6% | — | max 2,486× |
| final_stand | Final Stand | 250× | 96.50% | 100% | 35.5% | — | 1 in 32,000 |

Base payout ladder: ≥2× 1 in 11 · ≥5× 1 in 53 · ≥25× 1 in 148 · ≥100× 1 in 1,586. Std dev 9.19.

Model A (chosen) vs Model B, base mode at the same 96.50%: A gives 2×+ 1 in 11 and 100×+ 1 in 1,586; B gives 2×+
1 in 15 and 100×+ 1 in 1,033. Switch: `BV_MODEL=B`.

## Grid, lines and cascades

5×5, **25 fixed lines**, left to right, 3+ matching from reel 1 (5 straight rows + 20 shapes, listed in
`game_config.py`). Highest win per line pays. Each spin cascades: evaluate → pay → remove winners (wilds in a win go
too; choirs stay) → drop and refill → evaluate again, until no win, the cap, or the 30-step safety stop. Nothing
carries to the next bet.

## Symbols and paytable (× total bet, one line)

| ID | Art file | Role | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- |
| W | wild_lamp | Wild (not for S); reels 2–5 | 2.50 | 10.00 | 50.00 |
| S | choir | Scatter, triggers bonuses | — | — | — |
| H1 | haskett_bust | High | 2.50 | 8.00 | 40.00 |
| H2 | debt_bowler | High | 2.00 | 5.00 | 25.00 |
| H3 | debt_trilby | High | 1.50 | 4.00 | 20.00 |
| H4 | debt_cap | High | 1.20 | 3.00 | 12.00 |
| M1 | canary | Mining (The Pit) | 1.00 | 2.50 | 8.00 |
| M2 | pick | Mining (The Pit) | 0.80 | 2.00 | 6.00 |
| M3 | helmet | Mining (The Pit) | 0.80 | 2.00 | 6.00 |
| M4 | coal | Mining (The Pit) | 0.60 | 1.50 | 5.00 |
| L1 | boots | Low | 0.50 | 1.20 | 4.00 |
| L2 | snaptin | Low | 0.40 | 1.00 | 3.00 |
| L3 | mug | Low | 0.40 | 1.00 | 3.00 |
| L4 | waterjack | Low | 0.40 | 1.00 | 3.00 |
| T | (new) villager token | Carries a value; blocks lines | — | — | — |
| C | (new) collector | Collects tokens; blocks lines | — | — | — |

## Base-game features (at most one per base spin)

| Feature | What happens | Frequency | Values |
| --- | --- | --- | --- |
| The Knock | 3–8 positions on reels 2–5 turn into wilds before the first evaluation. Always pays. | 1 in 55 | 3: 45 · 4: 30 · 5: 15 · 6: 7 · 8: 3 |
| The Pit | Every win paid on a mining symbol gets its own multiplier; shown only on such wins; never stacks with another Pit multiplier. | 1 in 20 | ×2: 45 · ×3: 30 · ×5: 17 · ×10: 8 |
| The Fire | 1–2 of reels 2–4 become fully wild. They stay wild for the first cascade step, then burn out. Always pays. | 1 in 100 | 1 reel 90 · 2 reels 10 |
| The Village Fights Back | 3–8 tokens land on reels 1–4 and the collector on reel 5; after the last cascade the collector adds up every token still on the grid. | 1 in 80 | Tokens 0.2×–50× |

"Always pays": The Knock and The Fire choose their placement so the spin wins. Placement is part of the
pre-generated round (the feature's definition), never a reaction to a loss. Base RTP split (natural): lines 38%,
features 28%.

## Bonuses

| Bonus | Trigger | Spins (retrigger, max) | Rules |
| --- | --- | --- | --- |
| The Strike | 3 choirs or buy 60× | 10 (+3, 20) | 40% of spins burn one reel (The Fire); Knock 6%, Pit 7% |
| The Uprising | 4 choirs or buy 120× | 8 (+2, 16) | Multiplier starts ×2, +1 after every winning cascade step, max ×25, kept for the bonus; Fire 10%, Knock 12%, Pit 12% |
| Final Stand | 5 choirs or buy 250× | 6 (+2, 12) | Every spin: 1–2 reels burn (70/30) and the collector comes; tokens 0.5×–500× |

A Pit multiplier and the Uprising multiplier multiply each other. The collector's total is never multiplied by the
Uprising multiplier. Retrigger: 3+ choirs on a bonus spin. Everything ends inside the paid round.

Bonus odds are rarer than the brief's 1 in 120–180: at that rate the bonuses alone would put base above 100% RTP.

## Max win and cap

20,000× the base bet in every mode, including buys (the brief's "total paid wager" wording would exceed Engine's
1,000,000× limit for Final Stand). On reaching it the round records `wincap`, pays exactly 20,000× and ends; bonus
spins left are not played. Reachable in base at 1 in 8M (Engine wants better than 1 in 10M). The cap's odds are
measured with forced max-win rounds (Final Stand with high tokens) that the optimiser weights to their real chance.

## Events: the contract with the art team

| Event | When | Key data |
| --- | --- | --- |
| `reveal` | Grid lands | board, `anticipation` |
| `knock` | The Knock | positions turned wild |
| `fireExpand` | The Fire | reels |
| `villageTokens` | Village / Final Stand | tokens (position + value), collector position |
| `pitMultiplier` | The Pit, before its win pays | winIndex, multiplier |
| `winInfo` | Line wins pay | wins (lineIndex, positions, win, multipliers) |
| `tumbleBoard` | Cascade | removed positions, new symbols |
| `updateTumbleWin` | After each cascade step | running spin win |
| `collect` | Collector pays | amount, token positions |
| `updateGlobalMult` | The Uprising | multiplier |
| `freeSpinTrigger` | 3/4/5 choirs or a buy | `bonus`, `totalFs`, positions |
| `updateFreeSpin` / `freeSpinRetrigger` | Each bonus spin / retrigger | spin n, total |
| `freeSpinEnd` | Bonus ends | bonus total |
| `setWin` | Spin win tier | amount, win level |
| `wincap` | 20,000× reached | amount |
| `setTotalWin` / `finalWin` | Round ends | amount |

Amounts are integers in hundredths of the bet; positions use the SDK convention (row + 1 for the padding row).
New art for these: `docs/art-brief.md`.

## Changes from the written brief

| Brief says | Built | Why |
| --- | --- | --- |
| Cap = 20,000× total paid wager | 20,000× base bet, every mode | Engine's 1,000,000× limit |
| 100M rounds per mode | 100k here, 1M before upload | Engine's range is 100k–1M |
| Features may combine on a base spin | One per base spin; they combine in bonuses | Readable base, clean RTP |
| Bonus 1 in 120–180 | Strike 1 in 309, any bonus ~1 in 250 | RTP budget |
| Draft paytable | ~8× higher | Draft gave 6% base RTP |
| The Knock (art team: choir tease) | The Knock = wild takeover; 2-choir hold stays as honest anticipation | Brief wins |
| Down the Shaft (art team) | Replaced by Strike / Uprising / Final Stand | Brief wins |
