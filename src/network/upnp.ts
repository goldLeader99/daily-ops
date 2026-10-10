import { registerPlugin } from '@capacitor/core';
import type { WanCounters } from './traffic';

// This description URL was advertised by this XB10 during verified discovery.
// The gateway may change its service port; connection settings can replace it.
export const DEFAULT_GATEWAY_DESCRIPTION = 'http://10.0.0.1:49154/IGDdevicedesc_brlan0.xml';
const WAN_TYPES = new Set([
  'urn:schemas-upnp-org:service:WANCommonInterfaceConfig:1',
  'urn:schemas-upnp-org:service:WANCommonInterfaceConfig:2',
]);
export const WAN_READ_ACTIONS = new Set([
  'GetTotalBytesReceived',
  'GetTotalBytesSent',
  'GetCommonLinkProperties',
]);
const NativeWan = registerPlugin<{
  read(options: {
    url: string;
    gateway: string;
    action?: string;
    serviceType?: string;
  }): Promise<{ xml: string }>;
}>('DashboardWan');

export function gatewayURL(raw: string): URL {
  const url = new URL(raw);
  const parts = url.hostname.split('.');
  const octets = parts.map(Number);
  const privateHost =
    parts.length === 4 &&
    parts.every((part, i) => /^\d{1,3}$/.test(part) && octets[i] <= 255) &&
    (octets[0] === 10 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168));
  if (
    !privateHost ||
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error(
      'Use a service URL on your private home gateway, without a password or fragment.',
    );
  return url;
}

export function sameGatewayURL(base: string, reference: string, gateway: string): string {
  const url = gatewayURL(new URL(reference, base).href);
  if (url.hostname !== gateway) throw new Error('The service points outside the selected gateway.');
  return url.href;
}

function parseXML(raw: string): Document {
  if (typeof raw !== 'string' || raw.length > 262_144 || /<!DOCTYPE|<!ENTITY/i.test(raw))
    throw new Error('The gateway returned an invalid service document.');
  const document = new DOMParser().parseFromString(raw, 'application/xml');
  if (document.getElementsByTagName('parsererror').length)
    throw new Error('The gateway returned invalid XML.');
  return document;
}

function elements(root: Document | Element, name: string): Element[] {
  return Array.from(root.getElementsByTagName('*')).filter((element) => element.localName === name);
}
function childText(root: Element, name: string): string {
  return (
    Array.from(root.children)
      .find((child) => child.localName === name)
      ?.textContent?.trim() ?? ''
  );
}
function xmlValue(document: Document, name: string): string {
  const values = elements(document, name);
  if (values.length !== 1) throw new Error('The gateway reading is missing or ambiguous.');
  return values[0].textContent?.trim() ?? '';
}

type Service = { type: string; control: string; gateway: string; actions: Set<string> };
export class WanSource {
  private service: Service | null = null;
  constructor(private descriptionURL: string) {
    gatewayURL(descriptionURL);
  }

  private async read(url: string, action?: string): Promise<Document> {
    const gateway = gatewayURL(this.descriptionURL).hostname;
    const validated = sameGatewayURL(this.descriptionURL, url, gateway);
    if (action && (!WAN_READ_ACTIONS.has(action) || !this.service?.actions.has(action)))
      throw new Error('Only advertised WAN counter reads are supported.');
    const response = await NativeWan.read({
      url: validated,
      gateway,
      action,
      serviceType: this.service?.type,
    });
    return parseXML(response.xml);
  }

  private async connect(): Promise<Service> {
    const gateway = gatewayURL(this.descriptionURL).hostname;
    const description = await this.read(this.descriptionURL);
    if (
      !elements(description, 'deviceType').some((element) =>
        /^urn:schemas-upnp-org:device:InternetGatewayDevice:[12]$/.test(
          element.textContent?.trim() ?? '',
        ),
      )
    )
      throw new Error('This service does not identify an internet gateway.');
    const base = elements(description, 'URLBase')[0]?.textContent?.trim() || this.descriptionURL;
    sameGatewayURL(this.descriptionURL, base, gateway);
    const candidate = elements(description, 'service').find((element) =>
      WAN_TYPES.has(childText(element, 'serviceType')),
    );
    if (!candidate) throw new Error('The gateway does not advertise WAN traffic counters.');
    const control = childText(candidate, 'controlURL');
    const scpd = childText(candidate, 'SCPDURL');
    if (!control || !scpd) throw new Error('The WAN service description is incomplete.');
    const actionDocument = await this.read(sameGatewayURL(base, scpd, gateway));
    const actions = new Set(
      elements(actionDocument, 'action').map((element) => childText(element, 'name')),
    );
    if (!actions.has('GetTotalBytesReceived') || !actions.has('GetTotalBytesSent'))
      throw new Error('This gateway does not support both WAN byte counters.');
    this.service = {
      type: childText(candidate, 'serviceType'),
      control: sameGatewayURL(base, control, gateway),
      gateway,
      actions,
    };
    return this.service;
  }

  async sample(): Promise<{
    counters: WanCounters;
    capturedAtMs: number;
    linkStatus: string | null;
  }> {
    try {
      const service = this.service ?? (await this.connect());
      const started = performance.now();
      const [received, sent, properties] = await Promise.all([
        this.read(service.control, 'GetTotalBytesReceived'),
        this.read(service.control, 'GetTotalBytesSent'),
        service.actions.has('GetCommonLinkProperties')
          ? this.read(service.control, 'GetCommonLinkProperties')
          : Promise.resolve(null),
      ]);
      const finished = performance.now();
      if (finished - started > 2000)
        throw new Error('The gateway readings were too slow. Retrying.');
      const linkStatus = properties ? xmlValue(properties, 'NewPhysicalLinkStatus') : null;
      if (linkStatus && linkStatus !== 'Up')
        throw new Error('The gateway reports its WAN link is down.');
      return {
        counters: {
          sourceId: service.control,
          interfaceId: service.type,
          observedAtMs: Math.round((started + finished) / 2),
          receivedBytes: xmlValue(received, 'NewTotalBytesReceived'),
          sentBytes: xmlValue(sent, 'NewTotalBytesSent'),
        },
        capturedAtMs: Date.now(),
        linkStatus,
      };
    } catch (error) {
      this.service = null;
      throw error;
    }
  }
}
