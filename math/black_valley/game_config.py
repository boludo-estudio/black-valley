"""Black Valley: game configuration (math-sdk). Spec: Black Valley Maths & Mechanics Spec v0.1.

5x5, 25 fixed lines left to right (3+ from reel 1), cascades. Pays are x the total bet.
Stage 1: base game only. Features, bonuses and paid modes are added in stages 2-3.
"""

import os
from src.config.config import Config
from src.config.distributions import Distribution
from src.config.betmode import BetMode


class GameConfig(Config):

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        super().__init__()
        self.game_id = "black_valley"
        self.provider_number = 0
        self.working_name = "Black Valley"
        self.wincap = 20000.0          # x base bet, every mode (spec: Max win and cap)
        self.win_type = "lines"
        self.rtp = 0.9650
        self.max_cascades = 30         # safety stop (spec: Grid, lines and cascades)
        self.construct_paths()

        self.num_reels = 5
        self.num_rows = [5] * self.num_reels

        pays = {
            "W": (2.50, 10.00, 50.00),
            "H1": (2.50, 8.00, 40.00), "H2": (2.00, 5.00, 25.00),
            "H3": (1.50, 4.00, 20.00), "H4": (1.20, 3.00, 12.00),
            "M1": (1.00, 2.50, 8.00), "M2": (0.80, 2.00, 6.00),
            "M3": (0.80, 2.00, 6.00), "M4": (0.60, 1.50, 5.00),
            "L1": (0.50, 1.20, 4.00), "L2": (0.40, 1.00, 3.00),
            "L3": (0.40, 1.00, 3.00), "L4": (0.40, 1.00, 3.00),
        }
        self.paytable = {(k, sym): v for sym, vals in pays.items() for k, v in zip((3, 4, 5), vals)}
        self.mining_symbols = ["M1", "M2", "M3", "M4"]   # The Pit (stage 2)

        # Rows 0 (top) .. 4 (bottom). 5 straight rows + 20 shapes. Printed on the rules page.
        lines = [
            [0, 0, 0, 0, 0], [1, 1, 1, 1, 1], [2, 2, 2, 2, 2], [3, 3, 3, 3, 3], [4, 4, 4, 4, 4],
            [0, 1, 2, 1, 0], [4, 3, 2, 3, 4], [1, 2, 3, 2, 1], [3, 2, 1, 2, 3], [2, 3, 4, 3, 2],
            [2, 1, 0, 1, 2], [0, 1, 2, 3, 4], [4, 3, 2, 1, 0], [0, 0, 1, 0, 0], [4, 4, 3, 4, 4],
            [1, 1, 2, 1, 1], [3, 3, 2, 3, 3], [2, 2, 1, 2, 2], [2, 2, 3, 2, 2], [0, 1, 0, 1, 0],
            [4, 3, 4, 3, 4], [1, 0, 1, 0, 1], [3, 4, 3, 4, 3], [1, 2, 1, 2, 1], [3, 2, 3, 2, 3],
        ]
        self.paylines = {i + 1: line for i, line in enumerate(lines)}

        self.include_padding = True
        self.special_symbols = {"wild": ["W"], "scatter": ["S"], "token": ["T"], "collector": ["C"]}

        # Feature tables (spec: Base-game features). Weights, not probabilities.
        self.feature_values = {
            "knock_count": {3: 45, 4: 30, 5: 15, 6: 7, 8: 3},
            "pit_mults": {2: 45, 3: 30, 5: 17, 10: 8},
            "fire_reels": {1: 90, 2: 10},
            "token_count": {3: 35, 4: 25, 5: 18, 6: 12, 7: 6, 8: 4},
            "token_values": {0.2: 350, 0.5: 300, 1: 200, 2: 100, 5: 35, 10: 12, 25: 2.5, 50: 0.5},
            # Final Stand: 1-2 reels burn and the collector comes every spin, tokens up to 500x
            "fs_fire_reels": {1: 70, 2: 30},
            "fs_token_count": {3: 26, 4: 28, 5: 22, 6: 13, 7: 7, 8: 4},
            "fs_token_values": {0.5: 250, 1: 250, 2: 200, 5: 150, 10: 80, 25: 40, 50: 22, 100: 9, 250: 3, 500: 0.6},
            # route used only by the forced max-win simulations (same symbols, heavier top end)
            "fs_token_values_wcap": {250: 35, 500: 65},
            "fs_token_count_wcap": {7: 30, 8: 70},
        }
        # Per spin: Knock 1/55, Pit 1/20, Fire 1/100, Village 1/80 (out of 10,500)
        base_features = {"none": 9_548, "knock": 191, "pit": 525, "fire": 105, "village": 131}
        self.fire_burn_steps = 1      # burning reels stay wild for the first cascade step, then burn out

        # Bonuses (spec: Bonuses). Feature weights per bonus spin, out of 100.
        self.bonus_by_scatters = {3: "strike", 4: "uprising", 5: "final_stand"}
        self.bonus_rules = {
            "strike": {"spins": 10, "retrigger": 3, "max": 20,
                       "features": {"none": 47, "fire": 40, "knock": 6, "pit": 7}},
            "uprising": {"spins": 8, "retrigger": 2, "max": 16, "start_mult": 2,
                         "features": {"none": 66, "fire": 10, "knock": 12, "pit": 12}},
            "final_stand": {"spins": 6, "retrigger": 2, "max": 12, "always": ["fire", "village"]},
        }
        self.uprising_max_mult = 25   # the Uprising multiplier stops growing at x20

        # 3 choirs = The Strike, 4 = The Uprising, 5 = Final Stand (spins set by bonus_rules)
        self.freespin_triggers = {
            self.basegame_type: {3: 10, 4: 8, 5: 6},
            self.freegame_type: {3: 3, 4: 3, 5: 3},
        }
        self.anticipation_triggers = {self.basegame_type: 2, self.freegame_type: 2}

        reels = {"BR0": "BR0.csv", "FR0": "FR0.csv"}
        self.reels = {r: self.read_reels_csv(os.path.join(self.reels_path, f)) for r, f in reels.items()}
        self.padding_reels[self.basegame_type] = self.reels["BR0"]
        self.padding_reels[self.freegame_type] = self.reels["FR0"]

        def features(scale=1.0):
            f = {k: round(v * scale) for k, v in base_features.items() if k != "none"}
            f["none"] = 10_500 - sum(f.values())
            return f

        def cond(feature_scale=1.0, scatters=None, wincap=False):
            c = {
                "reel_weights": {self.basegame_type: {"BR0": 1}, self.freegame_type: {"FR0": 1}},
                "feature_weights": {self.basegame_type: features(feature_scale)},
                "force_wincap": wincap,
                "force_freegame": scatters is not None,
            }
            if scatters:
                c["scatter_triggers"] = scatters
            if wincap:
                c["fs_token_values"] = "fs_token_values_wcap"
                c["fs_token_count"] = "fs_token_count_wcap"
            return c

        natural_scatters = {3: 100, 4: 25, 5: 6}     # Strike 1/150 : Uprising 1/600 : Final Stand 1/2,500

        def spin_mode(name, cost, feature_scale, fs_quota):
            return BetMode(
                name=name, cost=cost, rtp=self.rtp, max_win=self.wincap, auto_close_disabled=False,
                is_feature=True, is_buybonus=False,
                distributions=[
                    Distribution(criteria="wincap", quota=0.001, win_criteria=self.wincap,
                                 conditions=cond(feature_scale, {5: 1}, wincap=True)),
                    Distribution(criteria="freegame", quota=fs_quota, conditions=cond(feature_scale, natural_scatters)),
                    Distribution(criteria="0", quota=0.4, win_criteria=0.0, conditions=cond(feature_scale)),
                    Distribution(criteria="basegame", quota=0.6 - fs_quota - 0.001, conditions=cond(feature_scale)),
                ],
            )

        def buy_mode(name, cost, scatters, with_wincap):
            dists = [Distribution(criteria="freegame", quota=0.999 if with_wincap else 1.0,
                                  conditions=cond(1.0, scatters))]
            if with_wincap:
                dists.insert(0, Distribution(criteria="wincap", quota=0.001, win_criteria=self.wincap,
                                             conditions=cond(1.0, scatters, wincap=True)))
            return BetMode(
                name=name, cost=cost, rtp=self.rtp, max_win=self.wincap, auto_close_disabled=False,
                is_feature=False, is_buybonus=True, distributions=dists,
            )

        # Spec: Modes, prices and RTP. Mode names carry no buy / bet / pay.
        self.bet_modes = [
            spin_mode("base", 1.0, 1.0, 0.1),
            spin_mode("more_features", 1.5, 2.0, 0.1),
            spin_mode("bonus_chance", 2.0, 1.0, 0.2),
            buy_mode("strike", 60.0, {3: 1}, with_wincap=False),
            buy_mode("uprising", 120.0, {4: 1}, with_wincap=False),
            buy_mode("final_stand", 250.0, {5: 1}, with_wincap=True),
        ]
