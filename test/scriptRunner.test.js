const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { runSlQScript } = require('../src/scriptRunner');

test('script runner reports unsupported syntax instead of silently ignoring it', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'slq-script-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(path.join(directory, 'invalid.slq'), 'SELECT hostname FROM hosts');

  const result = await runSlQScript('invalid.slq', directory);

  assert.equal(result.success, false);
  assert.match(result.output, /Instrucción SlQ no reconocida: SELECT hostname FROM hosts/);
});
