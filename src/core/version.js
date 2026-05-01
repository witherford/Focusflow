// App version — bumped manually with each batch of changes per user instruction.
// Scheme: V<major>.<minor>.<patch>. Patch increments by 1; on patch == 10
// it rolls to (minor + 1).0. On minor == 10 it rolls to (major + 1).0.0.
//
// To bump on next change: increment APP_VERSION here.
export const APP_VERSION = '1.1.2';

export function bumpVersion(v) {
  // Pure helper — handy for tests / future automation.
  const m = /^V?(\d+)\.(\d+)\.(\d+)$/.exec(v.trim()); if (!m) return v;
  let major = +m[1], minor = +m[2], patch = +m[3];
  patch += 1;
  if (patch >= 10) { patch = 0; minor += 1; }
  if (minor >= 10) { minor = 0; major += 1; }
  return `${major}.${minor}.${patch}`;
}

if (typeof window !== 'undefined') window.APP_VERSION = APP_VERSION;
