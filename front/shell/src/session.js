// hustle-shell/src/session.js
// The game-agnostic controller: live, demo and replay boot; bets; settlement; recovery;
// autoplay; confirmations; mute; jurisdiction flags. Ported from Stoned Pandas v3 controller.js
// with every Stoned-Pandas-specific piece (Booster, buy tiers, 7x7 book) moved into the game config.
//
// A game supplies:
//   config    – see game.config.example.js (modes with cost / rtp / maxWin, validateBook, ...)
//   presenter – {present(book, betMicro, {mode, cost, replay}) → Promise<{feature?: boolean}>}
//   ui        – optional overrides; anything missing falls back to DefaultUi (src/ui-default.js)
//   sound     – optional {setMuted(bool)}
//
// Rules enforced here (Source: studio.engine.io/docs/approval-guidelines, .../rgs/wallet):
//  - authenticate before any bet; an auth failure never falls back to demo;
//  - an unfinished round from authenticate is presented, settled, and its bet restored first;
//  - one round at a time; bet controls locked until the round is settled;
//  - never send play when balance < bet x cost; show a message instead;
//  - end-round only when round.active (0x rounds are already closed);
//  - any mode costing more than 2x is confirmed; autoplay is confirmed;
//  - autoplay stops on a feature, a big win, an error, or a jurisdiction that disables it;
//  - replay makes zero wallet calls and has no route into real play.

import {launchParams, launchKind} from './launch.js';
import {RgsClient, RgsError, fetchReplay, replayRound} from './rgs.js';
import {makeValidator} from './book.js';
import {winFor, formatMoney} from './money.js';
import {socialText} from './social.js';

const DEMO_BALANCE = 10_000_000_000;
const DEMO_LEVELS = [10_000, 20_000, 50_000, 100_000, 200_000, 500_000, 1_000_000, 2_000_000, 5_000_000,
  10_000_000, 20_000_000, 50_000_000, 100_000_000];
const DEFAULT_BET = 1_000_000;
const CONFIRM_ABOVE_COST = 2;

export class Session {
  constructor({config, presenter, ui, sound = null, fetcher, params}) {
    if (!config?.modes || !Object.keys(config.modes).length) throw new Error('config.modes is required');
    if (typeof presenter?.present !== 'function') throw new Error('presenter.present(book, bet, opts) is required');
    this.config = config;
    this.presenter = presenter;
    this.ui = ui;
    this.sound = sound;
    this.fetcher = fetcher;
    this.params = params || launchParams();
    this.kind = launchKind(this.params);
    this.social = this.params.social;
    this.validate = makeValidator(config.validateBook, {maxWinX: maxWinOf(config)});
    this.modes = Object.fromEntries(Object.entries(config.modes).map(([k, v]) => [k, {...v}]));
    this.mode = baseModeName(this.modes);
    this.jurisdiction = {};
    this.balance = DEMO_BALANCE;
    this.currency = 'USD';
    this.betLevels = DEMO_LEVELS;
    this.bet = DEFAULT_BET;
    this.busy = false;
    this.ready = false;
    this.autoLeft = 0;
    this.muted = false;
    this.turbo = false;
    this.client = null;
    this.replay = null;
  }

  /* ---------------- text ---------------- */

  /** Every string the shell shows goes through here, so social mode is never missed. */
  t(text) { return socialText(text, this.social); }
  money(micro, kind = 'win') { return formatMoney(micro, this.currency, {kind}); }

  /* ---------------- modes ---------------- */

  modeEntry(name) {
    if (this.modes[name]) return this.modes[name];
    const key = Object.keys(this.modes).find(k => k.toLowerCase() === String(name ?? '').toLowerCase());
    return key ? this.modes[key] : undefined;
  }
  modeKey(name) {
    return Object.keys(this.modes).find(k => k.toLowerCase() === String(name ?? '').toLowerCase()) || name;
  }
  cost(name = this.mode) { return Number(this.modeEntry(name)?.cost ?? 1); }
  /** What a round really debits: base bet x the mode's cost multiplier. */
  stake(name = this.mode) { return Math.round(this.bet * this.cost(name)); }
  offered(name) {
    const m = this.modeEntry(name);
    if (!m) return false;
    if (this.jurisdiction.disabledBuyFeature && (m.buy || m.cost > 1)) return false;
    if (Number.isSafeInteger(m.maxBet) && this.bet > m.maxBet) return false;
    return true;
  }
  label(name) {
    const m = this.modeEntry(name) || {};
    return this.t((this.social && m.socialLabel) || m.label || name);
  }
  get offeredModes() { return Object.keys(this.modes).filter(m => this.offered(m)); }

  /* ---------------- boot ---------------- */

