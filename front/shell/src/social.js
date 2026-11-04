// hustle-shell/src/social.js
// Social mode (social=true, stake.us): every player-facing string swaps restricted words.
// Source: studio.engine.io/docs/approval-guidelines/jurisdiction-requirements (verified 2026-10-25).
// Applies to UI labels, buttons, rules, popups, errors, mode names and the replay window.
// English only in social mode.

// Longest phrases first so "buy bonus" wins over "buy", "pays out" over "pays".
const PAIRS = [
  ['be awarded to player\'s accounts', 'appear in player\'s accounts'],
  ['place your bets', 'come and play'],
  ['at the cost of', 'for'],
  ['cost of', 'can be played for'],
  ['bonus buy', 'bonus'],
  ['buy bonus', 'get bonus'],
  ['buy feature', 'get feature'],
  ['win feature', 'play feature'],
  ['total bet', 'total play'],
  ['auto bet', 'autoplay'],
  ['pays out', 'won'],
  ['paid out', 'win'],
  ['pay out', 'win'],
  ['paytables', 'win tables'],
  ['paytable', 'win table'],
  ['pay table', 'win table'],
  ['payouts', 'wins'],
  ['payout', 'win'],
  ['betting', 'playing'],
  ['bet/s', 'play/s'],
  ['bets', 'plays'],
  ['bet', 'play'],
  ['rebet', 'respin'],
  ['bought', 'instantly triggered'],
  ['buys', 'plays'],
  ['buy', 'play'],
  ['purchase', 'play'],
  ['gamble', 'play'],
  ['wager', 'play'],
  ['stake', 'play amount'],
  ['payer', 'winner'],
  ['pays', 'wins'],
  ['paid', 'won'],
  ['pay', 'win'],
  ['money', 'coins'],
  ['cash', 'coins'],
  ['credits', 'balance'],
  ['credit', 'balance'],
  ['currency', 'token'],
  ['deposit', 'get coins'],
  ['funds', 'balance'],
  ['fund', 'balance'],
  ['withdraw', 'redeem'],
].sort((a, b) => b[0].length - a[0].length);

const escape = s => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const PATTERN = new RegExp(`\\b(${PAIRS.map(([w]) => escape(w)).join('|')})\\b`, 'gi');
const MAP = new Map(PAIRS.map(([a, b]) => [a.toLowerCase(), b]));

function matchCase(source, replacement) {
  if (source === source.toUpperCase() && /[A-Z]/.test(source)) return replacement.toUpperCase();
  if (source[0] === source[0].toUpperCase() && /[A-Z]/.test(source[0]))
    return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
}

/** Social-safe version of a string. Pass social=false to get the text back unchanged. */
export function socialText(text, social = true) {
  if (!social || text == null) return text;
  return String(text).replace(PATTERN, m => matchCase(m, MAP.get(m.toLowerCase())));
}

/** Restricted words still present (for tests and the QA sweep). */
export function findRestricted(text) {
  return [...String(text).matchAll(PATTERN)].map(m => m[0]);
}

/**
 * Rewrites every text node and the user-visible attributes under `root`.
 * Run it after any render in social mode (the default UI does this itself).
 */
export function applySocial(root) {
  if (!root) return;
  const doc = root.ownerDocument || root;
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const next = socialText(n.nodeValue);
    if (next !== n.nodeValue) n.nodeValue = next;
  }
  for (const el of root.querySelectorAll?.('[title],[aria-label],[placeholder],[alt]') || []) {
    for (const attr of ['title', 'aria-label', 'placeholder', 'alt']) {
      if (el.hasAttribute(attr)) el.setAttribute(attr, socialText(el.getAttribute(attr)));
    }
  }
}
