// hustle-shell/src/launch.js
// Launch URL: https://{team}.live.engine.io/{game}/v{version}/?sessionID&rgs_url&lang&currency&device&social&demo
// Replay adds: replay=true&game&version&mode&event (+ optional amount, currency).
// rgs_url is a bare host: prefix https://, never hardcode it.
// Source: studio.engine.io/docs/rgs, .../approval-guidelines/game-replay-requirements

export const LANGUAGES = ['ar', 'da', 'de', 'en', 'es', 'fi', 'fr', 'hi', 'id', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'vi', 'zh'];
export const DEVICES = ['desktop', 'mobile', 'tablet'];

export function launchParams(search = globalThis.location?.search || '', {fallbackDevice} = {}) {
  const q = new URLSearchParams(search);
  const flag = k => q.get(k) === 'true';
  const social = flag('social');
  let lang = (q.get('lang') || 'en').toLowerCase().slice(0, 2);
  if (!LANGUAGES.includes(lang) || social) lang = 'en';   // unknown → English; social is English only
  const device = DEVICES.includes(q.get('device')) ? q.get('device')
    : fallbackDevice || (globalThis.matchMedia?.('(max-width: 900px)').matches ? 'mobile' : 'desktop');
  return {
    sessionID: q.get('sessionID') || '',
    rgsUrl: q.get('rgs_url') || '',
    lang,
    device,
    social,
    demo: flag('demo'),
    currency: (q.get('currency') || '').toUpperCase(),
    replay: flag('replay'),
    game: q.get('game') || '',
    version: q.get('version') || '',
    mode: q.get('mode') || '',
    event: q.get('event') || '',
    amount: Number(q.get('amount')) || 0,
  };
}

/** 'live' with a session, 'replay' for a shared round link, otherwise 'demo' (local pack). */
export function launchKind(p) {
  if (p.replay) return 'replay';
  if (p.sessionID && p.rgsUrl) return 'live';
  return 'demo';
}
