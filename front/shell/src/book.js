// hustle-shell/src/book.js
// A "book" is one pre-generated round: {id, events:[...], payoutMultiplier}. Book payouts are
// integers in hundredths of the bet (1150 = 11.5x). The RGS picks the book; the front end only
// presents it and must never decide an outcome.
// Source: studio.engine.io/docs/math/math-file-format, engineio/math-sdk
//
// The shell checks the shape every game shares. Each game adds its own rules (event types,
// grid size, feature order) through config.validateBook(book), which runs after this.

export const MAX_WIN_HUNDREDTHS = 100_000_000;   // 1,000,000x hard cap (critical math test)

export function validateBookShape(book, {maxWinX} = {}) {
  if (!book || typeof book !== 'object') throw new Error('Invalid round: no book');
  if (!Array.isArray(book.events) || !book.events.length) throw new Error('Invalid round: no events');
  const p = book.payoutMultiplier;
  if (!Number.isSafeInteger(p) || p < 0) throw new Error('Invalid round: payout is not a whole number of hundredths');
  const cap = maxWinX ? Math.round(maxWinX * 100) : MAX_WIN_HUNDREDTHS;
  if (p > cap) throw new Error('Invalid round: payout above the max win');
  for (const event of book.events) {
    if (!event || typeof event !== 'object' || typeof event.type !== 'string' || !event.type)
      throw new Error('Invalid round: every event needs a type');
  }
  return book;
}

/** Shape check, then the game's own validator (if any). Returns the book. */
export function makeValidator(gameValidate, {maxWinX} = {}) {
  return book => {
    validateBookShape(book, {maxWinX});
    if (typeof gameValidate === 'function') gameValidate(book);
    return book;
  };
}

/**
 * The payout of a round in hundredths. The math-sdk writes it on the book; when the RGS hands
 * only `state` (the events), fall back to the last event that carries an amount/total.
 */
export function hundredthsOf(events, stated) {
  if (Number.isFinite(stated)) return Math.round(stated);
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const e = events[i];
    for (const k of ['payoutMultiplier', 'amount', 'totalWin', 'total']) {
      if (Number.isSafeInteger(e?.[k])) return e[k];
    }
  }
  return 0;
}
