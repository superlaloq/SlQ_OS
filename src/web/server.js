const fs = require('fs');
const http = require('http');
const path = require('path');
const express = require('express');
const { createFileManagerRouter } = require('./fileManager');
const { createApplicationManager } = require('./applicationManager');
const { createWebAuthMiddleware, getWebCredentials } = require('./auth');
const { createProjectManager } = require('./projectManager');
const { createLinkManager } = require('./linkManager');

const assetDirectories = ['imagenes', 'videos', 'documentos', 'proyectos'];
const linkPages = {
  'redes-sociales': 'redes-sociales.html',
  correos: 'correos.html',
  'webs-destacadas': 'webs-destacadas.html'
};
const contentTypes = {
  '.avif': 'image/avif',
  '.css': 'text/css; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.mpeg': 'video/mpeg',
  '.mkv': 'video/x-matroska',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.odp': 'application/vnd.oasis.opendocument.presentation',
  '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.rtf': 'application/rtf',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.slq': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip': 'application/zip'
};

function isWithinDirectory(directory, candidate) {
  const relative = path.relative(directory, candidate);
  return relative !== '' && relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function readRequestPath(requestUrl) {
  const rawPath = requestUrl.split('?')[0];
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch (_error) {
    return null;
  }

  if (!decodedPath.startsWith('/') || decodedPath.includes('\0') || decodedPath.includes('\\')) {
    return null;
  }

  const segments = decodedPath.slice(1).split('/');
  if (segments.some((segment) => segment === '.' || segment === '..')) return null;
  return { pathname: decodedPath, segments };
}

async function listFiles(directory, relativeDirectory = '') {
  const entries = await fs.promises.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;

    const relativePath = path.join(relativeDirectory, entry.name);
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(absolutePath, relativePath));
    } else if (entry.isFile()) {
      const stats = await fs.promises.stat(absolutePath);
      files.push({
        name: relativePath.split(path.sep).join('/'),
        size: stats.size,
        type: contentTypes[path.extname(entry.name).toLowerCase()] || 'application/octet-stream'
      });
    }
  }

  return files;
}

async function getFileCatalog(root, linkManager) {
  const catalog = {};
  for (const directory of assetDirectories) {
    const directoryPath = path.join(root, directory);
    const stats = await fs.promises.lstat(directoryPath);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error(`La carpeta ${directory} debe existir y no puede ser un enlace simbólico.`);
    }
    catalog[directory] = await listFiles(directoryPath);
  }
  catalog.scripts = (await fs.promises.readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.') &&
      entry.name.toLowerCase().endsWith('.slq'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))
    .map((name) => ({ name, size: 0, type: contentTypes['.slq'] }));
  await Promise.all(catalog.scripts.map(async (file) => {
    const stats = await fs.promises.stat(path.join(root, file.name));
    file.size = stats.size;
  }));
  for (const category of Object.keys(linkPages)) {
    catalog[category] = await linkManager.count(category);
  }
  return catalog;
}