  async boot(progress = () => {}) {
    const body = globalThis.document?.body;
    if (body) { body.dataset.device = this.params.device; body.dataset.social = String(this.social); }
    if (this.kind === 'replay') return this.bootReplay(progress);
    if (this.kind === 'live') await this.bootLive(progress);
    else await this.bootDemo(progress);
    const j = this.jurisdiction;
    this.ui.setAvailability?.({
      autoplay: !j.disabledAutoplay, turbo: !j.disabledTurbo, spacebar: !j.disabledSpacebar,
      fullscreen: !j.disabledFullscreen, modes: this.offeredModes,
    });
    this.sync();
    if (this.pendingRecovery) {
      const p = this.pendingRecovery;
      this.pendingRecovery = null;
      await this.recover(p);
    }
    this.ready = true;
    this.ui.setBusy?.(false);
  }

  async bootLive(progress) {
    progress(0.2, 'Connecting');
    const p = this.params;
    this.client = new RgsClient({rgsUrl: p.rgsUrl, sessionID: p.sessionID, language: p.lang, fetcher: this.fetcher, validate: this.validate});
    let auth;
    try { auth = await this.client.authenticate(); }
    catch (error) {
      this.ui.fatal(this.t('Could not start the session'), this.t(error.message || String(error)));
      throw error;
    }
    const c = auth.config;
    this.balance = auth.balance.amount;
    this.currency = auth.balance.currency;
    this.betLevels = c.betLevels;
    this.jurisdiction = c.jurisdiction || {};
    if (this.jurisdiction.socialCasino) this.social = true;
    // Live spec: config.gameModes [{mode, costMultiplier, maxBet}]. When present, its prices win
    // over the build's config (they come from the same index.json the RGS serves).
    for (const gm of Array.isArray(c.gameModes) ? c.gameModes : []) {
      const key = this.modeKey(gm.mode);
      const entry = this.modes[key] || (this.modes[key] = {label: gm.mode});
      entry.rgsName = gm.mode;                                // send the RGS's exact spelling
      if (Number(gm.costMultiplier) > 0) entry.cost = Number(gm.costMultiplier);
      if (Number.isSafeInteger(gm.maxBet)) entry.maxBet = gm.maxBet;
    }
    this.bet = this.betLevels.includes(c.defaultBetLevel) ? c.defaultBetLevel
      : (this.betLevels.find(v => v >= DEFAULT_BET) ?? this.betLevels[0]);
    const pending = auth.pending?.active ? auth.pending : null;
    if (pending) {
      const bet = this.baseBetOf(pending);
      if (this.betLevels.includes(bet)) this.bet = bet;          // refresh mid-round keeps the bet
      pending.bet = bet;
      this.pendingRecovery = pending;
    }
    this.ui.setMode?.('live');
    progress(1, 'Ready');
  }

  async bootDemo(progress) {
    progress(0.2, 'Loading rounds');
    let pack = globalThis.__DEMO_PACK;
    if (!pack && this.config.demoPack) {
      const res = await fetch(this.config.demoPack, {cache: 'no-cache'}).catch(() => null);
      pack = res?.ok ? await res.json() : null;
    }
    if (!pack) {
      const msg = `This link has no game session. Launch ${this.config.name || 'the game'} from the casino lobby.`;
      this.ui.fatal(this.t('Open this game from the lobby'), this.t(msg));
      throw new Error('No session and no demo pack');
    }
    this.demo = pack;
    for (const [mode, cost] of Object.entries(pack.costs || {})) if (this.modeEntry(mode)) this.modeEntry(mode).cost = cost;
    this.demoIndex = Object.fromEntries(Object.entries(pack.modes || {}).map(([m, r]) => [m, Math.floor(Math.random() * r.length)]));
    this.currency = this.social ? 'XSC' : (this.params.currency || 'USD');
    this.ui.setMode?.('demo');
    progress(1, 'Ready');
  }

  /** Base bet a resumed round was placed at: payout/multiplier, then amount, then amount/cost. */
  baseBetOf(round) {
    const levels = this.betLevels;
    const h = round.book?.payoutMultiplier;
    const fromPayout = h > 0 && round.payout > 0 ? Math.round(round.payout * 100 / h) : NaN;
    for (const v of [fromPayout, round.amount, round.amount / this.cost(round.mode)]) {
      if (levels.includes(Math.round(v))) return Math.round(v);
    }
    return this.bet;
  }

