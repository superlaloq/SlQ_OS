const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createWebServer } = require('../src/web/server');

test('Express authenticates and safely serves the Frontweb and managed files', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'slq-web-test-'));
  for (const directory of ['frontweb', 'frontweb/assets', 'imagenes', 'videos', 'documentos', 'proyectos']) {
    fs.mkdirSync(path.join(root, directory), { recursive: true });
  }
  const applicationDirectory = path.join(root, 'share', 'applications');
  const iconDirectory = path.join(root, 'share', 'icons', 'hicolor', '48x48', 'apps');
  fs.mkdirSync(applicationDirectory, { recursive: true });
  fs.mkdirSync(iconDirectory, { recursive: true });
  fs.writeFileSync(path.join(applicationDirectory, 'demo-editor.desktop'), [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Demo Editor',
    'Name[es]=Editor de demostración',
    'Exec=demo-editor %F',
    'Icon=demo-editor',
    'Categories=Development;IDE;',
    'OnlyShowIn=XFCE;',
    ''
  ].join('\n'));
  fs.writeFileSync(path.join(applicationDirectory, 'science-tool.desktop'), [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Science Tool',
    'Exec=science-tool',
    'Categories=Education;Science;',
    ''
  ].join('\n'));
  fs.writeFileSync(path.join(applicationDirectory, 'hidden.desktop'), [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Hidden App',
    'Exec=hidden-app',
    'Hidden=true',
    ''
  ].join('\n'));
  fs.writeFileSync(path.join(iconDirectory, 'demo-editor.png'), 'test-icon');
  fs.mkdirSync(path.join(root, 'proyectos', 'demo'));
  fs.writeFileSync(path.join(root, 'proyectos', 'demo', 'package.json'), JSON.stringify({
    dependencies: { express: '^5.0.0' }
  }));
  fs.writeFileSync(path.join(root, 'proyectos', 'demo', 'check.slq'), 'imprimir "project-ok"');
  fs.writeFileSync(path.join(root, 'frontweb', 'index.html'), '<h1>SlQ Frontweb</h1>');
  fs.writeFileSync(path.join(root, 'frontweb', 'app.js'), 'console.log("frontweb");');
  fs.copyFileSync(path.join(__dirname, '../frontweb/reader.html'), path.join(root, 'frontweb', 'reader.html'));
  fs.copyFileSync(path.join(__dirname, '../frontweb/reader.js'), path.join(root, 'frontweb', 'reader.js'));
  for (const asset of ['slq-os-icon.svg', 'slq-os-mark.svg', 'slq-ai-mark.svg']) {
    fs.copyFileSync(path.join(__dirname, '../frontweb/assets', asset), path.join(root, 'frontweb/assets', asset));
  }
  for (const page of ['redes-sociales.html', 'correos.html', 'webs-destacadas.html']) {
    fs.copyFileSync(path.join(__dirname, '../frontweb', page), path.join(root, 'frontweb', page));
  }
  fs.writeFileSync(path.join(root, 'imagenes', 'foto.png'), 'imagen');
  fs.writeFileSync(path.join(root, 'videos', 'demo.mp4'), '0123456789');
  fs.writeFileSync(path.join(root, 'documentos', 'guia.pdf'), 'documento');
  fs.writeFileSync(path.join(root, 'documentos', 'vision.md'), '# Visión\n\n**SlQ** en la web.');
  fs.writeFileSync(path.join(root, 'documentos', 'unsafe.html'), '<script>alert(1)</script>');
  fs.writeFileSync(path.join(root, 'proyectos', 'demo', 'index.html'), '<h1>Demo</h1>');
  fs.writeFileSync(path.join(root, 'programa.slq'), 'imprimir "ok"');
  fs.writeFileSync(path.join(root, 'credentials.json'), '{"secret":true}');

  const salt = crypto.randomBytes(16);
  const passwordHash = crypto.scryptSync('a-test-password-that-is-long', salt, 32);
  let launchedApplication = null;
  const server = createWebServer(root, {
    credentials: { username: 'test-user', salt, passwordHash },
    applicationDirectories: [applicationDirectory],
    desktopEnvironment: 'XFCE',
    launcher: async (desktopFile) => {
      launchedApplication = desktopFile;
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    fs.rmSync(root, { recursive: true, force: true });
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const authHeader = `Basic ${Buffer.from('test-user:a-test-password-that-is-long').toString('base64')}`;
  const request = (url, options = {}) => {
    const headers = new Headers(options.headers);
    headers.set('Authorization', authHeader);
    if (options.method && options.method !== 'GET' && options.method !== 'HEAD') {
      headers.set('Origin', baseUrl);
    }
    return fetch(new URL(url, baseUrl), { ...options, headers });
  };

  const unauthenticated = await fetch(baseUrl);
  assert.equal(unauthenticated.status, 401);
  assert.match(unauthenticated.headers.get('www-authenticate'), /Basic realm/);

  const homepage = await request(baseUrl);
  assert.equal(homepage.status, 200);
  assert.match(await homepage.text(), /SlQ Frontweb/);

  const appScript = await request(`${baseUrl}/frontweb/app.js`);
  assert.equal(appScript.headers.get('content-type'), 'text/javascript; charset=utf-8');
  const applicationsResponse = await request(`${baseUrl}/api/apps`);
  const applications = await applicationsResponse.json();
  assert.deepEqual(applications, [{
    id: 'demo-editor.desktop',
    name: 'Editor de demostración',
    category: 'Desarrollo',
    iconUrl: '/api/apps/demo-editor.desktop/icon'
  }, {
    id: 'science-tool.desktop',
    name: 'Science Tool',
    category: 'Educación',
    iconUrl: null
  }]);
  const applicationIcon = await request(`${baseUrl}${applications[0].iconUrl}`);
  assert.equal(applicationIcon.headers.get('content-type'), 'image/png');
  assert.equal(await applicationIcon.text(), 'test-icon');
  const launchApplication = await request(`${baseUrl}/api/apps/demo-editor.desktop/launch`, {
    method: 'POST'
  });
  assert.equal(launchApplication.status, 202);
  assert.equal(launchedApplication, path.join(applicationDirectory, 'demo-editor.desktop'));
  const crossOriginLaunch = await fetch(`${baseUrl}/api/apps/demo-editor.desktop/launch`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      Origin: 'http://untrusted.example'
    }
  });
  assert.equal(crossOriginLaunch.status, 403);
  assert.equal(launchedApplication, path.join(applicationDirectory, 'demo-editor.desktop'));
  assert.equal((await request(`${baseUrl}/api/apps/not-installed.desktop/launch`, {
    method: 'POST'
  })).status, 404);
  const logo = await request(`${baseUrl}/frontweb/assets/slq-os-icon.svg`);
  assert.equal(logo.headers.get('content-type'), 'image/svg+xml');
  assert.match(await logo.text(), /Simbolo de SlQ-OS/);

  const markdownReader = await request(`${baseUrl}/frontweb/reader.html`);
  assert.equal(markdownReader.status, 200);
  assert.match(await markdownReader.text(), /markdown-document/);
  const markdownReaderScript = await request(`${baseUrl}/frontweb/reader.js`);
  assert.equal(markdownReaderScript.headers.get('content-type'), 'text/javascript; charset=utf-8');

  const unapprovedProject = await request(`${baseUrl}/proyectos/demo/`);
  assert.equal(unapprovedProject.status, 403);

  const inspectionResponse = await request(`${baseUrl}/api/projects/inspect?path=demo`);
  assert.equal(inspectionResponse.status, 200);
  const inspection = await inspectionResponse.json();
  assert.equal(inspection.kind, 'directory');
  assert.equal(inspection.entryPoint, 'demo/index.html');
  assert.match(inspection.editorUrl, /^vscode:\/\/file/);
  assert.equal(inspection.approved, false);
  assert.deepEqual(inspection.dependencies[0].dependencies, ['express']);
  assert.equal((await request(`${baseUrl}/api/projects/inspect?path=../credentials.json`)).status, 400);
  const rejectedProjectScript = await request(`${baseUrl}/api/projects/run-slq`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: 'demo/check.slq' })
  });
  assert.equal(rejectedProjectScript.status, 403);
  const approval = await request(`${baseUrl}/api/projects/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: inspection.path, hash: inspection.hash })
  });
  assert.equal(approval.status, 201);
  assert.equal((await approval.json()).approvedBy, 'test-user');
  const projectScript = await request(`${baseUrl}/api/projects/run-slq`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: 'demo/check.slq' })
  });
  assert.equal(projectScript.status, 200);
  assert.match((await projectScript.json()).output, /project-ok/);

  const project = await request(`${baseUrl}/proyectos/demo/`);
  assert.equal(project.status, 200);
  assert.match(project.headers.get('content-security-policy'), /sandbox allow-scripts/);
  assert.match(await project.text(), /Demo/);

  const video = await request(`${baseUrl}/videos/demo.mp4`, { headers: { Range: 'bytes=2-5' } });
  assert.equal(video.status, 206);
  assert.equal(video.headers.get('content-range'), 'bytes 2-5/10');
  assert.equal(await video.text(), '2345');

  const catalogResponse = await request(`${baseUrl}/api/files`);
  const catalog = await catalogResponse.json();
  assert.deepEqual(catalog.imagenes.map((file) => file.name), ['foto.png']);
  assert.deepEqual(catalog.scripts.map((file) => file.name), ['programa.slq']);
  assert.equal(catalog['redes-sociales'], 7);
  assert.equal(catalog.correos, 1);
  assert.equal(catalog['webs-destacadas'], 1);

  const socialPage = await request(`${baseUrl}/redes-sociales`);
  assert.equal(socialPage.status, 200);
  const socialPageHtml = await socialPage.text();
  assert.match(socialPageHtml, /data-links-category="redes-sociales"/);
  assert.match(socialPageHtml, /link-login-address/);
  assert.equal((await request(`${baseUrl}/frontweb/redes-sociales`)).status, 200);
  const emailPage = await request(`${baseUrl}/correos`);
  assert.match(await emailPage.text(), /data-links-category="correos"/);
  assert.equal((await request(`${baseUrl}/frontweb/correos`)).status, 200);
  const bookmarksPage = await request(`${baseUrl}/webs-destacadas`);
  assert.match(await bookmarksPage.text(), /data-links-category="webs-destacadas"/);
  const frontwebBookmarksPage = await request(`${baseUrl}/frontweb/webs-destacadas`);
  assert.equal(frontwebBookmarksPage.status, 200);
  assert.match(await frontwebBookmarksPage.text(), /data-links-category="webs-destacadas"/);

  const socialLinks = await request(`${baseUrl}/api/links/redes-sociales`);
  const defaultSocials = await socialLinks.json();
  assert.deepEqual(defaultSocials.map((entry) => entry.name), [
    'X', 'Facebook', 'Instagram', 'LinkedIn', 'Blogger', 'GitHub', 'Binance'
  ]);
  assert.ok(defaultSocials.every((entry) => entry.loginUrl.startsWith('https://')));
  const defaultEmails = await (await request(`${baseUrl}/api/links/correos`)).json();
  assert.equal(defaultEmails[0].name, 'Gmail');
  assert.equal(defaultEmails[0].url, 'https://mail.google.com/');
  assert.equal(defaultEmails[0].loginUrl, 'https://accounts.google.com/');
  const defaultWebsites = await (await request(`${baseUrl}/api/links/webs-destacadas`)).json();
  assert.deepEqual(
    { name: defaultWebsites[0].name, url: defaultWebsites[0].url },
    { name: 'Free Software Foundation', url: 'https://www.fsf.org/' }
  );
  const addWebsite = await request(`${baseUrl}/api/links/webs-destacadas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'SlQ', url: 'https://example.com/slq' })
  });
  assert.equal(addWebsite.status, 201);
  const website = await addWebsite.json();
  assert.equal(website.url, 'https://example.com/slq');
  const storedLinks = JSON.parse(await fs.promises.readFile(
    path.join(root, 'data', 'links', 'webs-destacadas.slq.json'), 'utf8'
  ));
  assert.equal(storedLinks.format, 'slq.links.v1');
  assert.ok(storedLinks.links.some((entry) => entry.id === website.id));
  assert.equal((await request(`${baseUrl}/api/links/webs-destacadas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Unsafe', url: 'javascript:alert(1)' })
  })).status, 400);
  assert.equal((await request(`${baseUrl}/api/links/webs-destacadas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Credentials', url: 'https://user:pass@example.com/' })
  })).status, 400);
  const addEmail = await request(`${baseUrl}/api/links/correos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Trabajo', url: 'work@example.com' })
  });
  assert.equal((await addEmail.json()).url, 'mailto:work@example.com');
  assert.equal((await request(`${baseUrl}/api/links/correos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Inválido', url: 'not-an-email' })
  })).status, 400);
  assert.equal((await request(`${baseUrl}/api/links/webs-destacadas/${website.id}`, {
    method: 'DELETE'
  })).status, 204);

  const listing = await request(`${baseUrl}/api/manage/files?category=imagenes`);
  assert.deepEqual((await listing.json()).entries.map((entry) => entry.name), ['foto.png']);

  const projectFolder = new FormData();
  projectFolder.set('destination', '');
  projectFolder.append('files', new Blob(['<h1>Imported</h1>']), 'sample-site/index.html');
  projectFolder.append('files', new Blob(['body { color: red; }']), 'sample-site/assets/site.css');
  projectFolder.append('files', new Blob(['metadata']), 'sample-site/.DS_Store');
  const folderUpload = await request(`${baseUrl}/api/projects/upload-folder`, {
    method: 'POST',
    body: projectFolder
  });
  assert.equal(folderUpload.status, 201);
  assert.deepEqual(await folderUpload.json(), {
    folder: 'sample-site',
    destination: '',
    fileCount: 2,
    totalBytes: Buffer.byteLength('<h1>Imported</h1>') + Buffer.byteLength('body { color: red; }'),
    skippedFiles: 1
  });
  assert.equal(await fs.promises.readFile(path.join(root, 'proyectos', 'sample-site', 'assets', 'site.css'), 'utf8'), 'body { color: red; }');

  const unsafeProjectFolder = new FormData();
  unsafeProjectFolder.set('destination', '');
  unsafeProjectFolder.append('files', new Blob(['unsafe']), 'unsafe/../outside.txt');
  assert.equal((await request(`${baseUrl}/api/projects/upload-folder`, {
    method: 'POST',
    body: unsafeProjectFolder
  })).status, 400);

  const duplicateProjectFolder = new FormData();
  duplicateProjectFolder.set('destination', '');
  duplicateProjectFolder.append('files', new Blob(['duplicate']), 'sample-site/index.html');
  assert.equal((await request(`${baseUrl}/api/projects/upload-folder`, {
    method: 'POST',
    body: duplicateProjectFolder
  })).status, 409);

  const markdown = await request(`${baseUrl}/api/manage/markdown?category=documentos&path=vision.md`);
  assert.equal(markdown.status, 200);
  assert.deepEqual(await markdown.json(), { name: 'vision.md', content: '# Visión\n\n**SlQ** en la web.' });
  assert.equal((await request(`${baseUrl}/api/manage/markdown?category=documentos&path=guia.pdf`)).status, 400);
  assert.equal((await request(`${baseUrl}/api/manage/markdown?category=imagenes&path=../credentials.json`)).status, 400);

  const upload = new FormData();
  upload.set('category', 'documentos');
  upload.set('path', '');
  upload.append('files', new Blob(['uploaded']), 'nuevo.txt');
  assert.equal((await request(`${baseUrl}/api/manage/upload`, { method: 'POST', body: upload })).status, 201);

  const createFolder = await request(`${baseUrl}/api/manage/folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category: 'proyectos', path: '', name: 'nuevo' })
  });
  assert.equal(createFolder.status, 201);

  const copy = await request(`${baseUrl}/api/manage/copy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category: 'documentos', path: 'guia.pdf', name: 'copia.pdf' })
  });
  assert.equal(copy.status, 201);

  const duplicateCopy = await request(`${baseUrl}/api/manage/copy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category: 'documentos', path: 'guia.pdf', name: 'copia.pdf' })
  });
  assert.equal(duplicateCopy.status, 409);

  const move = await request(`${baseUrl}/api/manage/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category: 'documentos', path: 'copia.pdf', destinationCategory: 'proyectos', destinationPath: 'nuevo' })
  });
  assert.equal(move.status, 200);

  const nonEmptyFolderDelete = await request(`${baseUrl}/api/manage/files`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category: 'proyectos', path: 'nuevo' })
  });
  assert.equal(nonEmptyFolderDelete.status, 409);

  const rename = await request(`${baseUrl}/api/manage/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category: 'documentos', path: 'nuevo.txt', name: 'renombrado.txt' })
  });
  assert.equal(rename.status, 200);
  assert.equal(await fs.promises.readFile(path.join(root, 'documentos', 'guia.pdf'), 'utf8'), 'documento');

  const remove = await request(`${baseUrl}/api/manage/files`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category: 'documentos', path: 'renombrado.txt' })
  });
  assert.equal(remove.status, 204);

  const runScript = await request(`${baseUrl}/api/manage/run-script`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'programa.slq' })
  });
  assert.equal(runScript.status, 200);
  assert.match((await runScript.json()).output, /ok/);

  const rejectedRun = await request(`${baseUrl}/api/manage/run-script`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'credentials.json' })
  });
  assert.equal(rejectedRun.status, 400);

  const unsafeDocument = await request(`${baseUrl}/documentos/unsafe.html`);
  assert.equal(unsafeDocument.headers.get('content-disposition'), 'attachment');
  assert.equal((await request(`${baseUrl}/credentials.json`)).status, 404);
  assert.equal((await request(`${baseUrl}/%2e%2e%2fcredentials.json`)).status, 400);

  const rejectedCategory = await request(`${baseUrl}/api/manage/files?category=..`);
  assert.equal(rejectedCategory.status, 400);
  const rejectedPath = await request(`${baseUrl}/api/manage/files?category=imagenes&path=..`);
  assert.equal(rejectedPath.status, 400);
  const rejectedOrigin = await fetch(`${baseUrl}/api/manage/folders`, {
    method: 'POST',
    headers: { Authorization: authHeader, Origin: 'http://malicious.test', 'Content-Type': 'application/json' },
    body: JSON.stringify({ category: 'imagenes', path: '', name: 'no' })
  });
  assert.equal(rejectedOrigin.status, 403);

  await assert.rejects(fs.promises.access(path.join(root, 'documentos', 'copia.pdf')));
  assert.equal(await fs.promises.readFile(path.join(root, 'proyectos', 'nuevo', 'copia.pdf'), 'utf8'), 'documento');

  fs.writeFileSync(path.join(root, 'proyectos', 'demo', 'index.html'), '<h1>Changed</h1>');
  assert.equal((await request(`${baseUrl}/proyectos/demo/`)).status, 403);
  const staleApproval = await request(`${baseUrl}/api/projects/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: inspection.path, hash: inspection.hash })
  });
  assert.equal(staleApproval.status, 409);
  assert.equal((await request(`${baseUrl}/api/projects/run-slq`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: 'demo/check.slq' })
  })).status, 403);
});
