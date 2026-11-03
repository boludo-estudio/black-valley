"""Report on the optimised lookup tables (what the RGS actually serves). Run from the math-sdk root:

    python games/black_valley/tools/lut_report.py               # all modes, markdown table + ladder
    python games/black_valley/tools/lut_report.py --modes base

Numbers are exact over the published weights: RTP, hit rate, std dev, bonus odds by bonus, cap odds,
payout ladder (x base bet).
"""

import argparse
import csv
import json
import math
import os

import zstandard

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.join(HERE, "..", "library")
CAP = 2_000_000
LADDER = (1, 2, 5, 10, 25, 50, 100, 500, 1000, 5000, 10000, 20000)


def load_index():
    with open(os.path.join(LIB, "publish_files", "index.json")) as f:
        return {m["name"]: m for m in json.load(f)["modes"]}


def bonus_by_sim(mode):
    out = {}
    path = os.path.join(LIB, "publish_files", f"books_{mode}.jsonl.zst")
    with open(path, "rb") as fh:
        data = zstandard.ZstdDecompressor().stream_reader(fh).read()
    for line in data.splitlines():
        if not line.strip():
            continue
        b = json.loads(line)
        for e in b["events"]:
            if e["type"] == "freeSpinTrigger" and "bonus" in e:
                out[b["id"]] = e["bonus"]
                break
    return out


def report(mode, cost):
    rows = []
    with open(os.path.join(LIB, "publish_files", f"lookUpTable_{mode}_0.csv")) as f:
        for sim, w, p in csv.reader(f):
            rows.append((int(sim), int(w), int(p)))
    total = sum(w for _, w, _ in rows)
    mean = sum(w * p for _, w, p in rows) / total / 100
    var = sum(w * (p / 100 - mean) ** 2 for _, w, p in rows) / total
    hit = sum(w for _, w, p in rows if p > 0) / total
    cap = sum(w for _, w, p in rows if p >= CAP) / total
    bonus = bonus_by_sim(mode)
    bw = {}
    for sim, w, _ in rows:
        if sim in bonus:
            bw[bonus[sim]] = bw.get(bonus[sim], 0) + w
    ladder = {t: sum(w for _, w, p in rows if p >= t * 100) / total for t in LADDER}
    return {
        "mode": mode, "cost": cost, "rtp": mean / cost, "hit": hit, "std": math.sqrt(var),
        "beats_cost": sum(w for _, w, p in rows if p > cost * 100) / total,
        "bonus": {k: v / total for k, v in bw.items()}, "cap": cap,
        "max": max(p for _, w, p in rows if w > 0) / 100, "ladder": ladder, "books": len(rows),
    }


def odds(p):
    return f"1 in {1/p:,.0f}" if p > 0 else "never"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--modes", nargs="*")
    args = ap.parse_args()
    idx = load_index()
    modes = args.modes or list(idx)
    res = [report(m, idx[m]["cost"]) for m in modes]
    print("| Mode | Cost | RTP | Hit rate | Beats cost | Std dev | Strike | Uprising | Final Stand | 20,000x | Max | Books |")
    print("|---|---|---|---|---|---|---|---|---|---|---|---|")
    for r in res:
        b = r["bonus"]
        print(f"| {r['mode']} | {r['cost']:g}x | {r['rtp']:.4%} | {r['hit']:.2%} | {r['beats_cost']:.2%} | {r['std']:.2f} | "
              f"{odds(b.get('strike', 0))} | {odds(b.get('uprising', 0))} | {odds(b.get('final_stand', 0))} | "
              f"{odds(r['cap'])} | {r['max']:,.0f}x | {r['books']:,} |")
    print("\nPayout ladder (share of rounds paying at least N x base bet)")
    print("| Mode | " + " | ".join(f">={t:,}x" for t in LADDER) + " |")
    print("|---|" + "---|" * len(LADDER))
    for r in res:
        print(f"| {r['mode']} | " + " | ".join(odds(r['ladder'][t]) for t in LADDER) + " |")


if __name__ == "__main__":
    main()