  async recover(pending) {
    this.setBusy(true);
    this.ui.note?.(this.t('Finishing your previous round'));
    try {
      if (pending.book) {
        await this.presenter.present(pending.book, pending.bet ?? this.bet,
          {mode: pending.mode, cost: this.cost(pending.mode), recovery: true});
        this.ui.setWin?.(winFor(pending.bet ?? this.bet, pending.book.payoutMultiplier));
      }
      const settled = await this.client.endRound();
      if (settled?.balance) this.balance = settled.balance.amount;
    } catch (error) { this.fail(error); }
    finally { this.sync(); this.setBusy(false); }
  }

  /* ---------------- bet controls ---------------- */

  canAct() { return this.kind !== 'replay' && this.ready && !this.busy && this.autoLeft === 0; }

  stepBet(direction) {
    if (!this.canAct()) return;
    const i = Math.max(0, this.betLevels.indexOf(this.bet));
    this.bet = this.betLevels[Math.min(this.betLevels.length - 1, Math.max(0, i + direction))];
    this.sync();
  }

  setBet(micro) {
    if (!this.canAct() || !this.betLevels.includes(micro)) return;
    this.bet = micro;
    this.sync();
  }

  setMuted(muted = !this.muted) {
    this.muted = muted;
    this.sound?.setMuted?.(muted);
    this.ui.setMuted?.(muted);
  }

  setTurbo(on = !this.turbo) {
    if (this.jurisdiction.disabledTurbo) on = false;
    this.turbo = on;
    this.presenter.turbo = on;
    this.ui.setTurbo?.(on);
  }

  setBusy(busy) { this.busy = busy; this.ui.setBusy?.(busy, {auto: this.autoLeft > 0}); }

  sync() {
    this.ui.setBalance?.(this.balance, this.money(this.balance, 'balance'));
    this.ui.setBet?.(this.bet, this.money(this.stake(this.mode)), this.mode);
  }

  /* ---------------- rounds ---------------- */

  /** The spin button and the spacebar both land here. */
  spin() { return this.autoLeft > 0 ? this.stopAuto() : this.play(this.mode); }

  /**
   * One paid round in `mode`. Confirms modes costing more than 2x (Engine front-end rule).
   * Resolves {x, feature, mode} or null when nothing was bet.
   */
  async play(mode = this.mode, {confirmed = false} = {}) {
    if (this.kind === 'replay' || !this.ready || this.busy) return null;
    if (!this.offered(mode)) return null;
    if (this.client?.uncertain) {
      this.ui.note?.(this.t('Connection interrupted. Reload the game to continue.'));
      return null;
    }
    const stake = this.stake(mode);
    if (this.balance < stake) { this.ui.note?.(this.t('Insufficient balance for this bet.')); return null; }
    if (!confirmed && this.cost(mode) > CONFIRM_ABOVE_COST && this.autoLeft === 0) {
      const ok = await this.ui.confirm(this.t(`${this.label(mode)} costs ${this.money(stake)} (${this.cost(mode)}x the bet). Continue?`),
        {ok: this.t(`Buy for ${this.money(stake)}`), cancel: this.t('Cancel')});
      if (!ok) return null;
    }
    this.setBusy(true);
    this.ui.setWin?.(0);
    try {
      let book;
      if (this.kind === 'live') {
        const round = await this.client.play(this.bet, this.modeEntry(mode).rgsName || this.modeKey(mode));
        this.balance = round.balance.amount;
        book = round.book;
      } else {
        book = this.demoRound(mode);
        this.balance -= stake;
      }
      this.sync();
      const shown = await this.presenter.present(book, this.bet, {mode, cost: this.cost(mode)}) || {};
      const win = winFor(this.bet, book.payoutMultiplier);
      if (this.kind === 'live') {
        const settled = await this.client.endRound();     // no-op when round.active === false
        if (settled?.balance) this.balance = settled.balance.amount;
      } else this.balance += win;
      this.ui.setWin?.(win, this.money(win));
      return {x: book.payoutMultiplier / 100, feature: Boolean(shown.feature), mode};
    } catch (error) {
      this.fail(error);
      return null;
    } finally {
      this.sync();
      this.setBusy(false);
    }
  }

  demoRound(mode) {
    const key = Object.keys(this.demo.modes).find(k => k.toLowerCase() === String(mode).toLowerCase());
    const rounds = this.demo.modes[key];
    if (!rounds?.length) throw new Error(`Demo pack has no rounds for ${mode}`);
    const raw = rounds[this.demoIndex[key]++ % rounds.length];
    return this.validate(structuredClone(raw));
  }

  /* ---------------- autoplay ---------------- */

