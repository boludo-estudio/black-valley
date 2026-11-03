"""Black Valley: line evaluation with cascades, the four features and the three bonuses.

Order on a spin (spec: Base-game features, Bonuses): the board lands (reveal) -> drawn features change it
(knock / fireExpand / villageTokens) -> cascades pay (The Pit multiplies mining wins; in The Uprising the
bonus multiplier applies and grows after every winning step) -> the collector collects -> the spin's totals.
Base spins draw at most one feature; bonus spins follow their bonus's rules.
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
        self.features_on = set()
        self.burning_reels = []
        self.tokens = []          # [(reel, row, value)] as they landed

    def draw_feature(self):
        """Base spin: pick at most one feature from the mode's weights (before anything is shown)."""
        self.reset_spin_features()
        weights = self.get_current_distribution_conditions().get("feature_weights", {}).get(self.gametype)
        if weights:
            self.feature = get_random_outcome(weights)
        if self.feature != "none":
            self.features_on = {self.feature}
            self.record({"feature": self.feature, "gametype": self.gametype})
        return self.feature

    def draw_bonus_features(self):
        """Bonus spin: features from the running bonus's rules."""
        self.reset_spin_features()
        rules = self.config.bonus_rules[self.bonus]
        if rules.get("always"):
            self.features_on = set(rules["always"])
        else:
            pick = get_random_outcome(rules["features"])
            self.features_on = set() if pick == "none" else {pick}
        self.feature = "+".join(sorted(self.features_on)) or "none"

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

    def apply_knock(self):
        def place():
            n = get_random_outcome(self._cond("knock_count"))
            spots = self._free_positions(range(1, 5))
            chosen = random.sample(spots, min(n, len(spots)))
            for r, w in chosen:
                self.board[r][w] = self.create_symbol("W")
            return chosen
        chosen = self._place_until_it_pays(place)
        if chosen is None:
            self.features_on.discard("knock")
        else:
            knock_event(self, chosen)

    def apply_fire(self, reels_key="fire_reels"):
        def place():
            n = get_random_outcome(self._cond(reels_key))
            reels = sorted(random.sample([1, 2, 3], n))
            for r in reels:
                for w in range(self.config.num_rows[r]):
                    if self.board[r][w].name != "S":
                        self.board[r][w] = self.create_symbol("W")
            return reels
        reels = self._place_until_it_pays(place)
        if reels is None:
            self.features_on.discard("fire")
        else:
            self.burning_reels = reels
            fire_expand_event(self, reels)

    def apply_village(self, values_key="token_values", count_key="token_count"):
        n = get_random_outcome(self._cond(count_key))
        spots = self._free_positions(range(0, 4))
        values = self._cond(values_key)
        for r, w in random.sample(spots, min(n, len(spots))):
            v = get_random_outcome(values)
            tok = self.create_symbol("T")
            tok.assign_attribute({"prize": v})
            self.board[r][w] = tok
            self.tokens.append((r, w, v))
        if not self.tokens:
            self.features_on.discard("village")
            return
        col_spots = self._free_positions([4]) or [(4, 0)]
        collector = random.choice(col_spots)
        self.board[collector[0]][collector[1]] = self.create_symbol("C")
        village_tokens_event(self, self.tokens, collector)

    def apply_feature(self):
        """Apply this spin's features in a fixed order: knock, fire, village."""
        in_bonus = self.gametype == self.config.freegame_type
        if "knock" in self.features_on:
            self.apply_knock()
        if "fire" in self.features_on:
            self.apply_fire("fs_fire_reels" if in_bonus and self.bonus == "final_stand" else "fire_reels")
        if "village" in self.features_on:
            if in_bonus and self.bonus == "final_stand":
                c = self.get_current_distribution_conditions()
                self.apply_village(c.get("fs_token_values", "fs_token_values"),
                                   c.get("fs_token_count", "fs_token_count"))
            else:
                self.apply_village()
        self.feature = "+".join(sorted(self.features_on)) or "none"
        self.get_special_symbols_on_board()

    # ---------------- cascades ----------------

    def apply_pit(self):
        """The Pit: every win paid on a mining symbol gets its own multiplier (never stacked with
        another Pit multiplier; it does multiply with the Uprising multiplier)."""
        if "pit" not in self.features_on:
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
                if pos["reel"] not in self.burning_reels:      # burning reels stay wild (for a while)
                    self.board[pos["reel"]][pos["row"]].explode = True
        Lines.record_lines_wins(self)
        self.win_manager.update_spinwin(self.win_data["totalWin"])
        self.emit_tumble_win_events()
        # The Uprising: the multiplier goes up by 1 after every winning cascade step
        if (self.gametype == self.config.freegame_type and self.bonus == "uprising"
                and self.win_data["totalWin"] > 0 and not self.wincap_triggered
                and self.global_multiplier < self.config.uprising_max_mult):
            self.update_global_mult()

    def collect_tokens(self):
        """After the last cascade the collector adds up every token still on the grid."""
        if "village" not in self.features_on or self.wincap_triggered:
            return
        on_grid = [(r, w, sym.get_attribute("prize")) for r, reel in enumerate(self.board)
                   for w, sym in enumerate(reel) if sym.name == "T"]
        if not on_grid:
            return
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

    # ---------------- bonuses ----------------

    def start_bonus(self):
        """Choirs on the trigger board decide the bonus: 3 Strike, 4 Uprising, 5 Final Stand."""
        n = min(self.count_special_symbols("scatter"), 5)
        self.bonus = self.config.bonus_by_scatters[n]
        self.record({"bonus": self.bonus, "gametype": self.gametype})
        self.update_freespin_amount()                      # emits freeSpinTrigger (totalFs from the config)
        self.tot_fs = self.config.bonus_rules[self.bonus]["spins"]
        trigger = self.book.events[-1]
        trigger["totalFs"] = self.tot_fs
        trigger["bonus"] = self.bonus
        self.run_freespin()

    def retrigger_bonus(self):
        rules = self.config.bonus_rules[self.bonus]
        if self.tot_fs >= rules["max"]:
            return
        self.tot_fs = min(self.tot_fs + rules["retrigger"], rules["max"])
        from src.events.events import fs_trigger_event
        fs_trigger_event(self, freegame_trigger=True, basegame_trigger=False)
        self.book.events[-1]["totalFs"] = self.tot_fs
        self.book.events[-1]["bonus"] = self.bonus
