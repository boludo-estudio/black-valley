"""Natural (unforced) statistics for a mode: what the game does before the optimiser reweights it.
Use it to shape paytable and strips. Run from the math-sdk root:

    python games/black_valley/tools/natural_stats.py --mode base --criteria basegame --n 200000

Prints RTP, hit rate, std dev, cascades per round, scatter counts and a payout ladder.
"""

import argparse
import os
import random
import statistics
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from game_config import GameConfig  # noqa: E402
from gamestate import GameState  # noqa: E402
from src.wins.win_manager import WinManager  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", default="base")
    ap.add_argument("--criteria", default="basegame")
    ap.add_argument("--n", type=int, default=100_000)
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    config = GameConfig()
    gs = GameState(config)
    gs.betmode = args.mode
    gs.criteria = args.criteria
    bm = gs.get_betmode(args.mode)
    gs.win_manager = WinManager(config.basegame_type, config.freegame_type, bm.get_wincap())
    cost = bm.get_cost()

    # accept every round as drawn: no forcing, no repeats
    gs.check_repeat = lambda: setattr(gs, "repeat", False)
    gs.imprint_wins = lambda: None

    rng = random.Random(args.seed)
    wins, cascades, scatters, fs = [], [], {}, 0
    for i in range(args.n):
        gs.run_spin(i, rng.randrange(2**31))
        wins.append(gs.final_win / cost)
        cascades.append(getattr(gs, "cascades", 0))
        fs += 1 if gs.triggered_freegame else 0

    n = len(wins)
    rtp = sum(wins) / n
    hit = sum(1 for w in wins if w > 0) / n
    print(f"mode={args.mode} criteria={args.criteria} n={n:,}")
    print(f"RTP {rtp:.4f} | hit rate {hit:.3%} (1 in {1/hit:.2f}) | std dev {statistics.pstdev(wins):.3f}")
    print(f"profitable (>1x) {sum(1 for w in wins if w > 1)/n:.3%} | sub-stake wins {sum(1 for w in wins if 0 < w < 1)/n:.3%}")
    print(f"avg cascades {statistics.mean(cascades):.3f} | max {max(cascades)} | bonus triggers {fs} (1 in {n/fs if fs else float('inf'):.0f})")
    for t in (1, 2, 5, 10, 25, 50, 100, 500, 1000, 5000, 10000, 20000):
        c = sum(1 for w in wins if w >= t)
        print(f"  >= {t:>6}x : {c/n:.6%}" + (f"  (1 in {n/c:,.0f})" if c else ""))


if __name__ == "__main__":
    main()