  async startAuto(rounds) {
    if (!this.canAct() || this.jurisdiction.disabledAutoplay || !(rounds > 0)) return;
    const ok = await this.ui.confirm(this.t(`Start autoplay: ${rounds} spins at ${this.money(this.stake())} each?`),
      {ok: this.t('Start'), cancel: this.t('Cancel')});
    if (!ok) return;
    const stopX = this.config.autoplay?.stopAtWinX ?? 100;
    this.autoLeft = rounds;
    this.ui.setAuto?.(this.autoLeft);
    while (this.autoLeft > 0) {
      const r = await this.play(this.mode, {confirmed: true});
      if (!r) break;
      this.autoLeft -= 1;
      this.ui.setAuto?.(this.autoLeft);
      if (r.feature && this.config.autoplay?.stopOnFeature !== false) { this.ui.note?.(this.t('Autoplay stopped: feature played')); break; }
      if (r.x >= stopX) { this.ui.note?.(this.t('Autoplay stopped: big win')); break; }
      if (this.autoLeft > 0) await new Promise(res => setTimeout(res, this.turbo ? 120 : 340));
    }
    this.stopAuto();
  }

  stopAuto() {
    this.autoLeft = 0;
    this.ui.setAuto?.(0);
    this.ui.setBusy?.(this.busy, {auto: false});
  }

  /* ---------------- replay ---------------- */

  async bootReplay(progress) {
    const p = this.params;
    this.currency = p.currency || (this.social ? 'XSC' : 'USD');
    this.replay = {game: p.game, version: p.version, mode: p.mode, event: p.event,
      // Engine: with no currency/amount, show a 1 USD (1 SC social) bet.
      amount: p.amount > 0 ? p.amount : 1_000_000};
    this.ui.enterReplay?.({social: this.social});
    progress(0.3, 'Loading replay');
    await this.loadReplay();
    progress(1, this.replayData ? 'Replay ready' : 'Replay unavailable');
    this.ready = true;
    this.replayLoop();       // runs for as long as the page is open
  }

  async loadReplay() {
    this.replayData = null;
    this.replayError = null;
    const r = this.replay;
    try {
      const data = await fetchReplay({rgsUrl: this.params.rgsUrl, ...r, fetcher: this.fetcher});
      this.replayData = replayRound(data, r.event, this.validate);
      if (this.replayData.cost && this.modeEntry(r.mode)) this.modeEntry(r.mode).cost = this.replayData.cost;
    } catch (error) {
      console.error('[replay]', error);
      this.replayError = this.t(error.message || 'The round could not be loaded.');
    }
  }

  replayInfo() {
    const r = this.replay;
    const cost = this.replayData?.cost ?? this.cost(r.mode);
    const hundredths = this.replayData?.hundredths ?? 0;
    const win = winFor(r.amount, hundredths);
    return {
      mode: r.mode, label: this.label(r.mode), cost, amount: r.amount, realCost: Math.round(r.amount * cost),
      win, x: hundredths / 100, currency: this.currency, social: this.social, error: this.replayError,
      text: {
        amount: this.money(r.amount), realCost: this.money(Math.round(r.amount * cost)), win: this.money(win),
        betWord: this.t('Bet'), realCostWord: this.t('Real cost'), winWord: this.t('Win'),
      },
    };
  }

  async replayLoop() {
    let kind = this.replayData ? 'start' : 'error';
    for (;;) {
      await this.ui.replayCard(kind, this.replayInfo());
      if (kind === 'error') {
        await this.loadReplay();
        kind = this.replayData ? 'start' : 'error';
        continue;
      }
      this.setBusy(true);
      this.ui.setWin?.(0);
      try {
        const book = structuredClone(this.replayData.book);
        const info = this.replayInfo();
        await this.presenter.present(book, info.amount, {mode: info.mode, cost: info.cost, replay: true});
        this.ui.setWin?.(info.win, info.text.win);
      } catch (error) {
        console.error('[replay]', error);
        this.ui.note?.(this.t('The replay could not be played'));
      } finally { this.setBusy(false); }
      kind = 'end';
    }
  }

  /* ---------------- errors ---------------- */

  fail(error) {
    console.error('[session]', error);
    this.stopAuto();
    if (this.client?.uncertain) {
      this.ui.fatal(this.t('Connection interrupted'),
        this.t('The last request did not complete. Reload the game: any unfinished round will be restored and settled before a new bet.'));
    } else {
      this.ui.note?.(this.t(error instanceof RgsError ? error.message : String(error.message || error)));
    }
  }
}

function baseModeName(modes) {
  const keys = Object.keys(modes);
  return keys.find(k => k.toLowerCase() === 'base') || keys.find(k => Number(modes[k].cost) === 1) || keys[0];
}

function maxWinOf(config) {
  const wins = Object.values(config.modes).map(m => Number(m.maxWin)).filter(Number.isFinite);
  return wins.length ? Math.max(...wins) : undefined;
}
