const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const express = require('express');
const { resolveManagedPath } = require('./fileManager');
const { runSlQScript } = require('../scriptRunner');

const MAX_PROJECT_FILES = 500;
const MAX_PROJECT_BYTES = 50 * 1024 * 1024;
const skippedDirectoryNames = new Set(['.git', 'node_modules', '.vscode']);

function projectError(status, message) {
  return Object.assign(new Error(message), { status });
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative));
}

function dependencySuggestions(files) {
  const suggestions = [];
  const names = new Set(files.map((file) => file.name));
  if (names.has('package.json')) {
    suggestions.push({
      manifest: 'package.json',
      dependencies: [],
      commands: ['Revisa package.json y ejecuta npm install manualmente si confías en el proyecto.']
    });
  }
  if (names.has('pyproject.toml')) {
    suggestions.push({
      manifest: 'pyproject.toml',
      dependencies: [],
      commands: ['Revisa pyproject.toml antes de instalar; consulta las instrucciones del proyecto.']
    });
  }
  if (names.has('go.mod')) {
    suggestions.push({
      manifest: 'go.mod',
      dependencies: [],
      commands: ['go mod download']
    });
  }
  if (names.has('Cargo.toml')) {
    suggestions.push({
      manifest: 'Cargo.toml',
      dependencies: [],
      commands: ['cargo fetch']
    });
  }
  return suggestions;
}

async function inspectProjectPath(root, relativePath) {
  const resolved = await resolveManagedPath(root, 'proyectos', relativePath, { allowEmpty: false });
  const rootStats = await fs.promises.lstat(resolved.filePath);
  if (rootStats.isSymbolicLink() || (!rootStats.isFile() && !rootStats.isDirectory())) {
    throw projectError(400, 'Solo se pueden analizar archivos y carpetas normales.');
  }

  const files = [];
  const hash = crypto.createHash('sha256');
  let totalBytes = 0;
  let skippedLinks = 0;

  const addFile = async (absolutePath, name) => {
    const stats = await fs.promises.lstat(absolutePath);
    if (stats.isSymbolicLink()) {
      skippedLinks += 1;
      return;
    }
    if (!stats.isFile()) return;
    if (files.length >= MAX_PROJECT_FILES) {
      throw projectError(413, `El análisis admite hasta ${MAX_PROJECT_FILES} archivos.`);
    }
    if (totalBytes + stats.size > MAX_PROJECT_BYTES) {
      throw projectError(413, 'El contenido analizado supera el límite de 50 MB.');
    }

    const content = await fs.promises.readFile(absolutePath);
    if (totalBytes + content.length > MAX_PROJECT_BYTES) {
      throw projectError(413, 'El contenido analizado supera el límite de 50 MB.');
    }
    const contentHash = crypto.createHash('sha256').update(content).digest('hex');
    files.push({ name, size: content.length, contentHash, absolutePath });
    totalBytes += content.length;
    hash.update(name).update('\0').update(contentHash).update('\0');
  };

  const walk = async (absoluteDirectory, relativeDirectory) => {
    const entries = await fs.promises.readdir(absoluteDirectory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      if (entry.name.startsWith('.') || skippedDirectoryNames.has(entry.name)) continue;
      const absolutePath = path.join(absoluteDirectory, entry.name);
      const relativeName = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const stats = await fs.promises.lstat(absolutePath);
      if (stats.isSymbolicLink()) {
        skippedLinks += 1;
      } else if (stats.isDirectory()) {
        await walk(absolutePath, relativeName);
      } else if (stats.isFile()) {
        await addFile(absolutePath, relativeName);
      }
    }
  };

  if (rootStats.isDirectory()) {
    await walk(resolved.filePath, '');
  } else {
    await addFile(resolved.filePath, path.posix.basename(resolved.relativePath));
  }
  files.sort((left, right) => left.name.localeCompare(right.name));
  hash.update(String(totalBytes)).update('\0');

  const manifestErrors = [];
  const dependencies = [];
  const packageManifest = files.find((file) => file.name === 'package.json');
  if (packageManifest) {
    try {
      const manifest = JSON.parse(await fs.promises.readFile(
        packageManifest.absolutePath, 'utf8'
      ));
      const packageDependencies = [
        ...Object.keys(manifest.dependencies || {}),
        ...Object.keys(manifest.devDependencies || {})
      ].sort();
      dependencies.push({
        manifest: 'package.json',
        dependencies: packageDependencies,
        commands: packageDependencies.length
          ? ['Revisa package.json y ejecuta npm install manualmente si confías en el proyecto.']
          : ['package.json no declara dependencias npm.']
      });
      if (manifest.scripts && Object.keys(manifest.scripts).length) {
        dependencies[dependencies.length - 1].scripts = Object.keys(manifest.scripts).sort();
      }
    } catch (error) {
      manifestErrors.push(`package.json no se pudo analizar: ${error.message}`);
    }
  }
  const requirements = files.find((file) => file.name === 'requirements.txt');
  if (requirements) {
    const names = (await fs.promises.readFile(requirements.absolutePath, 'utf8'))
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.match(/^([A-Za-z0-9][A-Za-z0-9._-]*)/)?.[1])
      .filter(Boolean);
    dependencies.push({
      manifest: 'requirements.txt',
      dependencies: [...new Set(names)].sort(),
      commands: ['python3 -m venv .venv', 'source .venv/bin/activate && pip install -r requirements.txt']
    });
  }
  const otherSuggestions = dependencySuggestions(files).filter((item) =>
    item.manifest !== 'package.json' && item.manifest !== 'requirements.txt'
  );
  dependencies.push(...otherSuggestions);

  const approvalHash = hash.digest('hex');
  return {
    path: resolved.relativePath,
    kind: rootStats.isDirectory() ? 'directory' : 'file',
    editorUrl: `vscode://file${pathToFileURL(path.resolve(resolved.filePath)).pathname}`,
    isSlq: rootStats.isFile() && path.extname(resolved.relativePath).toLowerCase() === '.slq',
    entryPoint: rootStats.isFile() && path.extname(resolved.relativePath).toLowerCase() === '.html'
      ? resolved.relativePath
      : rootStats.isDirectory() && files.some((file) => file.name === 'index.html')
        ? `${resolved.relativePath ? `${resolved.relativePath}/` : ''}index.html`
        : null,
    fileCount: files.length,
    totalBytes,
    hash: approvalHash,
    files: files.slice(0, 100).map(({ name, size }) => ({ name, size })),
    truncated: files.length > 100,
    dependencies,
    manifestErrors,
    warnings: [
      ...(skippedLinks ? [`Se omitieron ${skippedLinks} enlace(s) simbólico(s).`] : []),
      'Se excluyen archivos ocultos, .git, node_modules y .vscode del análisis y de la certificación.',
      'La aprobación habilita el contenido web. Un archivo .slq requiere una confirmación de ejecución separada; no se instalan dependencias.'
    ]
  };
}

