import { DashboardDevice, isNative } from '../native';
export async function download(content: string, filename: string) {
  if (isNative) {
    await DashboardDevice.exportBackup({ content, filename });
    return;
  }
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
