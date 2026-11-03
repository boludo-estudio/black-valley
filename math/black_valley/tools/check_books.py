"""Checks every book in a mode: events add up to the payout, event names are the agreed ones, order
is legal, the cap holds. Run from the math-sdk root after run.py:

    python games/black_valley/tools/check_books.py --mode base

Exit code 1 on any failure (first 10 printed).
"""

import argparse
import json
import os
import sys

import zstandard

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.join(HERE, "..", "library")

KNOWN = {
    "reveal", "knock", "fireExpand", "villageTokens", "pitMultiplier", "winInfo", "tumbleBoard",
    "updateTumbleWin", "collect", "updateGlobalMult", "freeSpinTrigger", "freeSpinRetrigger",
    "updateFreeSpin", "freeSpinEnd", "setWin", "setTotalWin", "wincap", "finalWin",
}
FEATURE_AFTER = {"knock", "fireExpand", "villageTokens"}   # must follow a reveal directly
CAP = 20000 * 100


def books(mode):
    path = os.path.join(LIB, "publish_files", f"books_{mode}.jsonl.zst")
    with open(path, "rb") as fh:
        reader = zstandard.ZstdDecompressor().stream_reader(fh)
        buf = b""
        while chunk := reader.read(1 << 20):
            buf += chunk
            *lines, buf = buf.split(b"\n")
            for line in lines:
                if line.strip():
                    yield json.loads(line)
        if buf.strip():
            yield json.loads(buf)


def check(book):
    ev = book["events"]
    errs = []
    types = [e["type"] for e in ev]
    unknown = set(types) - KNOWN
    if unknown:
        errs.append(f"unknown events {sorted(unknown)}")
    if types[0] != "reveal" or types[-1] != "finalWin":
        errs.append("must start with reveal and end with finalWin")
    for i, t in enumerate(types):
        if t in FEATURE_AFTER and types[i - 1] not in {"reveal"} | FEATURE_AFTER:
            errs.append(f"{t} at {i} does not follow a reveal")
        if t == "pitMultiplier" and "winInfo" not in types[i:i + 30]:
            errs.append(f"pitMultiplier at {i} has no win after it")
    paid = sum(w["win"] for e in ev if e["type"] == "winInfo" for w in e["wins"])
    paid += sum(e["amount"] for e in ev if e["type"] == "collect")
    final = ev[-1]["amount"]
    if final != book["payoutMultiplier"]:
        errs.append(f"finalWin {final} != payoutMultiplier {book['payoutMultiplier']}")
    if final > CAP:
        errs.append("over the 20,000x cap")
    if "wincap" not in types and abs(paid - final) > len(ev):   # rounding: at most 1 per event
        errs.append(f"events pay {paid}, book pays {final}")
    return errs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", default="base")
    args = ap.parse_args()
    n = bad = 0
    seen = {}
    for book in books(args.mode):
        n += 1
        for t in {e["type"] for e in book["events"]}:
            seen[t] = seen.get(t, 0) + 1
        errs = check(book)
        if errs:
            bad += 1
            if bad <= 10:
                print(f"book {book['id']}: {'; '.join(errs)}")
    print(f"{args.mode}: {n:,} books, {bad} failed")
    print("events seen (books containing them):", ", ".join(f"{k} {v:,}" for k, v in sorted(seen.items())))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