function createProjectManager(rootDirectory, options = {}) {
  const root = path.resolve(rootDirectory);
  const approvalFile = path.resolve(
    options.approvalFile || process.env.SLQ_PROJECT_APPROVALS_FILE ||
    path.join(root, '.slqaccept.json')
  );
  const projectsRoot = path.join(root, 'proyectos');
  const router = express.Router();
  let writeQueue = Promise.resolve();
  let scriptRunQueue = Promise.resolve();

  const readApprovals = async () => {
    try {
      const stats = await fs.promises.lstat(approvalFile);
      if (!stats.isFile() || stats.isSymbolicLink()) {
        throw projectError(500, 'El registro de aprobaciones no es un archivo normal.');
      }
      const parsed = JSON.parse(await fs.promises.readFile(approvalFile, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw projectError(500, 'El registro de aprobaciones tiene un formato inválido.');
      }
      return parsed;
    } catch (error) {
      if (error.code === 'ENOENT') return {};
      throw error;
    }
  };

  const saveApproval = (projectPath, hash, approvedBy) => {
    const persist = async () => {
      const approvals = await readApprovals();
      approvals[projectPath] = { hash, approvedBy, approvedAt: new Date().toISOString() };
      await fs.promises.mkdir(path.dirname(approvalFile), { recursive: true, mode: 0o750 });
      const temporaryPath = `${approvalFile}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`;
      try {
        await fs.promises.writeFile(temporaryPath, `${JSON.stringify(approvals, null, 2)}\n`, {
          encoding: 'utf8',
          mode: 0o600,
          flag: 'wx'
        });
        await fs.promises.rename(temporaryPath, approvalFile);
      } catch (error) {
        await fs.promises.unlink(temporaryPath).catch((cleanupError) => {
          if (cleanupError.code !== 'ENOENT') {
            console.error(`No se pudo limpiar un registro temporal: ${cleanupError.message}`);
          }
        });
        throw error;
      }
    };
    writeQueue = writeQueue.then(persist, persist);
    return writeQueue;
  };

  const findCurrentApproval = async (relativePath) => {
    const segments = relativePath.split('/').filter(Boolean);
    const approvals = await readApprovals();
    for (let length = segments.length; length > 0; length -= 1) {
      const candidatePath = segments.slice(0, length).join('/');
      const approval = approvals[candidatePath];
      if (!approval) continue;
      try {
        const inspection = await inspectProjectPath(root, candidatePath);
        if (inspection.hash === approval.hash) {
          return { ...approval, path: candidatePath };
        }
      } catch (error) {
        if (error.status === 404 || error.code === 'ENOENT' || error.code === 'ENOTDIR') continue;
        throw error;
      }
    }
    return null;
  };

  router.get('/api/projects/inspect', async (request, response) => {
    try {
      const inspection = await inspectProjectPath(root, request.query.path);
      const approval = await findCurrentApproval(inspection.path);
      response.set('Cache-Control', 'no-store').json({
        ...inspection,
        approved: Boolean(approval),
        approvedBy: approval?.approvedBy || null,
        approvedAt: approval?.approvedAt || null
      });
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : error.code === 'ENOENT' ? 404 : 500;
      if (status >= 500) console.error(`No se pudo analizar el proyecto: ${error.message}`);
      response.status(status).json({ error: status >= 500 ? 'No se pudo completar el análisis del proyecto.' : error.message });
    }
  });

  router.post('/api/projects/accept', express.json({ limit: '16kb' }), async (request, response) => {
    try {
      const body = request.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw projectError(400, 'El cuerpo de aprobación no es válido.');
      }
      const inspection = await inspectProjectPath(root, body.path);
      if (typeof body.hash !== 'string' || body.hash !== inspection.hash) {
        throw projectError(409, 'El contenido cambió después del análisis. Analízalo de nuevo antes de aprobarlo.');
      }
      const approvedBy = request.slqUsername;
      if (!approvedBy) throw projectError(401, 'No se pudo identificar al usuario autenticado.');
      await saveApproval(inspection.path, inspection.hash, approvedBy);
      response.status(201).json({
        path: inspection.path,
        hash: inspection.hash,
        approvedBy,
        approvedAt: new Date().toISOString()
      });
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : error.code === 'ENOENT' ? 404 : 500;
      if (status >= 500) console.error(`No se pudo registrar la aprobación del proyecto: ${error.message}`);
      response.status(status).json({ error: status >= 500 ? 'No se pudo registrar la aprobación del proyecto.' : error.message });
    }
  });

  router.post('/api/projects/run-slq', express.json({ limit: '16kb' }), async (request, response) => {
    try {
      const body = request.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw projectError(400, 'El cuerpo de ejecución no es válido.');
      }
      const resolved = await resolveManagedPath(root, 'proyectos', body.path, { allowEmpty: false });
      if (path.extname(resolved.filePath).toLowerCase() !== '.slq') {
        throw projectError(400, 'Solo se pueden ejecutar scripts .slq de proyectos.');
      }
      const stats = await fs.promises.lstat(resolved.filePath);
      if (!stats.isFile() || stats.isSymbolicLink()) {
        throw projectError(404, 'El script .slq no existe.');
      }
      if (!await findCurrentApproval(resolved.relativePath)) {
        throw projectError(403, 'El script no tiene una aprobación vigente. Analízalo y apruébalo primero.');
      }
      const run = () => runSlQScript(`proyectos/${resolved.relativePath}`, root);
      const resultPromise = scriptRunQueue.then(run, run);
      scriptRunQueue = resultPromise.then(() => undefined, () => undefined);
      const result = await resultPromise;
      if (!result.success) throw projectError(400, result.output || 'El script SlQ no se pudo ejecutar.');
      response.json({ output: result.output });
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : error.code === 'ENOENT' ? 404 : 500;
      if (status >= 500) console.error(`No se pudo ejecutar el script del proyecto: ${error.message}`);
      response.status(status).json({ error: status >= 500 ? 'No se pudo ejecutar el script SlQ.' : error.message });
    }
  });

  const isApprovedForServing = async (filePath) => {
    const relative = path.relative(projectsRoot, filePath);
    if (!isInside(projectsRoot, filePath) || !relative || relative.startsWith('..')) return false;
    if (relative.split(path.sep).some((part) => part.startsWith('.') || part === 'node_modules' || part === '.git')) {
      return false;
    }
    return Boolean(await findCurrentApproval(relative.split(path.sep).join('/')));
  };

  return { router, isApprovedForServing };
}

module.exports = { createProjectManager };
