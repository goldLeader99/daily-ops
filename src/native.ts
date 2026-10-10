import { Capacitor, registerPlugin } from '@capacitor/core';
export const isNative = Capacitor.isNativePlatform();
export const isAndroid = Capacitor.getPlatform() === 'android';
export const isIOS = Capacitor.getPlatform() === 'ios';
export const DashboardDevice = registerPlugin<{
  fullscreen(): Promise<void>;
  goHome(): Promise<void>;
  systemSettings(): Promise<void>;
  exportBackup(options: { content: string; filename: string }): Promise<{ saved: boolean }>;
  openLink(options: { url: string }): Promise<void>;
}>('DashboardDevice');
