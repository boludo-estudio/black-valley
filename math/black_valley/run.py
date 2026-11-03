"""Black Valley: simulate, optimise, analyse, check. Run from the math-sdk root:

    python games/black_valley/run.py --sims 1000000                # all modes, full pipeline
    python games/black_valley/run.py --modes base --sims 20000 --no-opt   # quick look

Outputs land in games/black_valley/library/ (books, lookup tables, publish_files).
"""

import argparse

from gamestate import GameState
from game_config import GameConfig
from game_optimization import OptimizationSetup
from optimization_program.run_script import OptimizationExecution
from utils.game_analytics.run_analysis import create_stat_sheet
from utils.rgs_verification import execute_all_tests
from src.state.run_sims import create_books
from src.write_data.write_configs import generate_configs

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--modes", nargs="*", default=None, help="default: every mode in game_config")
    ap.add_argument("--sims", type=int, default=1_000_000)
    ap.add_argument("--threads", type=int, default=8)
    ap.add_argument("--rust-threads", type=int, default=16)
    ap.add_argument("--no-opt", action="store_true", help="skip the optimiser")
    ap.add_argument("--no-analysis", action="store_true")
    ap.add_argument("--no-checks", action="store_true")
    args = ap.parse_args()

    config = GameConfig()
    gamestate = GameState(config)
    modes = args.modes or [bm.get_name() for bm in config.bet_modes]
    num_sim_args = {m: args.sims for m in modes}

    create_books(gamestate, config, num_sim_args, batch_size=max(args.sims // args.threads, 1),
                 threads=args.threads, compress=True, profiling=False)
    generate_configs(gamestate)

    if not args.no_opt:
        OptimizationSetup(config)
        OptimizationExecution().run_all_modes(config, modes, args.rust_threads)
        generate_configs(gamestate)

    if not args.no_analysis:
        OptimizationSetup(config)
        create_stat_sheet(gamestate, custom_keys=[{"symbol": "scatter"}])

    if not args.no_checks:
        execute_all_tests(config)
