"""Black Valley: optimiser targets per mode (spec: Modes, prices and RTP; Max win and cap).

Condition rtp is per unit of mode cost: contribution = P(criteria) x average win / cost. They sum to 0.965.
hr = 1 in N rounds land in that criteria.

    base           wincap 1 in ~8M  | bonus (any) 1 in 250  | spins beating the stake 1 in 6.7 (A) / 10 (B),
                   sub-stake wins 1 in 4.55 (A) / 3.6 (B)  -> hit rate ~37%
    more_features  same split, bonuses 1 in 180 (more features feed more bonuses)
    bonus_chance   bonuses 1 in 64 (about 4x base), spins 1 in 3.0
    strike / uprising / final_stand   the whole price is the bonus; final_stand carries the max-win rounds

Model A (steadier) vs Model B (spikier): set BV_MODEL=A or B before running. Only the shape of the
base-game and bonus payouts changes; every mode's RTP stays 96.50%.
"""

import os

from optimization_program.optimization_config import (
    ConstructScaling,
    ConstructParameters,
    ConstructConditions,
    ConstructFenceBias,
    verify_optimization_input,
)

RTP = 0.965
WINCAP_RTP = 0.0025
SUB_AVG = 0.55      # below-stake wins run 0.40x-0.90x, natural average 0.55x
LOW_AVG = 1.31      # 1x-2x wins, natural average 1.31x


def scaling(model):
    if model == "B":   # spikier: fewer small wins, more weight on 50x+ and big bonuses
        return [
            {"criteria": "basegame", "scale_factor": 0.85, "win_range": (0.1, 1), "probability": 1.0},
            {"criteria": "basegame", "scale_factor": 1.4, "win_range": (25, 200), "probability": 1.0},
            {"criteria": "freegame", "scale_factor": 0.8, "win_range": (1, 50), "probability": 1.0},
            {"criteria": "freegame", "scale_factor": 1.5, "win_range": (500, 5000), "probability": 1.0},
        ]
    return [               # A, steadier: wins pulled from below the stake into 1x-5x, fewer extreme bonuses
        {"criteria": "basegame", "scale_factor": 0.6, "win_range": (0.01, 1), "probability": 1.0},
        {"criteria": "basegame", "scale_factor": 0.8, "win_range": (1, 2), "probability": 1.0},
        {"criteria": "basegame", "scale_factor": 1.8, "win_range": (2, 10), "probability": 1.0},
        {"criteria": "basegame", "scale_factor": 1.2, "win_range": (10, 20), "probability": 1.0},
        {"criteria": "basegame", "scale_factor": 0.8, "win_range": (50, 500), "probability": 1.0},
        {"criteria": "freegame", "scale_factor": 1.2, "win_range": (20, 200), "probability": 1.0},
        {"criteria": "freegame", "scale_factor": 0.8, "win_range": (1000, 10000), "probability": 1.0},
    ]


def params(test_spins, model="A"):
    # mean-to-median of each fence: Engine's sample uses 4-8, which forces most wins far below the
    # stake. A (steadier) 1-3, B (spikier) 3-6.
    lo, hi = (1.0, 3.0) if model == "A" else (3.0, 6.0)
    return ConstructParameters(
        num_show=5000, num_per_fence=10000, min_m2m=lo, max_m2m=hi, pmb_rtp=1.0, sim_trials=5000,
        test_spins=test_spins, test_weights=[0.3, 0.4, 0.3], score_type="rtp",
    ).return_dict()


class OptimizationSetup:

    def __init__(self, game_config):
        self.game_config = game_config
        model = os.environ.get("BV_MODEL", "A").upper()
        cap = {bm.get_name(): bm.get_wincap() for bm in game_config.bet_modes}

        # Normal-spin wins are split by size so the share of spins that beat the stake is set directly:
        # "sub" = wins below the stake, "basegame" = everything else left (1x and up).
        #            beats-stake 1 in N, sub-stake 1 in N
        # Normal-spin wins are split by size so their shape is set directly:
        # "sub" below the stake, "low" 1x-2x, "basegame" = everything else left (2x and up).
        #          sub 1 in N, low 1 in N, 2x+ 1 in N (per mode: base / more_features / bonus_chance)
        shape = {
            "A": {"sub": 4.55, "low": 13.3, "big": {"base": 11, "more_features": 7.5, "bonus_chance": 11}},
            "B": {"sub": 4.2, "low": 14.0, "big": {"base": 16, "more_features": 11, "bonus_chance": 16}},
        }[model]

        def spin_mode(name, fs_hr, fs_rtp, cost):
            sub_rtp = round(SUB_AVG / (shape["sub"] * cost), 5)
            low_rtp = round(LOW_AVG / (shape["low"] * cost), 5)
            base_rtp = round(RTP - fs_rtp - WINCAP_RTP - sub_rtp - low_rtp, 5)
            return {
                "conditions": {
                    "wincap": ConstructConditions(rtp=WINCAP_RTP, av_win=cap[name], search_conditions=cap[name]).return_dict(),
                    "0": ConstructConditions(rtp=0, av_win=0, search_conditions=0).return_dict(),
                    "freegame": ConstructConditions(rtp=fs_rtp, hr=fs_hr, search_conditions={"symbol": "scatter"}).return_dict(),
                    "sub": ConstructConditions(rtp=sub_rtp, hr=shape["sub"], search_conditions={"band": "sub"}).return_dict(),
                    "low": ConstructConditions(rtp=low_rtp, hr=shape["low"], search_conditions={"band": "low"}).return_dict(),
                    "basegame": ConstructConditions(rtp=base_rtp, hr=shape["big"][name]).return_dict(),
                },
                "scaling": ConstructScaling(scaling(model)).return_dict(),
                "parameters": params([50, 100, 200], model),
                "distribution_bias": ConstructFenceBias(
                    applied_criteria=["basegame"], bias_ranges=[(2.0, 8.0)], bias_weights=[0.5]
                ).return_dict(),
            }

        def buy_mode(name, with_wincap):
            conds = {"freegame": ConstructConditions(rtp=round(RTP - (WINCAP_RTP if with_wincap else 0), 5), hr="x").return_dict()}
            if with_wincap:
                conds["wincap"] = ConstructConditions(rtp=WINCAP_RTP, av_win=cap[name], search_conditions=cap[name]).return_dict()
            return {
                "conditions": conds,
                "scaling": ConstructScaling(
                    [s for s in scaling(model) if s["criteria"] == "freegame"]
                ).return_dict(),
                "parameters": params([10, 20, 50], model),
                "distribution_bias": ConstructFenceBias(
                    applied_criteria=["freegame"], bias_ranges=[(0.5, 1.5)], bias_weights=[0.3]
                ).return_dict(),
            }

        self.game_config.opt_params = {
            "base": spin_mode("base", fs_hr=250, fs_rtp=0.30, cost=1.0),
            "more_features": spin_mode("more_features", fs_hr=180, fs_rtp=0.30, cost=1.5),
            "bonus_chance": spin_mode("bonus_chance", fs_hr=64, fs_rtp=0.6325, cost=2.0),
            "strike": buy_mode("strike", False),
            "uprising": buy_mode("uprising", False),
            "final_stand": buy_mode("final_stand", True),
        }
        verify_optimization_input(self.game_config, self.game_config.opt_params)
