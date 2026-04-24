// Platform detection — single source of truth for web vs native branches.
// Imported by wakeLock / fs / notifications / vibrate / secureStorage.

// Capacitor injects window.Capacitor on native. On web this returns false.
function cap() {
  return (typeof window !== 'undefined') && window.Capacitor;
}

export const isNative = () => !!(cap() && cap().isNativePlatform && cap().isNativePlatform());
export const platform = () => {
  if (!isNative()) return 'web';
  return cap().getPlatform?.() || 'unknown';
};

// Lazily import Capacitor plugins so web builds don't pull them in.
export async function loadPlugin(name) {
  if (!isNative()) return null;
  try {
    // Dynamic import keeps the web bundle clean.
    return await import(/* @vite-ignore */ name);
  } catch (e) {
    console.warn(`Plugin ${name} not available`, e);
    return null;
  }
}
