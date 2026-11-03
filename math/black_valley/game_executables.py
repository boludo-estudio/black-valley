"""Black Valley: line evaluation with cascades, and the four base-game features.

Feature order on a spin (spec: Base-game features): the board lands (reveal) -> the drawn feature
changes it (knock / fireExpand / villageTokens) -> cascades pay (The Pit multiplies mining wins) ->
the collector collects -> the spin's totals. At most one feature per base spin.
"""

import random

from game_calculations import GameCalculations
from game_events import (
    knock_event,
    fire_expand_event,
    village_tokens_event,
    pit_multiplier_event,
    collect_event,
)
from src.calculations.lines import Lines
from src.calculations.statistics import get_random_outcome


class GameExecutables(GameCalculations):

    # ---------------- feature set-up ----------------

    def reset_spin_features(self):
        self.feature = "none"
        self.burning_reels = []
        self.tokens = []          # [(reel, row, value)]
        self.collector = None

    def draw_feature(self):
        """Pick this spin's feature from the mode's weights (drawn before anything is shown)."""
        self.reset_spin_features()
        weights = self.get_current_distribution_conditions().get("feature_weights", {}).get(self.gametype)
        if weights:
            self.feature = get_random_outcome(weights)
        if self.feature != "none":
            self.record({"feature": self.feature, "gametype": self.gametype})
        return self.feature

    def _cond(self, key):
        return self.config.feature_values[key]

    def _free_positions(self, reels):
        return [(r, w) for r in reels for w in range(self.config.num_rows[r])
                if self.board[r][w].name not in ("S", "W", "T", "C")]

    def _pays(self):
        return Lines.get_lines(self.board, self.config, multiplier_method="global",
                               global_multiplier=self.global_multiplier)["totalWin"] > 0

    def _place_until_it_pays(self, place, tries=25):
        """The Knock and The Fire always pay (3-star rule: a feature that fires pays). Placement is
        part of the pre-generated round, so this is how the feature is defined, not a reaction to it."""
        original = [list(reel) for reel in self.board]
        for _ in range(tries):
            chosen = place()
            if self._pays():
                return chosen
            self.board = [list(reel) for reel in original]
        return None

    def apply_feature(self):
        if self.feature == "knock":
            def place():
                n = get_random_outcome(self._cond("knock_count"))
                spots = self._free_positions(range(1, 5))
                chosen = random.sample(spots, min(n, len(spots)))
                for r, w in chosen:
                    self.board[r][w] = self.create_symbol("W")
                return chosen
            chosen = self._place_until_it_pays(place)
            if chosen is None:
                self.feature = "none"
            else:
                knock_event(self, chosen)
        elif self.feature == "fire":
            def place():
                n = get_random_outcome(self._cond("fire_reels"))
                reels = sorted(random.sample([1, 2, 3], n))
                for r in reels:
                    for w in range(self.config.num_rows[r]):
                        if self.board[r][w].name != "S":
                            self.board[r][w] = self.create_symbol("W")
                return reels
            reels = self._place_until_it_pays(place)
            if reels is None:
                self.feature = "none"
            else:
                self.burning_reels = reels
                fire_expand_event(self, reels)
        elif self.feature == "village":
            n = get_random_outcome(self._cond("token_count"))
            spots = self._free_positions(range(0, 4))
            values = self._cond("token_values")
            for r, w in random.sample(spots, min(n, len(spots))):
                v = get_random_outcome(values)
                tok = self.create_symbol("T")
                tok.assign_attribute({"prize": v})
                self.board[r][w] = tok
                self.tokens.append((r, w, v))
            col_spots = self._free_positions([4])
            self.collector = random.choice(col_spots) if col_spots else (4, 0)
            self.board[self.collector[0]][self.collector[1]] = self.create_symbol("C")
            village_tokens_event(self, self.tokens, self.collector)
        self.get_special_symbols_on_board()

    # ---------------- cascades ----------------

    def apply_pit(self):
        """The Pit: every win paid on a mining symbol gets its own multiplier (never stacked)."""
        if self.feature != "pit":
            return
        mults = self._cond("pit_mults")
        total = 0
        for i, win in enumerate(self.win_data["wins"]):
            if win["symbol"] in self.config.mining_symbols:
                m = get_random_outcome(mults)
                win["win"] = round(win["win"] * m, 2)
                win["meta"]["pitMultiplier"] = m
                pit_multiplier_event(self, i, m)
            total += win["win"]
        self.win_data["totalWin"] = round(total, 2)

    def evaluate_lines_cascade(self):
        """Pay every line win, mark winners for removal (not burning reels), emit events."""
        self.win_data = Lines.get_lines(
            self.board, self.config, multiplier_method="global", global_multiplier=self.global_multiplier
        )
        self.apply_pit()
        for win in self.win_data["wins"]:
            for pos in win["positions"]:
                if pos["reel"] not in self.burning_reels:      # burning reels stay wild all spin
                    self.board[pos["reel"]][pos["row"]].explode = True
        Lines.record_lines_wins(self)
        self.win_manager.update_spinwin(self.win_data["totalWin"])
        self.emit_tumble_win_events()

    def collect_tokens(self):
        """After the last cascade the collector adds up every token on the grid."""
        if self.feature != "village" or not self.tokens or self.wincap_triggered:
            return
        # tokens drop with the cascades: read where they are now
        on_grid = [(r, w, sym.get_attribute("prize")) for r, reel in enumerate(self.board)
                   for w, sym in enumerate(reel) if sym.name == "T"]
        total = round(sum(v for _, _, v in on_grid), 2)
        self.win_manager.update_spinwin(total)
        collect_event(self, total, on_grid)
        self.evaluate_wincap()

    def play_cascades(self):
        """evaluate -> pay -> remove -> drop/refill -> re-evaluate, until no win, the cap or the
        safety stop; then the collector; then the spin's totals."""
        self.cascades = 0
        self.evaluate_lines_cascade()
        while (
            self.win_data["totalWin"] > 0
            and not self.wincap_triggered
            and self.cascades < self.config.max_cascades
            and self._has_removable()
        ):
            self.cascades += 1
            if self.cascades > self.config.fire_burn_steps:
                self.burning_reels = []          # the fire burns out: those wilds now go like any other
            self.tumble_game_board()
            self.evaluate_lines_cascade()
        self.collect_tokens()
        self.set_end_tumble_event()

    def _has_removable(self):
        return any(sym.explode for reel in self.board for sym in reel)
