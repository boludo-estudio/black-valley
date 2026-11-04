// hustle-shell/src/rules.js
// The parts of the rules every game must show, built from the game config so no game can forget
// them: RTP and max win per mode, mode costs, a guide to every control, the disclaimer.
// The game adds its own sections (symbol wins, features, free-game triggers/retriggers).
// Source: studio.engine.io/docs/approval-guidelines (front-end + disclaimer pages, verified 2026-10-25)

import {socialText} from './social.js';

export const DISCLAIMER = 'Malfunction voids all wins and plays. A consistent internet connection is required. '
  + 'In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is '
  + 'calculated over many plays. The game display is not representative of any physical device and is for '
  + 'illustrative purposes only. Winnings are settled according to the amount received from the Remote Game '
  + 'Server and not from events within the web browser. TM and © 2026 Engine.';

export const DEFAULT_CONTROLS = [
  ['Spin', 'Starts a round. The space bar does the same.'],
  ['− / +', 'Lowers or raises the bet.'],
  ['Autoplay', 'Plays a chosen number of rounds automatically after you confirm. Stops on a feature, a big win or any error. Tap again to stop.'],
  ['Turbo', 'Speeds up the animations. Results are not affected.'],
  ['Sound', 'Mutes or unmutes all game audio.'],
  ['Menu (☰)', 'Opens these rules, the win table and the settings.'],
];

const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const pct = v => `${Number(v).toFixed(2)}%`;
const x = v => `${Number(v).toLocaleString('en-GB', {maximumFractionDigits: 2})}×`;

/**
 * Rules HTML. `sections` = [{title, html}] written by the game (trusted, from the build).
 * In social mode the whole result is passed through the restricted-word filter.
 */
export function rulesHtml(config, {social = false, modes = config.modes, sections = config.rules || [], controls} = {}) {
  const rows = Object.entries(modes).map(([key, m]) => {
    const name = (social && m.socialLabel) || m.label || key;
    return `<tr><td>${esc(name)}</td><td>${x(m.cost ?? 1)} bet</td><td>${m.rtp != null ? pct(m.rtp) : '—'}</td><td>${m.maxWin != null ? x(m.maxWin) : '—'}</td></tr>`;
  }).join('');
  const ctl = (controls || config.controls || DEFAULT_CONTROLS)
    .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
  const html = `
    <section class="hs-rules">
      <h2>${esc(config.name || 'Game rules')}</h2>
      ${sections.map(s => `<h3>${esc(s.title)}</h3>${s.html}`).join('')}
      <h3>Game modes</h3>
      <table class="hs-modes"><thead><tr><th>Mode</th><th>Cost</th><th>RTP</th><th>Max win</th></tr></thead><tbody>${rows}</tbody></table>
      <p>All wins are multiplied by the base bet. Each mode's price is shown before it is played.</p>
      <h3>Controls</h3>
      <dl class="hs-controls">${ctl}</dl>
      <p class="hs-disclaimer">${esc(DISCLAIMER)}</p>
    </section>`;
  return socialText(html, social);
}

/** Checks the config carries what the rules must show. Returns a list of problems (empty = ok). */
export function rulesProblems(config) {
  const out = [];
  for (const [key, m] of Object.entries(config.modes || {})) {
    if (!(m.rtp >= 96 && m.rtp <= 96.7)) out.push(`mode ${key}: rtp ${m.rtp} outside 96.0–96.7%`);
    if (!(m.maxWin > 0 && m.maxWin <= 1_000_000)) out.push(`mode ${key}: maxWin missing or above 1,000,000×`);
    if (!(m.cost > 0)) out.push(`mode ${key}: cost missing`);
    if (/\b(buy|bet|pay)/i.test(m.socialLabel || m.label || key)) out.push(`mode ${key}: name has a restricted word; set socialLabel`);
  }
  const costs = Object.values(config.modes || {}).map(m => m.cost);
  if (costs.length && Math.min(...costs) !== 1) out.push('cheapest mode must cost 1×');
  if (!config.rules?.length) out.push('no game rules sections (symbol wins, features, triggers)');
  return out;
}
