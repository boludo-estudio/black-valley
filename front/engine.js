// 06_playable_game/engine.js — Engine (Stake) wiring for Black Valley, on the Hustle Labs shell.
//
// Opened by Engine (sessionID + rgs_url, or replay=true): every result comes from the RGS. The shell
// authenticates, places the play, settles the round, resumes an unfinished round, plays replays with zero
// wallet calls, applies social-mode words and the player's currency, confirms autoplay and modes over 2x.
// round.js only presents the events (BVGame.playRound) and decides nothing.
// Opened without a session (a local folder, for review): this file does nothing and the review build runs.

import {Session, launchParams, launchKind, withDefaults, formatMoney, DISCLAIMER, socialText, applySocial} from './shell/src/index.js';

const params = launchParams();
const kind = launchKind(params);

const KNOWN = new Set(['reveal', 'knock', 'fireExpand', 'villageTokens', 'pitMultiplier', 'winInfo', 'tumbleBoard',
  'updateTumbleWin', 'collect', 'updateGlobalMult', 'freeSpinTrigger', 'freeSpinRetrigger', 'updateFreeSpin',
  'freeSpinEnd', 'setWin', 'setTotalWin', 'wincap', 'finalWin']);

// Black Valley maths (math/black_valley, Model A). Names exactly as in index.json.
const CONFIG = {
  name: 'Black Valley',
  modes: {
    base: {cost: 1, rtp: 96.5, maxWin: 20000, label: 'Standard'},
    more_features: {cost: 1.5, rtp: 96.5, maxWin: 20000, label: 'More Features'},
    bonus_chance: {cost: 2, rtp: 96.5, maxWin: 20000, label: 'Bonus Chance'},
    strike: {cost: 60, rtp: 96.5, maxWin: 20000, label: 'The Strike', buy: true},
    uprising: {cost: 120, rtp: 96.5, maxWin: 20000, label: 'The Uprising', buy: true},
    final_stand: {cost: 250, rtp: 96.5, maxWin: 20000, label: 'Final Stand', buy: true},
  },
  validateBook(book) {
    const t = book.events.map(e => e.type);
    if (t[0] !== 'reveal' || t.at(-1) !== 'finalWin') throw new Error('Round must start with reveal and end with finalWin');
    const bad = t.find(x => !KNOWN.has(x));
    if (bad) throw new Error(`Unknown event ${bad}`);
  },
  autoplay: {stopAtWinX: 100, stopOnFeature: true},
};

const $ = s => document.querySelector(s);
const wait = ms => new Promise(r => setTimeout(r, ms));

if (kind !== 'demo') start().catch(e => console.error('[engine]', e));

async function start() {
  // let the page finish building (round.js menus), and the title screen go first
  while (!window.BVGame || !$('#autoBtn')) await wait(50);
  injectCss();
  markReplayHidden();
  if (kind === 'replay') {
    // replay: the title is the loader; once loaded, go straight to the board (no tap, no story intro)
    const T = $('#title');
    if (T) {
      while (!T.classList.contains('ready')) await wait(80);
      T.remove(); document.body.classList.remove('titleOn'); busy = false;
    }
  }
  while (document.body.classList.contains('titleOn')) await wait(100);

  let session;
  const ui = withDefaults({
    setBalance(micro, text) { bal = micro / 1e6; $('#bal').textContent = text; },
    setBet(micro) {
      BET = session.bet / 1e6;
      $('#betV').textContent = session.money(session.bet, 'win');
      $('#betDn').disabled = session.betLevels.indexOf(session.bet) <= 0;
      $('#betUp').disabled = session.betLevels.indexOf(session.bet) >= session.betLevels.length - 1;
    },
    setWin(micro, text) { if (micro > 0 && text) $('#win').textContent = text; },
    setBusy(b) { busy = b; },
    setAuto(n) {
      const a = $('#autoBtn'); if (!a) return;
      a.querySelector('i').textContent = n || ''; a.classList.toggle('on', n > 0); a.setAttribute('aria-pressed', n > 0);
    },
    setAvailability(a) {
      if (!a.autoplay) $('#autoBtn')?.setAttribute('hidden', '');
      if (!a.turbo) $('#turboBtn')?.setAttribute('hidden', '');
      // modes the session doesn't offer (jurisdiction) leave the mode menu
      document.querySelectorAll('#modeMenu button[data-m]').forEach(b => { if (!a.modes.includes(b.dataset.m)) b.setAttribute('hidden', ''); });
    },
    setMode() {},
  });

  const presenter = {
    turbo: false,
    async present(book, betMicro) {
      BET = betMicro / 1e6;
      window.BVGame.setBetCost(0);          // the RGS already took the play; round.js must not debit again
      await window.BVGame.playRound(book.events);
      return {feature: book.events.some(e => e.type === 'freeSpinTrigger')};
    },
  };

  session = new Session({config: CONFIG, presenter, ui, params});
  window.BV_SESSION = session;

  // money in the player's currency (Engine currency table; exact small wins)
  window.BV_BAL = v => session.money(Math.round(v * 1e6), 'balance');
  window.BV_WIN = hundredths => session.money(Math.round(hundredths / 100 * BET * 1e6), 'win');

  // every play goes through the session: spin, mode buys from the bonus menu, autoplay
  window.BV_SPIN = kindOf => {
    if (kindOf && kindOf.startsWith('buy_')) return session.play(kindOf.slice(4));
    if (kindOf && kindOf !== 'spin') return null;           // review-only kinds never reach Engine
    return session.play(window.BVGame.mode());
  };
  window.BV_AUTO = n => session.startAuto(n);
  window.BV_AUTO_ON = () => session.autoLeft > 0;
  window.BV_AUTO_STOP = () => session.stopAuto();
  window.betSet = d => session.stepBet(d);                 // − / + buttons: the session's bet levels
  $('#betDn').onclick = () => session.stepBet(-1);
  $('#betUp').onclick = () => session.stepBet(1);
  $('#sndBtn')?.addEventListener('click', () => session.setMuted());

  // jurisdiction: no spacebar play when disabled, never in replay
  addEventListener('keydown', e => {
    if (e.code === 'Space' && (session.kind === 'replay' || session.jurisdiction.disabledSpacebar)) {
      e.stopImmediatePropagation(); e.preventDefault();
    }
  }, true);

  await session.boot();

  if (session.social) socialPage();
  rulesDisclaimer(session.social);
}

