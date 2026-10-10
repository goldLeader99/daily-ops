import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dailyops.dashboard',
  appName: 'Daily Ops',
  webDir: 'dist',
  // No server.url: production assets always come from inside the installed APK.
  android: { backgroundColor: '#0b100e', allowMixedContent: false },
  // Native Activity controls the optional fullscreen toggle. Do not hide bars on cold launch.
  plugins: { SystemBars: { hidden: false, insetsHandling: 'disable' } },
};
export default config;
