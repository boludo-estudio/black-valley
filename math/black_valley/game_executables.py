"""Black Valley: line evaluation with cascades."""

from game_calculations import GameCalculations
from src.calculations.lines import Lines


class GameExecutables(GameCalculations):

    def evaluate_lines_cascade(self):
        """Pay every line win on the current board, mark winning symbols to be removed, emit events.

        Wilds inside a win are removed with it; choir scatters never take part in a line.
        """
        self.win_data = Lines.get_lines(
            self.board, self.config, multiplier_method="global", global_multiplier=self.global_multiplier
        )
        for win in self.win_data["wins"]:
            for pos in win["positions"]:
                self.board[pos["reel"]][pos["row"]].explode = True
        Lines.record_lines_wins(self)
        self.win_manager.update_spinwin(self.win_data["totalWin"])
        self.emit_tumble_win_events()

    def play_cascades(self):
        """evaluate -> pay -> remove -> drop/refill -> re-evaluate, until no win, the cap or the safety stop."""
        self.cascades = 0
        self.evaluate_lines_cascade()
        while (
            self.win_data["totalWin"] > 0
            and not self.wincap_triggered
            and self.cascades < self.config.max_cascades
        ):
            self.cascades += 1
            self.tumble_game_board()
            self.evaluate_lines_cascade()
        self.set_end_tumble_event()
