// Haptics — navigator.vibrate on web, Capacitor Haptics on native.
import { isNative, loadPlugin } from './index.js';

const WEB_PATTERNS = { light: [10], medium: [20], heavy: [35], success: [10, 30, 10], warning: [25, 30, 25] };

export async function haptic(kind = 'light') {
  if (isNative()) {
    const mod = await loadPlugin('@capacitor/haptics');
    if (!mod) return;
    const { Haptics, ImpactStyle, NotificationType } = mod;
    try {
      if (kind === 'success' || kind === 'warning') {
        await Haptics.notification({ type: kind === 'success' ? NotificationType.Success : NotificationType.Warning });
      } else {
        const style = kind === 'heavy' ? ImpactStyle.Heavy : kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light;
        await Haptics.impact({ style });
      }
    } catch (e) {}
    return;
  }
  if ('vibrate' in navigator) {
    const p = WEB_PATTERNS[kind] || WEB_PATTERNS.light;
    navigator.vibrate(p);
  }
}

if (typeof window !== 'undefined') {
  window.haptic = haptic;
}
