const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { generateSystemDashboard } = require('../src/web/systemDashboard');

test('system dashboard renders reports and network values as escaped text', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'slq-dashboard-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(directory, 'reporte_equipo.txt'),
    '</pre><script>alert("x")</script>&'
  );
  fs.writeFileSync(path.join(directory, 'reporte.slq'), 'imprimir "ok"');

  const outputPath = generateSystemDashboard({
    directory,
    activeIp: '<script>alert(1)</script>'
  });
  const html = fs.readFileSync(outputPath, 'utf8');

  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /http:\/\/localhost:3000/);
  assert.match(html, /&lt;\/pre&gt;&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;&amp;/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /href="\.\/reporte\.slq"/);
});

test('system dashboard reports when no system report exists', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'slq-dashboard-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const outputPath = generateSystemDashboard({ directory, activeIp: '192.0.2.10' });
  const html = fs.readFileSync(outputPath, 'utf8');

  assert.match(html, /Aún no se ha generado un informe/);
  assert.match(html, /192\.0\.2\.10/);
  assert.doesNotMatch(html, /192\.168\.1\.90/);
});
