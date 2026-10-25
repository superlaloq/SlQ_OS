const assert = require('node:assert/strict');
const test = require('node:test');
const { validateNetworkTarget, getLocalNetworkTarget } = require('../src/systemScanner');

test('network scanner accepts only canonical private subnets up to /24 size', () => {
  assert.equal(validateNetworkTarget('192.168.1.0/24'), '192.168.1.0/24');
  assert.equal(validateNetworkTarget('10.20.30.4/30'), '10.20.30.4/30');
  assert.throws(() => validateNetworkTarget('8.8.8.0/24'), /subred IPv4 privada/);
  assert.throws(() => validateNetworkTarget('192.168.0.0/16'), /se limita a subredes/);
  assert.throws(() => validateNetworkTarget('192.168.1.1/24'), /dirección de red/);
});

test('network scanner derives a bounded target from a private interface', () => {
  assert.equal(getLocalNetworkTarget({
    lo: [{ family: 'IPv4', internal: true, address: '127.0.0.1', cidr: '127.0.0.1/8' }],
    eth0: [{ family: 'IPv4', internal: false, address: '192.168.10.15', cidr: '192.168.10.15/24' }]
  }), '192.168.10.0/24');
  assert.throws(() => getLocalNetworkTarget({
    eth0: [{ family: 'IPv4', internal: false, address: '10.0.0.8', cidr: '10.0.0.8/16' }]
  }), /demasiado amplia/);
});
