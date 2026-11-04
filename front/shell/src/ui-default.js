// hustle-shell/src/ui-default.js
// Default screens for everything that is the same in every game: confirm dialog, notes,
// fatal error, replay start/end/error cards. A game passes its own `ui` object with only the
// methods it wants to restyle (setBalance, setBet, setWin, setBusy, setAuto, ...); the rest
// comes from here. Every string arrives already social-filtered by Session.t().
//
// Replay card (Source: .../approval-guidelines/game-replay-requirements): shows mode, base bet,
// cost multiplier and real cost ("BONUS: 1 SC / REAL COST: 250 SC"), a Play button, then the win
// and Play Again. Balance, bet controls, autoplay and buys are hidden by the [data-replay] CSS.

import {applySocial} from './social.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

export class DefaultUi {
  constructor(root = document.body) {
    this.root = root;
    this.layer = document.createElement('div');
    this.layer.className = 'hs-layer';
    root.appendChild(this.layer);
    this.toast = document.createElement('div');
    this.toast.className = 'hs-note';
    this.toast.setAttribute('role', 'status');
    root.appendChild(this.toast);
    this.social = false;
  }

  modalOpen() { return Boolean(this.layer.firstChild); }

  note(text) {
    this.toast.textContent = text;
    this.toast.classList.add('in');
    clearTimeout(this.noteTimer);
    this.noteTimer = setTimeout(() => this.toast.classList.remove('in'), 2600);
  }

  card(html, cls) {
    this.layer.innerHTML = `<div class="hs-card ${cls}" role="dialog">${html}</div>`;
    if (this.social) applySocial(this.layer);
    return this.layer.firstChild;
  }
  close() { this.layer.innerHTML = ''; }

  confirm(text, {ok = 'OK', cancel = 'Cancel'} = {}) {
    const el = this.card(`<p>${esc(text)}</p><div class="hs-row">
      <button data-a="no" class="hs-btn hs-ghost">${esc(cancel)}</button>
      <button data-a="yes" class="hs-btn">${esc(ok)}</button></div>`, 'hs-confirm');
    el.querySelector('[data-a="yes"]').focus();
    return new Promise(resolve => {
      el.addEventListener('click', e => {
        const a = e.target.closest('[data-a]')?.dataset.a;
        if (!a) return;
        this.close();
        resolve(a === 'yes');
      });
    });
  }

  fatal(title, detail) {
    this.card(`<h2>${esc(title)}</h2><p>${esc(detail)}</p>`, 'hs-fatal');
    this.layer.classList.add('locked');
  }

  enterReplay({social}) {
    this.social = social;
    document.body.dataset.replay = 'true';
  }

  replayCard(kind, info) {
    const t = info.text;
    const body = kind === 'error'
      ? `<h3>Replay unavailable</h3><p>${esc(info.error || 'The round could not be loaded.')}</p>`
      : `<h3>${esc(info.label)}</h3>
         <dl class="hs-cost">
           <div><dt>${esc(t.betWord)}</dt><dd>${esc(t.amount)}</dd></div>
           <div><dt>×</dt><dd>${esc(info.cost)}</dd></div>
           <div class="hs-real"><dt>${esc(t.realCostWord)}</dt><dd>${esc(t.realCost)}</dd></div>
         </dl>
         ${kind === 'end' ? `<div class="hs-result"><span>${esc(t.winWord)}</span><b>${esc(t.win)}</b><em>${info.x.toFixed(2)}×</em></div>` : ''}`;
    const label = kind === 'start' ? '▶ Play' : kind === 'end' ? '↻ Play again' : 'Try again';
    const el = this.card(`<span class="hs-tag">REPLAY</span>${body}<button class="hs-btn hs-go">${label}</button>`, `hs-replay hs-${kind}`);
    const go = el.querySelector('.hs-go');
    go.focus();
    return new Promise(resolve => go.addEventListener('click', () => { this.close(); resolve(); }, {once: true}));
  }
}

/** Game ui object with DefaultUi filling every method the game left out. */
export function withDefaults(gameUi = {}, root) {
  const base = new DefaultUi(root);
  return new Proxy(gameUi, {
    get(target, key) {
      if (key in target) return target[key];
      const v = base[key];
      return typeof v === 'function' ? v.bind(base) : v;
    },
  });
}
