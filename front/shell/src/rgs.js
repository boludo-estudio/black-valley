// hustle-shell/src/rgs.js
// RGS client. Ported from Stoned Pandas v3 (rgs.js) and brought up to the live spec.
// Source: studio.engine.io/docs/rgs/wallet (verified 2026-10-25)
//
//  POST /wallet/authenticate {sessionID}            → balance, config, round (only if unfinished)
//  POST /wallet/balance      {sessionID}            → balance
//  POST /wallet/play         {amount, sessionID, mode} → balance, round
//  POST /wallet/end-round    {sessionID}            → balance
//  POST /bet/event           {sessionID, event≤32B} → event
//  GET  /bet/replay/{game}/{version}/{mode}/{event} → {payoutMultiplier, costMultiplier, state}
//
// Errors: 400 ERR_VAL / ERR_IPB / ERR_GLE, 429 ERR_ACT, 500 ERR_GEN, 423 on play when bets are
// paused, plain 400 for malformed JSON, plain 404 (no body) for an unknown replay.
//
// Changes vs Stoned Pandas v3:
//  - non-JSON bodies (plain 404 / 400 / 423) no longer throw a SyntaxError that hides the status;
//  - a definite refusal (4xx with a known reason) does NOT mark the session uncertain; only a
//    network failure or 5xx does (the bet may or may not have landed → reload to recover);
//  - config.gameModes [{mode, costMultiplier, maxBet}] from the live spec is read;
//  - round.active is trusted when present: false = 0 payout, already closed, no end-round.

import {usableBetLevels} from './money.js';
import {hundredthsOf} from './book.js';

export class RgsError extends Error {
  constructor(message, {status = 0, code = '', network = false} = {}) {
    super(message);
    this.name = 'RgsError';
    this.status = status;
    this.code = code;
    this.network = network;
  }
  /** True when we cannot know whether the request took effect. */
  get uncertain() { return this.network || this.status >= 500; }
}

const FRIENDLY = {
  ERR_IPB: 'Insufficient balance.',
  ERR_GLE: 'Gambling limit reached for this session.',
  ERR_ACT: 'Too many requests. Please try again in a moment.',
  ERR_GEN: 'Server error. Please reload the game.',
  ERR_VAL: 'The request was refused. Please reload the game.',
  423: 'New rounds are paused right now. Please try again shortly.',
  404: 'This round could not be found. The link may be wrong or the round is no longer available.',
};

export function rgsBase(rgsUrl) {
  if (!rgsUrl) throw new RgsError('No rgs_url in the launch link');
  const url = new URL(rgsUrl.includes('://') ? rgsUrl : `https://${rgsUrl}`);
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new RgsError('RGS requires HTTPS');
  if (url.username || url.password || url.search || url.hash) throw new RgsError('Invalid rgs_url');
  return url.href.replace(/\/$/, '');
}

/** Turns an RGS round into what the presenter needs. `validate` is the game's book validator. */
export function normalizeRound(round, validate) {
  const events = Array.isArray(round?.state) ? round.state : Array.isArray(round?.state?.events) ? round.state.events : null;
  if (!events?.length) throw new RgsError('Invalid RGS round: no events');
  const ratio = Number(round.payoutMultiplier);
  const hundredths = Number.isFinite(ratio) ? Math.round(ratio * 100) : hundredthsOf(events);
  const book = validate({id: Number(round.betID ?? round.roundID) || 0, events, payoutMultiplier: hundredths});
  const amount = Number(round.amount) || 0;
  const payout = Number(round.payout) || 0;
  const active = typeof round.active === 'boolean' ? round.active : hundredths > 0;
  return {betID: round.betID ?? round.roundID, amount, payout, payoutMultiplier: hundredths / 100,
    hundredths, active, mode: round.mode, event: round.event, book};
}

/** GET /bet/replay → the round to play back. Any payout disagreement is logged, never guessed. */
export function replayRound(data, eventId, validate) {
  const events = Array.isArray(data?.state) ? data.state : Array.isArray(data?.state?.events) ? data.state.events : null;
  if (!events?.length) throw new RgsError('This replay has no round data');
  const stated = Number(data.payoutMultiplier);
  const hundredths = Number.isFinite(stated) ? Math.round(stated * 100) : hundredthsOf(events);
  const book = validate({id: Number(eventId) || 0, events, payoutMultiplier: hundredths});
  const cost = Number(data.costMultiplier);
  return {book, hundredths, cost: Number.isFinite(cost) && cost > 0 ? cost : null};
}

