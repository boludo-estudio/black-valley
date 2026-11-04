// hustle-shell/src/input.js
// Front-end rules every game shares (Source: studio.engine.io/docs/approval-guidelines, front end):
//  - spacebar plays a round (unless the jurisdiction sets disabledSpacebar, or in replay);
//  - no double-tap zoom, no pinch zoom, no page scroll inside the frame.

export function bindKeys(session, {isModalOpen = () => false} = {}) {
  const onKey = e => {
    if (e.code !== 'Space' || e.repeat) return;
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
    e.preventDefault();                                     // never scroll the page
    if (session.kind === 'replay' || session.jurisdiction.disabledSpacebar || isModalOpen()) return;
    session.spin();
  };
  addEventListener('keydown', onKey);
  return () => removeEventListener('keydown', onKey);
}

export function preventZoom(root = document) {
  let last = 0;
  root.addEventListener('touchend', e => {
    const now = Date.now();
    if (now - last < 350) e.preventDefault();             // double-tap zoom (iOS ignores touch-action alone)
    last = now;
  }, {passive: false});
  root.addEventListener('gesturestart', e => e.preventDefault());
  root.addEventListener('dblclick', e => e.preventDefault());
  root.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, {passive: false});
}