/* ---------- page details ---------- */

function markReplayHidden() {
  $('#bal')?.closest('.win')?.setAttribute('data-hs', 'balance');
  $('#betV')?.closest('.win')?.setAttribute('data-hs', 'bet');
  $('#spin')?.setAttribute('data-hs', 'spin');
  $('#autoBtn')?.setAttribute('data-hs', 'auto');
  $('#lampBtn')?.setAttribute('data-hs', 'buy');
}

function rulesDisclaimer(social) {
  const old = [...document.querySelectorAll('#rules p')].find(p => /Malfunction/i.test(p.textContent));
  const text = social ? socialText(DISCLAIMER) : DISCLAIMER;
  if (old) old.textContent = text + ' 18+. Play responsibly.';
}

function socialPage() {
  applySocial($('#stage') || document.body);
  applySocial($('#rules') || document.body);
}

function injectCss() {
  const st = document.createElement('style');
  st.textContent = `
body[data-replay="true"] [data-hs~="balance"],body[data-replay="true"] [data-hs~="bet"],
body[data-replay="true"] [data-hs~="auto"],body[data-replay="true"] [data-hs~="buy"],
body[data-replay="true"] [data-hs~="spin"]{visibility:hidden!important}
.hs-layer{position:fixed;inset:0;display:grid;place-items:center;pointer-events:none;z-index:1000}
.hs-layer:not(:empty){pointer-events:auto;background:rgba(17,16,16,.6)}
.hs-card{max-width:min(92vw,440px);padding:clamp(10px,3vmin,24px);background:#EEE9DF;color:#111010;text-align:center;
 box-shadow:8px 8px 0 #111010;outline:4px solid #FAF8F3;font:700 clamp(12px,2.6vmin,18px)/1.35 'Courier Prime',monospace}
.hs-card h2,.hs-card h3{font-family:Stencil,'Big Shoulders Stencil',sans-serif;margin:0 0 .4em}
.hs-row{display:flex;gap:.6em;justify-content:center;margin-top:.8em}
.hs-btn{font:900 1.1em Stencil,'Big Shoulders Stencil',sans-serif;padding:.4em 1.1em;border:0;background:#FFB000;color:#111010;cursor:pointer}
.hs-ghost{background:transparent;outline:3px solid #111010}
.hs-tag{display:inline-block;letter-spacing:.2em;font-size:.75em;opacity:.7}
.hs-cost{display:grid;grid-template-columns:repeat(3,auto);gap:.2em 1em;justify-content:center;margin:.4em 0}
.hs-cost div{display:flex;flex-direction:column}.hs-cost dt{font-size:.75em;opacity:.7}.hs-cost dd{margin:0}
.hs-result{display:grid;margin:.5em 0}.hs-result b{font-size:1.6em}
.hs-note{position:fixed;left:50%;bottom:12%;transform:translate(-50%,20px);opacity:0;padding:.5em 1em;background:#111010;
 color:#EEE9DF;font:700 clamp(12px,2.4vmin,16px) 'Courier Prime',monospace;transition:.25s;pointer-events:none;z-index:1001}
.hs-note.in{opacity:1;transform:translate(-50%,0)}`;
  document.head.appendChild(st);
}
