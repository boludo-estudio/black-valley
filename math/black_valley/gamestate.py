"""Black Valley: one game round (book). Stage 2: base game with cascades and the four features."""

from game_override import GameStateOverride


class GameState(GameStateOverride):

    def run_spin(self, sim, simulation_seed=None):
        self.reset_seed(sim)
        self.repeat = True
        while self.repeat:
            self.reset_book()
            self.draw_board()
            self.draw_feature()
            self.apply_feature()
            self.play_cascades()
            self.win_manager.update_gametype_wins(self.gametype)

            if self.check_fs_condition() and self.check_freespin_entry():
                self.run_freespin_from_base()

            self.evaluate_finalwin()
            self.check_repeat()
        self.imprint_wins()

    def run_freespin(self):
        """Placeholder bonus (stage 3 replaces it with Strike / Uprising / Final Stand)."""
        self.reset_fs_spin()
        while self.fs < self.tot_fs and not self.wincap_triggered:
            self.update_freespin()
            self.draw_board()
            self.play_cascades()
            if self.check_fs_condition():
                self.update_fs_retrigger_amt()
            self.win_manager.update_gametype_wins(self.gametype)
        self.end_freespin()
