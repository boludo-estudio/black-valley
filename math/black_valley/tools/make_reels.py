# black-valley/math/black_valley/tools/make_reels.py
"""Builds the reel strips (reels/*.csv) from per-reel symbol weights. Seeded, so reproducible.

    python3 tools/make_reels.py          # writes reels/BR0.csv (base) and reels/FR0.csv (bonus)

Rules: no wild on reel 1; choir scatters are at least 6 stops apart on a strip, so one reel never
shows two (5 rows + 1 padding). The optimiser balances RTP by weighting finished rounds, so these
strips only need the right shape: frequent small wins, rare high symbols.
"""

import csv
import random
from pathlib import Path

LENGTH = 120
STACKS = [1, 1, 1, 2]
SCATTER_GAP = 6

# symbol: [reel1..reel5] counts per strip of LENGTH (scatter placed separately)
BASE = {
    "W": [0, 5, 5, 4, 3],
    "H1": [3, 3, 3, 3, 3],
    "H2": [4, 4, 4, 4, 4],
    "H3": [4, 4, 4, 4, 4],
    "H4": [5, 5, 5, 5, 5],
    "M1": [7, 7, 7, 7, 7],
    "M2": [8, 8, 8, 8, 8],
    "M3": [8, 8, 8, 8, 8],
    "M4": [9, 9, 9, 9, 9],
    "L1": [17, 16, 16, 16, 17],
    "L2": [17, 16, 16, 16, 17],
    "L3": [17, 16, 16, 16, 17],
    "L4": [17, 16, 16, 16, 17],
}
BASE_SCATTERS = [3, 3, 3, 3, 3]

# Bonus strips: more wilds and highs, fewer lows.
FREE = {
    "W": [0, 5, 5, 5, 5],
    "H1": [6, 6, 6, 6, 6],
    "H2": [7, 7, 7, 7, 7],
    "H3": [8, 8, 8, 8, 8],
    "H4": [8, 8, 8, 8, 8],
    "M1": [9, 9, 9, 9, 9],
    "M2": [9, 9, 9, 9, 9],
    "M3": [9, 9, 9, 9, 9],
    "M4": [9, 9, 9, 9, 9],
    "L1": [9, 9, 9, 9, 9],
    "L2": [9, 9, 9, 9, 9],
    "L3": [9, 9, 9, 9, 9],
    "L4": [9, 9, 9, 9, 9],
}
FREE_SCATTERS = [2, 2, 2, 2, 2]


def build_reel(weights: dict, reel: int, scatters: int, rng: random.Random) -> list[str]:
    pool = [s for s, counts in weights.items() for _ in range(counts[reel])]
    pool += ["L1"] * (LENGTH - scatters - len(pool))  # pad to length with the commonest low
    pool = pool[: LENGTH - scatters]
    # stack symbols in runs of 1-3 so lines connect and cascades chain (wilds stay single)
    counts = {}
    for sym in pool:
        counts[sym] = counts.get(sym, 0) + 1
    runs = []
    for sym, c in counts.items():
        while c > 0:
            k = 1 if sym == "W" else min(c, rng.choice(STACKS))
            runs.append([sym] * k)
            c -= k
    rng.shuffle(runs)
    pool = [sym for run in runs for sym in run]
    step = LENGTH // max(scatters, 1)
    assert scatters == 0 or step >= SCATTER_GAP, "too many scatters for the gap rule"
    for k in range(scatters):  # evenly spaced, then jittered within the gap
        pos = min(k * step + rng.randrange(step - SCATTER_GAP + 1), len(pool))
        pool.insert(pos, "S")
    return pool


def write(name: str, weights: dict, scatters: list[int], seed: int) -> None:
    rng = random.Random(seed)
    reels = [build_reel(weights, r, scatters[r], rng) for r in range(5)]
    out = Path(__file__).resolve().parent.parent / "reels" / name
    with out.open("w", newline="") as f:
        csv.writer(f).writerows(zip(*reels))  # one row per stop, one column per reel
    print(f"{name}: {len(reels[0])} stops x 5 reels")


if __name__ == "__main__":
    write("BR0.csv", BASE, BASE_SCATTERS, seed=1984)
    write("FR0.csv", FREE, FREE_SCATTERS, seed=1985)
