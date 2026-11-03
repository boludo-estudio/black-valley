"""Black Valley: one game round (book). Base spin with cascades and features; 3/4/5 choirs start
The Strike / The Uprising / Final Stand inside the same round."""

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
                self.start_bonus()

            self.evaluate_finalwin()
            if 0 < self.final_win < 1 and not self.triggered_freegame:
                self.record({"band": "sub", "gametype": self.config.basegame_type})   # optimiser group tag
            self.check_repeat()
        self.imprint_wins()

    def run_freespin(self):
        self.reset_fs_spin()
        self.global_multiplier = self.config.bonus_rules[self.bonus].get("start_mult", 1)
        if self.global_multiplier > 1:
            from src.events.events import update_global_mult_event
            update_global_mult_event(self)
        while self.fs < self.tot_fs and not self.wincap_triggered:
            self.update_freespin()
            self.draw_board()
            self.draw_bonus_features()
            self.apply_feature()
            self.play_cascades()
            if self.count_special_symbols("scatter") >= 3:
                self.retrigger_bonus()
            self.win_manager.update_gametype_wins(self.gametype)
        self.end_freespin()