async function resolveFile(root, pathname, segments) {
  if (pathname === '/dashboard' || pathname === '/dashboard/') {
    return path.join(root, 'index.html');
  }

  const categoryPage = assetDirectories.find((directory) =>
    pathname === `/${directory}` || pathname === `/${directory}/`
  );
  if (categoryPage) {
    return path.join(root, 'frontweb', `${categoryPage}.html`);
  }
  if (pathname === '/scripts' || pathname === '/scripts/') {
    return path.join(root, 'frontweb', 'scripts.html');
  }
  if (linkPages[segments[0]] && segments.length === 1) {
    return path.join(root, 'frontweb', linkPages[segments[0]]);
  }

  if (segments[0] === 'frontweb' && segments.length > 1) {
    if (segments.length === 2 && linkPages[segments[1]]) {
      return path.join(root, 'frontweb', linkPages[segments[1]]);
    }
    const frontwebRoot = path.join(root, 'frontweb');
    if (segments.slice(1).some((part) => part.startsWith('.'))) return null;
    const candidate = path.resolve(frontwebRoot, ...segments.slice(1));
    if (!isWithinDirectory(frontwebRoot, candidate)) return null;
    return candidate;
  }

  if (assetDirectories.includes(segments[0])) {
    const directoryRoot = path.join(root, segments[0]);
    const parts = segments.slice(1);
    if (parts.some((part) => part.startsWith('.') || part === 'node_modules')) return null;
    let candidate = path.resolve(directoryRoot, ...parts);
    if (!isWithinDirectory(directoryRoot, candidate)) return null;

    try {
      const stats = await fs.promises.lstat(candidate);
      if (stats.isDirectory()) {
        candidate = path.join(candidate, 'index.html');
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    return candidate;
  }

  if (segments.length === 1 && segments[0].toLowerCase().endsWith('.slq') &&
      !segments[0].startsWith('.')) {
    return path.join(root, segments[0]);
  }

  return null;
}

function sendError(response, statusCode, message) {
  response
    .status(statusCode)
    .set('Content-Type', 'text/plain; charset=utf-8')
    .set('X-Content-Type-Options', 'nosniff')
    .send(message);
}

function isLocalHost(request) {
  const hostHeader = request.get('Host');
  if (!hostHeader) return false;
  let hostname;
  try {
    hostname = new URL(`http://${hostHeader}`).hostname.toLowerCase().replace(/^\[|\]$/g, '');
  } catch (_error) {
    return false;
  }
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function createWebServer(rootDirectory = process.cwd(), options = {}) {
  const root = path.resolve(rootDirectory);
  const frontwebRoot = path.join(root, 'frontweb');
  const credentials = options.credentials || getWebCredentials();
  fs.mkdirSync(frontwebRoot, { recursive: true });
  for (const directory of assetDirectories) {
    fs.mkdirSync(path.join(root, directory), { recursive: true });
  }

  const app = express();
  app.disable('x-powered-by');
  app.use((request, response, next) => {
    if (!isLocalHost(request)) {
      response.status(403).type('text/plain').send('SlQ-OS Web solo acepta conexiones locales.');
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD' &&
        request.method !== 'OPTIONS') {
      const origin = request.get('Origin');
      const host = request.get('Host');
      if (!origin || origin !== `http://${host}`) {
        response.status(403).json({ error: 'Solicitud de origen no permitido.' });
        return;
      }
    }
    next();
  });
  app.use(createWebAuthMiddleware(credentials));
  app.use(createApplicationManager(options).router);
  app.use(createFileManagerRouter(root));
  const projectManager = createProjectManager(root, options);
  app.use(projectManager.router);
  const linkManager = createLinkManager(root, options);
  app.use(linkManager.router);

  app.use(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.set('Allow', 'GET, HEAD');
      sendError(response, 405, '405 Method Not Allowed');
      return;
    }

    const requestPath = readRequestPath(request.url || '/');
    if (!requestPath) {
      sendError(response, 400, '400 Bad Request');
      return;
    }

    if (requestPath.pathname === '/api/files') {
      try {
        const catalog = await getFileCatalog(root, linkManager);
        response
          .status(200)
          .set('Cache-Control', 'no-store')
          .set('X-Content-Type-Options', 'nosniff')
          .json(catalog);
      } catch (error) {
        console.error(`No se pudo generar el catálogo de archivos web: ${error.message}`);
        sendError(response, 500, '500 No se pudo cargar el catálogo de archivos.');
      }
      return;
    }

    const pathname = requestPath.pathname === '/' ? '/frontweb/index.html' : requestPath.pathname;
    const segments = pathname.slice(1).split('/');
    let filePath;
    try {
      filePath = await resolveFile(root, pathname, segments);
    } catch (error) {
      console.error(`No se pudo resolver el archivo solicitado: ${error.message}`);
      sendError(response, 500, '500 Internal Server Error');
      return;
    }

    if (!filePath || !isWithinDirectory(root, filePath)) {
      sendError(response, 404, '404 Not Found - SlQ-OS Frontweb');
      return;
    }

    let realPath;
    try {
      realPath = await fs.promises.realpath(filePath);
      const stats = await fs.promises.lstat(filePath);
      if (!stats.isFile() || stats.isSymbolicLink()) {
        sendError(response, 404, '404 Not Found - SlQ-OS Frontweb');
        return;
      }

      const isFrontwebFile = isWithinDirectory(frontwebRoot, filePath);
      const categoryRoot = assetDirectories
        .map((directory) => path.join(root, directory))
        .find((directory) => isWithinDirectory(directory, filePath));
      const allowedRoot = isFrontwebFile ? frontwebRoot : categoryRoot || root;
      const allowedRootStats = await fs.promises.lstat(allowedRoot);
      if (allowedRootStats.isSymbolicLink() || !allowedRootStats.isDirectory()) {
        sendError(response, 404, '404 Not Found - SlQ-OS Frontweb');
        return;
      }
      const realAllowedRoot = await fs.promises.realpath(allowedRoot);
      if (!isWithinDirectory(realAllowedRoot, realPath)) {
        sendError(response, 404, '404 Not Found - SlQ-OS Frontweb');
        return;
      }
      if (categoryRoot === path.join(root, 'proyectos') &&
          !await projectManager.isApprovedForServing(filePath)) {
        sendError(response, 403, '403 Proyecto no aprobado o modificado. Analízalo y acéptalo desde la sección Proyectos.');
        return;
      }

      const extension = path.extname(realPath).toLowerCase();
      const contentType = contentTypes[extension];
      if (!contentType || (allowedRoot === root && extension !== '.slq' && filePath !== path.join(root, 'index.html'))) {
        sendError(response, 404, '404 Not Found - SlQ-OS Frontweb');
        return;
      }

      const headers = {
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': extension === '.html' || extension === '.js' || extension === '.css'
          ? 'no-cache'
          : 'public, max-age=3600'
      };
      if (!isFrontwebFile && segments[0] !== 'proyectos' &&
          (extension === '.html' || extension === '.js' || extension === '.mjs')) {
        headers['Content-Disposition'] = 'attachment';
      }
      if (segments[0] === 'proyectos' && extension === '.html') {
        headers['Content-Security-Policy'] = 'sandbox allow-scripts allow-forms allow-popups';
      }
      if (categoryRoot && extension === '.svg' && segments[0] !== 'proyectos') {
        headers['Content-Disposition'] = 'attachment';
      }
      if (contentType.startsWith('video/') || contentType.startsWith('audio/')) {
        headers['Accept-Ranges'] = 'bytes';
      }

      let start;
      let end;
      let statusCode = 200;
      if (headers['Accept-Ranges'] && request.headers.range) {
        const rangeMatch = request.headers.range.match(/^bytes=(\d*)-(\d*)$/);
        if (!rangeMatch || (!rangeMatch[1] && !rangeMatch[2])) {
          response.status(416).set({ ...headers, 'Content-Range': `bytes */${stats.size}` }).end();
          return;
        }
        if (rangeMatch[1]) {
          start = Number(rangeMatch[1]);
          end = rangeMatch[2] ? Number(rangeMatch[2]) : stats.size - 1;
        } else {
          const suffixLength = Number(rangeMatch[2]);
          start = Math.max(stats.size - suffixLength, 0);
          end = stats.size - 1;
        }
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
            start >= stats.size || start > end) {
          response.status(416).set({ ...headers, 'Content-Range': `bytes */${stats.size}` }).end();
          return;
        }
        end = Math.min(end, stats.size - 1);
        statusCode = 206;
        headers['Content-Range'] = `bytes ${start}-${end}/${stats.size}`;
        headers['Content-Length'] = end - start + 1;
      } else {
        headers['Content-Length'] = stats.size;
      }

      response.status(statusCode).set(headers);
      if (request.method === 'HEAD') {
        response.end();
        return;
      }

      const stream = fs.createReadStream(realPath, start === undefined ? {} : { start, end });
      stream.on('error', (error) => {
        console.error(`Error al servir ${pathname}: ${error.message}`);
        if (!response.headersSent) sendError(response, 500, '500 Internal Server Error');
        else response.destroy(error);
      });
      stream.pipe(response);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
        sendError(response, 404, '404 Not Found - SlQ-OS Frontweb');
        return;
      }
      console.error(`Error al servir ${pathname}: ${error.message}`);
      sendError(response, 500, '500 Internal Server Error');
    }
  });

  return http.createServer(app);
}

module.exports = { createWebServer };
