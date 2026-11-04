// hustle-shell/src/index.js
// One call wires a game: createGame({config, presenter, ui, sound}).
// Everything else is exported for games that want finer control, and for tests.

import {Session} from './session.js';
import {withDefaults} from './ui-default.js';
import {bindKeys, preventZoom} from './input.js';

export {Session} from './session.js';
export {RgsClient, RgsError, fetchReplay, normalizeRound, replayRound, rgsBase} from './rgs.js';
export {launchParams, launchKind, LANGUAGES} from './launch.js';
export {formatMoney, currencyMeta, usableBetLevels, winFor, CURRENCIES, MICRO} from './money.js';
export {socialText, applySocial, findRestricted} from './social.js';
export {rulesHtml, rulesProblems, DISCLAIMER, DEFAULT_CONTROLS} from './rules.js';
export {validateBookShape, makeValidator} from './book.js';
export {DefaultUi, withDefaults} from './ui-default.js';
export {bindKeys, preventZoom} from './input.js';

export async function createGame({config, presenter, ui = {}, sound = null, root, progress, fetcher} = {}) {
  const fullUi = withDefaults(ui, root || document.body);
  const session = new Session({config, presenter, ui: fullUi, sound, fetcher});
  preventZoom(document);
  bindKeys(session, {isModalOpen: () => fullUi.modalOpen?.() || false});
  await session.boot(progress);
  return session;
}
