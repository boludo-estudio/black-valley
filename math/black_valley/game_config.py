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
        self.special_symbols = {"wild": ["W"], "scatter": ["S"]}

        # 3 choirs = The Strike, 4 = The Uprising, 5 = Final Stand (stage 3 maps these to bonuses)
        self.freespin_triggers = {
            self.basegame_type: {3: 10, 4: 8, 5: 6},
            self.freegame_type: {3: 3, 4: 3, 5: 3},
        }
        self.anticipation_triggers = {self.basegame_type: 2, self.freegame_type: 2}

        reels = {"BR0": "BR0.csv", "FR0": "FR0.csv"}
        self.reels = {r: self.read_reels_csv(os.path.join(self.reels_path, f)) for r, f in reels.items()}
        self.padding_reels[self.basegame_type] = self.reels["BR0"]
        self.padding_reels[self.freegame_type] = self.reels["FR0"]

        basegame_condition = {
            "reel_weights": {self.basegame_type: {"BR0": 1}},
            "force_wincap": False,
            "force_freegame": False,
        }
        zerowin_condition = dict(basegame_condition)

        self.bet_modes = [
            BetMode(
                name="base",
                cost=1.0,
                rtp=self.rtp,
                max_win=self.wincap,
                auto_close_disabled=False,
                is_feature=True,
                is_buybonus=False,
                distributions=[
                    Distribution(criteria="0", quota=0.4, win_criteria=0.0, conditions=zerowin_condition),
                    Distribution(criteria="basegame", quota=0.6, conditions=basegame_condition),
                ],
            ),
        ]
