import assert from 'node:assert/strict';
import test from 'node:test';
import { gatewayURL, sameGatewayURL } from '../src/network/upnp';

test('gateway sources are restricted to private IPv4 endpoints without embedded secrets', () => {
  for (const host of ['10.0.0.1', '172.16.0.1', '172.31.255.254', '192.168.1.1'])
    assert.equal(gatewayURL(`http://${host}:49154/root.xml`).hostname, host);
  for (const raw of [
    'http://example.com/root.xml',
    'http://127.0.0.1/root.xml',
    'http://172.32.0.1/root.xml',
    'http://8.8.8.8/root.xml',
    'file:///tmp/root.xml',
    'http://admin:secret@10.0.0.1/root.xml',
    'http://10.0.0.1/root.xml#secret',
  ])
    assert.throws(() => gatewayURL(raw));
});

test('advertised service URLs stay on the selected gateway even across relative paths', () => {
  assert.equal(
    sameGatewayURL('http://10.0.0.1:49154/root.xml', '/WAN/control', '10.0.0.1'),
    'http://10.0.0.1:49154/WAN/control',
  );
  assert.throws(() => sameGatewayURL('http://10.0.0.1/root.xml', '//10.0.0.2/control', '10.0.0.1'));
  assert.throws(() =>
    sameGatewayURL('http://10.0.0.1/root.xml', 'https://example.com/control', '10.0.0.1'),
  );
});
