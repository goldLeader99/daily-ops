import type { Page } from '@playwright/test';

export async function nativeGateway(page: Page, mode = 'normal') {
  await page.addInitScript(
    ({ mode }) => {
      const scope = window as unknown as {
        CapacitorCustomPlatform: { name: string };
        Capacitor: object;
        DailyOpsStorage: { read(): string | null; write(value: string): boolean };
        DailyOpsSyncStorage: {
          readSession(): string | null;
          writeSession(value: string | null): void;
          preserveBackup(value: string): void;
          readBackup(): string | null;
        };
        wanFixture: { failed: boolean; calls: { url: string; action?: string }[] };
      };
      scope.CapacitorCustomPlatform = { name: 'ios' };
      scope.wanFixture = { failed: mode === 'offline', calls: [] };
      scope.DailyOpsStorage = {
        read: () => localStorage.getItem('fixture-personal-data'),
        write: (value) => {
          localStorage.setItem('fixture-personal-data', value);
          return true;
        },
      };
      scope.DailyOpsSyncStorage = {
        readSession: () => localStorage.getItem('fixture-session'),
        writeSession: (value) =>
          value === null
            ? localStorage.removeItem('fixture-session')
            : localStorage.setItem('fixture-session', value),
        preserveBackup: (value) => {
          if (!localStorage.getItem('fixture-before-sync'))
            localStorage.setItem('fixture-before-sync', value);
        },
        readBackup: () => localStorage.getItem('fixture-before-sync'),
      };
      scope.Capacitor = {
        PluginHeaders: [{ name: 'DashboardWan', methods: [{ name: 'read', rtype: 'promise' }] }],
        nativePromise: async (
          _plugin: string,
          _method: string,
          options: { url: string; action?: string },
        ) => {
          scope.wanFixture.calls.push(options);
          if (scope.wanFixture.failed) throw new Error('Fixture gateway unavailable.');
          if (options.url.endsWith('IGDdevicedesc_brlan0.xml'))
            return {
              xml: `<root xmlns="urn:schemas-upnp-org:device-1-0"><device><deviceType>urn:schemas-upnp-org:device:InternetGatewayDevice:1</deviceType><serviceList><service><serviceType>urn:schemas-upnp-org:service:WANCommonInterfaceConfig:1</serviceType><controlURL>${mode === 'foreign' ? 'http://10.0.0.2' : ''}/WAN/control</controlURL><SCPDURL>/WAN/scpd.xml</SCPDURL></service></serviceList></device></root>`,
            };
          if (options.url.endsWith('/WAN/scpd.xml'))
            return {
              xml: `<scpd xmlns="urn:schemas-upnp-org:service-1-0"><actionList><action><name>GetTotalBytesReceived</name></action>${mode === 'unsupported' ? '' : '<action><name>GetTotalBytesSent</name></action>'}<action><name>GetCommonLinkProperties</name></action></actionList></scpd>`,
            };
          const clock = BigInt(Math.floor(performance.now()));
          const baseline = 9007199254740993000n;
          const value =
            options.action === 'GetTotalBytesReceived'
              ? `<NewTotalBytesReceived>${baseline + clock * 1000n}</NewTotalBytesReceived>`
              : options.action === 'GetTotalBytesSent'
                ? `<NewTotalBytesSent>${baseline + clock * 125n}</NewTotalBytesSent>`
                : '<NewPhysicalLinkStatus>Up</NewPhysicalLinkStatus>';
          return {
            xml: `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><u:${options.action}Response xmlns:u="urn:schemas-upnp-org:service:WANCommonInterfaceConfig:1">${value}</u:${options.action}Response></s:Body></s:Envelope>`,
          };
        },
      };
    },
    { mode },
  );
}
