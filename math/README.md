# Black Valley — maths

Built on Engine's math-sdk (github.com/engineio/math-sdk). Spec: "Black Valley — Maths & Mechanics Spec"
(Claude doc). Game code lives in `black_valley/`; the SDK is not vendored.

## Setup (once)

```
git clone https://github.com/engineio/math-sdk ../math-sdk
cd ../math-sdk && make setup && source env/bin/activate
ln -s "$(pwd)/../black-valley/math/black_valley" games/black_valley   # Windows: mklink /D
```

Rust/Cargo is needed for the optimiser.

## Run (from the math-sdk root)

```
python games/black_valley/tools/make_reels.py                        # rebuild reel strips (seeded)
python games/black_valley/tools/natural_stats.py --n 100000          # unforced game shape
python games/black_valley/run.py --modes base --sims 20000 --no-opt  # quick books
python games/black_valley/run.py --sims 1000000                      # full: sims, optimiser, analysis, checks
python games/black_valley/tools/check_books.py --mode base           # every book: events add up, names, order, cap
```

Outputs go to `black_valley/library/` (not committed until the release build).

## Status

| Stage | What | State |
|---|---|---|
| 1 | Base game: 25 lines, cascades, paytable, strips | done |
| 2 | The Knock, The Pit, The Fire, The Village Fights Back | done |
| 3 | Strike / Uprising / Final Stand, boosts, buys | done |
| 4 | Optimiser to 96.50% per mode, Model A vs B, checks | done (100k per mode; 1M run before upload) |

### Stage 1 measurement (natural, unforced, 100k rounds, lines + cascades only)

RTP 42.1% · hit rate 29.6% · beats the stake 12.8% · std dev 1.03 · avg 0.35 cascades per round (max 7).
The optimiser sets the final hit rate and RTP per mode by weighting rounds; features and bonuses add the rest.

Paytable changed from spec v0.1: the draft values were line-bet sized and gave a 6% base RTP; all pays were
scaled up (H1 5-of-a-kind 40x, L 5-of-a-kind 3-4x total bet). See `game_config.py`.

### Stage 2 measurement (natural, 200k base rounds, with features)

