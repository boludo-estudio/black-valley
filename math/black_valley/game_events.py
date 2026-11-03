"""Black Valley: custom book events (spec: Events, the contract with the art team).

Positions follow the SDK's winInfo convention: row + 1 when the board carries a padding row on top.
Amounts are integers in hundredths of the bet, like every SDK event.
"""


def _pos(gs, reel, row):
    return {"reel": reel, "row": row + (1 if gs.config.include_padding else 0)}


def _add(gs, event):
    gs.book.add_event({"index": len(gs.book.events), **event})


def knock_event(gs, positions):
    """The Knock: these positions turn into lamp wilds."""
    _add(gs, {"type": "knock", "positions": [_pos(gs, r, w) for r, w in positions]})


def fire_expand_event(gs, reels):
    """The Fire: these reels burn and become wild for the rest of the spin."""
    _add(gs, {"type": "fireExpand", "reels": list(reels)})


def village_tokens_event(gs, tokens, collector):
    """The Village Fights Back: tokens [(reel, row, value)] and the collector (reel, row) land."""
    _add(gs, {
        "type": "villageTokens",
        "tokens": [{**_pos(gs, r, w), "value": int(round(v * 100))} for r, w, v in tokens],
        "collector": _pos(gs, *collector),
    })


def pit_multiplier_event(gs, win_index, mult):
    """The Pit: the win at index `win_index` of the next winInfo is multiplied by `mult`."""
    _add(gs, {"type": "pitMultiplier", "winIndex": win_index, "multiplier": int(mult)})


def collect_event(gs, total, tokens):
    """The collector adds up every token: `total` is paid on top of line wins."""
    _add(gs, {"type": "collect", "amount": int(round(total * 100)),
              "positions": [_pos(gs, r, w) for r, w, _ in tokens]})