export class RgsClient {
  constructor({rgsUrl, sessionID, language = 'en', fetcher = (...a) => globalThis.fetch(...a), validate = b => b}) {
    this.base = rgsBase(rgsUrl);
    this.sessionID = sessionID;
    this.language = language;
    this.fetcher = fetcher;
    this.validate = validate;
    this.session = null;    // authenticate response
    this.pending = null;    // the open round, if any
    this.busy = false;
    this.uncertain = false;
  }

  async request(path, body) {
    let response;
    try {
      response = await this.fetcher(`${this.base}${path}`, body === undefined ? {method: 'GET'}
        : {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({sessionID: this.sessionID, ...body})});
    } catch (cause) {
      throw new RgsError('Connection lost', {network: true});
    }
    const text = await response.text().catch(() => '');
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!response.ok || data?.error) {
      const code = typeof data?.error === 'string' ? data.error : '';
      const message = FRIENDLY[code] || FRIENDLY[response.status] || data?.message || `RGS request failed (${response.status})`;
      throw new RgsError(message, {status: response.status, code});
    }
    if (data === null) throw new RgsError('Empty RGS response', {status: response.status});
    return data;
  }

  async authenticate() {
    const data = await this.request('/wallet/authenticate', {language: this.language});
    const c = data.config;
    if (!c || !Number.isSafeInteger(data.balance?.amount) || !data.balance.currency || !Array.isArray(c.betLevels))
      throw new RgsError('Invalid RGS session');
    c.betLevels = usableBetLevels(c);
    if (!c.betLevels.length) throw new RgsError('No usable bet levels in this session');
    this.session = data;
    this.uncertain = false;
    this.pending = null;
    // A round left open must be resumed and settled before any new bet.
    if (data.round && (data.round.active === true || data.round.state)) {
      try { this.pending = normalizeRound(data.round, this.validate); }
      catch (error) {
        console.warn('[rgs] previous round could not be read', error);
        this.pending = data.round.active ? {active: true, book: null, amount: Number(data.round.amount) || 0, mode: data.round.mode} : null;
      }
      if (this.pending && !this.pending.active) this.pending = null;
    }
    return {...data, pending: this.pending};
  }

  async balance() {
    const data = await this.request('/wallet/balance', {});
    if (this.session) this.session.balance = data.balance;
    return data.balance;
  }

  async play(amount, mode) {
    if (!this.session) throw new RgsError('Authenticate first');
    if (this.busy || this.uncertain || this.pending?.active) throw new RgsError('Finish the active round first');
    const c = this.session.config;
    if (!c.betLevels.includes(amount)) throw new RgsError('Invalid bet');
    if (typeof mode !== 'string' || !mode) throw new RgsError('Invalid mode');
    this.busy = true;
    try {
      const data = await this.request('/wallet/play', {amount, mode});
      this.session.balance = data.balance;
      this.pending = normalizeRound(data.round, this.validate);
      return {...this.pending, balance: data.balance};
    } catch (error) {
      if (!(error instanceof RgsError) || error.uncertain) this.uncertain = true;
      throw error;
    } finally { this.busy = false; }
  }

  /** Settles the open round. Skipped when the round is not active (0x rounds close themselves). */
  async endRound() {
    if (this.busy) throw new RgsError('A request is still running');
    if (!this.pending?.active) { this.pending = null; return {balance: this.session?.balance}; }
    this.busy = true;
    try {
      const data = await this.request('/wallet/end-round', {});
      this.pending = null;
      this.session.balance = data.balance;
      this.uncertain = false;
      return data;
    } catch (error) {
      if (!(error instanceof RgsError) || error.uncertain) this.uncertain = true;
      throw error;
    } finally { this.busy = false; }
  }

  /** Progress marker inside an open round (≤ 32 bytes), returned as round.event on resume. */
  async saveEvent(event) {
    const value = String(event);
    if (!value || new TextEncoder().encode(value).length > 32) throw new RgsError('Invalid event marker');
    return this.request('/bet/event', {event: value});
  }
}

/** Public replay fetch: no session, no wallet. */
export async function fetchReplay({rgsUrl, game, version, mode, event, fetcher = (...a) => globalThis.fetch(...a)}) {
  const parts = [game, version, mode, event].map(v => {
    if (!String(v ?? '').trim()) throw new RgsError('This replay link is incomplete.');
    return encodeURIComponent(v);
  });
  const client = Object.create(RgsClient.prototype);
  Object.assign(client, {base: rgsBase(rgsUrl), fetcher, sessionID: ''});
  return client.request(`/bet/replay/${parts.join('/')}`);
}