RTP 66.0% · hit rate 32.5% · beats the stake 15.8% · std dev 2.71. Leaves ~30% of RTP for the bonuses
(brief's split: 68% base + modifiers, 28.5% bonuses).

| Feature | Frequency | Avg win when it fires | Pays when it fires | RTP share |
|---|---|---|---|---|
| The Pit | 1 in 20 | 0.62x | 29.5% (only shown on a mining win) | 3.2% |
| The Knock | 1 in 55 | 4.29x | 100% | 7.8% |
| The Village Fights Back | 1 in 83 | 4.59x | 100% | 5.6% |
| The Fire | 1 in 100 | 11.17x | 100% | 11.2% |

Changes from spec v0.1, all to hit budget or the 3-star "a feature that fires pays" rule:
- The Fire: burning reels stay wild for the first cascade step only, then burn out (persisting through every
  cascade made 37x average wins and 30-step chains). 2-reel fires 10% (was 25%). 1 in 100 spins (was 60).
- The Knock and The Fire place their wilds so the spin always pays (placement is part of the pre-generated round).
- The Knock 1 in 55 (was 35), counts weighted lower. The Pit 1 in 20 (was 25), stronger multipliers.
- Village tokens 0.2x-50x (was 0.5x-100x), 1 in 80 spins (was 50). Token values ride on the SDK's `prize` field.
- `tools/check_books.py`: 40,000 base books, 0 failures.

### Stage 3: bonuses and modes

Six modes: `base` (1x), `more_features` (1.5x, base features twice as often), `bonus_chance` (2x, bonus
rounds weighted up), `strike` (60x), `uprising` (120x), `final_stand` (250x). Mode names carry no buy/bet/pay.

| Bonus | Spins (retrigger, max) | Rules | Natural avg payout (5k buys) | Needed at 96.5% |
|---|---|---|---|---|
| The Strike | 10 (+3, 20) | 40% of spins burn one reel; Knock 6%, Pit 7% | 67.4x (112% of price) | 57.9x |
| The Uprising | 8 (+2, 16) | Multiplier starts x2, +1 per winning cascade step, max x25; Fire 10%, Knock 12%, Pit 12% | 100.0x (83%) | 115.8x |
| Final Stand | 6 (+2, 12) | Every spin: 1-2 reels burn + collector, tokens 0.5x-500x | 242.3x (96.9%) | 241.25x |

The optimiser (stage 4) closes the remaining gaps by weighting rounds. `freeSpinTrigger` carries `bonus` and
`totalFs`. Max-win route (forced cap rounds only): Final Stand with 7-8 tokens of 250x/500x, about 1 in 5
reach 20,000x; the optimiser gives these rounds their real, tiny weight.

`check_books.py`: 8,000 books in each of the six modes, 0 failures.

### Stage 4: tuned results (Model A, 100,000 rounds per mode)

| Mode | Cost | RTP | Hit rate | Beats cost | Std dev | Strike | Uprising | Final Stand | 20,000x |
|---|---|---|---|---|---|---|---|---|---|
| base | 1x | 96.50% | 39.0% | 14.5% | 9.19 | 1 in 309 | 1 in 1,434 | 1 in 14,621 | 1 in 8.0M |
| more_features | 1.5x | 96.50% | 43.4% | 15.7% | 12.22 | 1 in 227 | 1 in 986 | 1 in 6,975 | 1 in 5.3M |
| bonus_chance | 2x | 96.50% | 40.2% | 8.5% | 15.46 | 1 in 81 | 1 in 353 | 1 in 2,109 | 1 in 4.0M |
| strike | 60x | 96.50% | 100% | 24.9% | 83.4 | always | | | max 1,778x |
| uprising | 120x | 96.50% | 100% | 24.6% | 159.8 | | always | | max 2,486x |
| final_stand | 250x | 96.50% | 100% | 35.5% | 249.3 | | | always | 1 in 32,000 |

Engine's checks (`execute_all_tests`): all six modes SHA-256 and payout hash OK, risk checks 6 of 6 pass,
max base bet up to $1,000. `check_books.py` over every book.

Bonus odds are rarer than the brief's 1 in 120-180: at that rate the bonuses alone would put base above 100% RTP.
The brief allows this ("do not hardcode these bounds if they prevent the target return").

### Model A vs Model B (base mode, same 96.50%)

| | Model A (steadier) - chosen | Model B (spikier) |
|---|---|---|
| Hit rate | 39.0% | 37.6% |
| Beats the stake | 14.5% (1 in 6.9) | 12.9% (1 in 7.8) |
| 2x+ | 1 in 11 | 1 in 15 |
| 5x+ | 1 in 53 | 1 in 83 |
| 25x+ | 1 in 148 | 1 in 123 |
| 50x+ | 1 in 259 | 1 in 182 |
| 100x+ | 1 in 1,586 | 1 in 1,033 |
| Std dev | 9.19 | 9.65 |

Switch with `BV_MODEL=B python games/black_valley/run.py --modes base --no-sims`.

### How the shape is controlled

The optimiser matches groups ("fences") by tags in the rounds, not by win ranges. The game tags bonus rounds
(`symbol: scatter`) and base rounds by win size (`band: sub` below 1x, `band: low` 1x-2x); everything else
is 2x+. Each group gets its own frequency and RTP share in `game_optimization.py`, so hit rate and the share
of spins beating the stake are set directly. Engine's sample mean-to-median setting (4-8) was lowered.

### Before upload

Run the full 1,000,000-round build on a machine with 8+ cores (here: 2 cores, so 100k):
`python games/black_valley/run.py --sims 1000000 --batch 25000` (about 30-60 minutes), then
`tools/lut_report.py` and `tools/check_books.py` for every mode. The round files (~2.5 GB at 1M) are not
committed; upload `library/publish_files/` to Engine.
