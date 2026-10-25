const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { getWebCredentialsFromFile } = require('../src/web/auth');

test('loads Frontweb credentials from the installer configuration without evaluating it', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'slq-web-auth-test-'));
  const configPath = path.join(directory, 'web-auth.env');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const salt = crypto.randomBytes(16);
  const passwordHash = crypto.randomBytes(32);
  fs.writeFileSync(configPath, [
    'SLQ_WEB_USER=slq-user',
    `SLQ_WEB_PASSWORD_SALT=${salt.toString('hex')}`,
    `SLQ_WEB_PASSWORD_HASH=${passwordHash.toString('hex')}`,
    ''
  ].join('\n'));

  const credentials = getWebCredentialsFromFile(configPath);
  assert.equal(credentials.username, 'slq-user');
  assert.deepEqual(credentials.salt, salt);
  assert.deepEqual(credentials.passwordHash, passwordHash);

  fs.appendFileSync(configPath, 'SLQ_WEB_USER=unexpected\n');
  assert.throws(() => getWebCredentialsFromFile(configPath), /Configuración de autenticación inválida/);
});
