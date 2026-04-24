import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.focusflow.app',
  appName: 'FocusFlow',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#0b0f0e',
      androidSplashResourceName: 'splash',
      splashFullScreen: true,
      splashImmersive: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#3ecfb0',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0b0f0e',
      overlaysWebView: false,
    },
  },
  ios: {
    contentInset: 'always',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
