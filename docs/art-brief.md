# Black Valley — New Art Brief

Nov 3, 2026 · Jack Brown · Live version: https://claude.ai/artifact/WpjYS3q483YmdLWASgNFpn

## What changed and why

The maths for Black Valley is built and final, and it plays differently from the demo you delivered: 25 lines with cascades, four features, three bonuses and six modes. Your package stays the base: the linocut look, the 14 symbols, Owen, Glenys and Haskett, the valley, the sound and the win tiers. This brief lists only the **new** pieces the final game needs.

Every new piece is tied to an event in the game's results. The game plays the events in order, so each asset below says which event it plays on and what numbers it must show. Event names are fixed and must not change.

## House rules for every new piece

- **Style:** direction A (linocut), the same fixed palette, outline weight and light side as the delivered symbols. Must sit beside today's pieces without looking added later. The xerox-print switch must work on new pieces too.
- **Lettering:** Big Shoulders Stencil and Courier Prime only (already licensed in the package). No AI-drawn letters, no stock fonts.
- **Animation:** Spine 4.2 for characters and anything with bones (rigs play on spine-pixi-v8 4.2.74); code or sprite sheets for effects. No AI video.
- **Symbols:** 300 × 268 PNG with transparency, like the 14 delivered. Each new symbol needs an idle state and a win state.
- **Numbers on screen:** any value shown (token values, multipliers, totals) is drawn by the game in the fonts above. Deliver the plate or frame it sits on, not baked-in numbers.
- **Viewports:** everything must read at 1024×576, 800×450, 400×225 and 425×812 (portrait). Check the smallest one.
- **Compliance:** losses don't animate, wins don't drag (every scene is skippable with a tap), no near-miss teasing. Social mode: no words like bet, buy, pay or cash on any image.
- **3★ standard:** the studio's no-AI-look review and quality benchmark apply before hand-off.

## The asset list

Ten new pieces. P1 is needed before the game can go to Engine; P2 lifts it toward 3★.

| # | Asset | Plays on (event) | Must show | Priority |
| --- | --- | --- | --- | --- |
| 1 | Bonus intros ×3: The Strike, The Uprising, Final Stand | `freeSpinTrigger` (`bonus` names which) | Bonus name, number of spins | P1 |
| 2 | Bonus HUD: spin counter + retrigger, bonus total screen | `updateFreeSpin`, `freeSpinRetrigger`, `freeSpinEnd` | Spin n of total, +spins, bonus total | P1 |
| 3 | The Knock: wild takeover | `knock` | Which positions turn wild | P1 |
| 4 | The Fire: reel burn + burning-reel state + burn-out | `fireExpand` | Which reels burn | P1 |
| 5 | Villager token symbol (T) + value plate | `villageTokens` | Each token's value | P1 |
| 6 | Collector symbol (C) + collect sweep | `villageTokens`, `collect` | Collected total | P1 |
| 7 | Cascades: symbol break + drop-in | `tumbleBoard` | Removed positions, new symbols | P1 |
| 8 | 25 line paths + line-win highlight | `winInfo` | Line number, winning positions | P1 |
| 9 | Multiplier: Pit badge + Uprising meter | `pitMultiplier`, `updateGlobalMult` | ×2–×10 on a win; ×2–×25 meter | P1 |
| 10 | Max-win screen (20,000×) | `wincap` | Max win reached, amount | P1 |

Already in your package and kept: reels and the 14 symbols, the lamp wild, the choir scatter, Big / Mega / Epic win scenes, the title, intro, loading, sound and the three rigs.

## Each piece in detail

Frequencies are from the finished maths (standard mode), so you know how often players will see each piece.

### 1. Bonus intros (The Strike, The Uprising, Final Stand)

- Three separate intros, one per bonus. 3 choirs → The Strike (1 in 309 spins), 4 → The Uprising (1 in 1,434), 5 → Final Stand (1 in 14,621). They can also be bought, so each must work without a base spin before it.
- The rarer the bonus, the bigger the moment. Suggested direction: The Strike = the pit stops, picket line at the gate; The Uprising = the village silhouettes rise; Final Stand = Glenys and the village face Haskett and the Debt Men. Your call on the staging.
- Show the bonus name and the number of spins (10 / 8 / 6). About 3 seconds, skippable with a tap. Each bonus needs its own mood (light, colour shift or set) during play.

### 2. Bonus HUD

- Spin counter "SPIN 3 / 10" that can grow on retrigger (+3 Strike, +2 Uprising and Final Stand; max 20 / 16 / 12).
- A retrigger moment when choirs land again.
- A bonus total screen when it ends, in the same family as the Big / Mega / Epic scenes.

### 3. The Knock (wild takeover)

- Haskett's men knock on the board and 3 to 8 positions on reels 2–5 turn into lamp wilds before anything pays. 1 in 55 spins; it always pays.
- The old Knock (the 2-choir hold) is retired as a feature. The 2-choir suspense hold stays as normal anticipation, shown only when 2 choirs really landed.
- Needs: the knock action (Haskett rig or Debt Men), a per-cell transform into the lamp wild, sound hit.

### 4. The Fire (reel burn)

- 1 or 2 of reels 2–4 catch fire and the whole reel becomes wild. 1 reel 90%, 2 reels 10% (Final Stand: 70 / 30, and it fires every spin). 1 in 100 base spins; it always pays.
- Three states: ignite (reel goes up), burning (the reel stays wild for the first cascade), burn-out (back to normal symbols). The burn-out must read clearly because the reel stops being wild.

### 5. Villager token (T)

- New symbol in the 300 × 268 grid, drawn from the villager silhouettes. 3 to 8 land on reels 1–4. It carries a value on a plate: 0.2× to 50× in the base game, 0.5× to 500× in Final Stand. The game prints the value.
- Higher values should look more special (suggest 3 plate tiers: low, mid, top). Tokens fall with cascades, so they must read while moving.

### 6. Collector (C)

- New symbol that lands on reel 5 with the tokens (1 in 80 base spins; every Final Stand spin). After the last cascade it pulls every token in: a sweep from each token to the collector, then the total shown on the collector. Suggest Glenys as the collector.

### 7. Cascades

- Winning symbols break and are removed, symbols above drop, new ones fall in from the top. About 0.4 cascades per spin, up to 7 in a row.
- Needs: a break effect per symbol (coal dust fits the theme), drop-in motion, and a running win counter that climbs each cascade. Burning reels do not break during their burn.

### 8. The 25 lines

- 25 fixed lines, left to right. The rules page draws all 25; a win highlights its line path across the board and its symbols.
- Needs: a line path style (rope, rail track or chalk fit the pit), a line number marker, highlight frames for winning symbols. Several lines often win at once, so they need to read when they overlap.

### 9. Multipliers

- **The Pit badge:** a mining-symbol win (canary, pick, helmet, coal) gets ×2, ×3, ×5 or ×10 stamped on it. Shown only on wins, so it never appears and does nothing.
- **The Uprising meter:** starts at ×2, goes up 1 after every winning cascade, max ×25, kept for the whole bonus. Needs a meter that reads at 400×225 and a tick-up moment.

### 10. Max-win screen

- When a round reaches 20,000× the game stops and pays exactly 20,000×; any bonus spins left are not played. Happens about 1 in 8 million spins, or 1 in 32,000 Final Stand buys.
- Needs its own scene above Epic, ending on "MAX WIN" and the amount (printed by the game).

## Retired or reused from your demo

| From the demo | Now |
| --- | --- |
| Down the Shaft (level-by-level bonus, pit office, survey page) | Retired as a bonus. The descent, the finds and the survey page can be reused inside the bonus intros or the bonus total screen. |
| The Knock as the 2-choir hold | The name now belongs to the wild takeover (#3). The 2-choir hold stays as plain anticipation. |
| GO DOWN button | Replaced by the game's own mode menu (Standard, More Features, Bonus Chance, three bonuses). |
| Rules page text (RTP 96.00%, old disclaimer) | Replaced by the shell's rules page with the real RTP per mode and the current disclaimer. |
| "Wins pay left to right on the rows" | Now 25 fixed lines (#8). |

## Delivery

- Same structure as your package: finals in `01_runtime/` (new folders `bonus/`, `features/`, `lines/`, `maxwin/`), masters in `02_source_masters/`, previews in `03_previews/`, Spine in `05_spine_rigs_4.2/`, plus a `MANIFEST.json` update.
- Name files after the asset and event they play on, e.g. `features/knock_takeover`, `bonus/intro_strike`, `symbols/token_tier2.png`, `symbols/collector.png`.
- Wire them into your playable demo with a DEMO menu entry per event (Knock, Fire, Tokens + collect, Cascade, each bonus intro, Uprising meter, Max win), like the current menu, so each piece can be checked alone.
- Each piece is checked against the maths round files: the game plays real rounds, so timings must leave room for up to 7 cascades and 20 bonus spins without dragging.
- Questions go in the game's channel; Jack signs off on the pieces.
