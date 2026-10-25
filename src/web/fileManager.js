const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');
const multer = require('multer');
const express = require('express');
const { runSlQScript } = require('../scriptRunner');

const categories = new Set(['imagenes', 'videos', 'documentos', 'proyectos']);
const MAX_FOLDER_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_FOLDER_UPLOAD_FILES = 500;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 10, fields: 4 },
  fileFilter(_request, file, callback) {
    if (file.originalname.includes('/') || file.originalname.includes('\\') ||
        file.originalname.includes('\0') || file.originalname.startsWith('.')) {
      callback(Object.assign(new Error('Nombre de archivo no permitido.'), { status: 400 }));
      return;
    }
    callback(null, true);
  }
});

const folderStorage = {
  _handleFile(request, file, callback) {
    const temporaryPath = path.join(request.slqUploadDirectory, crypto.randomUUID());
    let fileBytes = 0;
    const limitTotal = new Transform({
      transform(chunk, _encoding, done) {
        fileBytes += chunk.length;
        request.slqUploadBytes += chunk.length;
        if (request.slqUploadBytes > MAX_FOLDER_UPLOAD_BYTES) {
          done(Object.assign(new Error('La carpeta supera el límite total de 50 MB.'), { code: 'SLQ_TOTAL_LIMIT' }));
          return;
        }
        done(null, chunk);
      }
    });
    const output = fs.createWriteStream(temporaryPath, { flags: 'wx', mode: 0o600 });
    pipeline(file.stream, limitTotal, output)
      .then(() => callback(null, { path: temporaryPath, size: fileBytes }))
      .catch(async (error) => {
        await fs.promises.unlink(temporaryPath).catch((cleanupError) => {
          if (cleanupError.code !== 'ENOENT') {
            console.error(`No se pudo limpiar una carga temporal: ${cleanupError.message}`);
          }
        });
        callback(error);
      });
  },
  _removeFile(_request, file, callback) {
    fs.unlink(file.path, callback);
  }
};

const folderUpload = multer({
  preservePath: true,
  storage: folderStorage,
  limits: { fileSize: MAX_FOLDER_UPLOAD_BYTES, files: MAX_FOLDER_UPLOAD_FILES, fields: 1, fieldSize: 4096 },
  fileFilter(_request, file, callback) {
    try {
      if (typeof file.originalname !== 'string' || file.originalname.includes('\0') ||
          file.originalname.includes('\\') || file.originalname.startsWith('/')) {
        throw Object.assign(new Error('La ruta de archivo seleccionada no es válida.'), { status: 400 });
      }
      const rawSegments = file.originalname.split('/');
      if (rawSegments.some((segment) => !segment || segment === '.' || segment === '..')) {
        throw Object.assign(new Error('La ruta de archivo seleccionada no es válida.'), { status: 400 });
      }
      if (rawSegments.some((segment) =>
        segment.startsWith('.') || segment === 'node_modules'
      )) {
        _request.slqSkippedFiles += 1;
        callback(null, false);
        return;
      }
      const segments = validateRelativePath(file.originalname, false);
      if (segments.length < 2) throw Object.assign(new Error('Selecciona una carpeta con archivos.'), { status: 400 });
      segments.forEach(validateName);
      callback(null, true);
    } catch (error) {
      callback(error);
    }
  }
});

function prepareFolderUpload(request, _response, next) {
  request.slqUploadBytes = 0;
  request.slqSkippedFiles = 0;
  fs.promises.mkdtemp(path.join(os.tmpdir(), 'slq-project-upload-'))
    .then((directory) => {
      request.slqUploadDirectory = directory;
      next();
    })
    .catch(next);
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative));
}

function validateCategory(category) {
  if (!categories.has(category)) {
    const error = new Error('Categoría no permitida.');
    error.status = 400;
    throw error;
  }
}

function validateRelativePath(relativePath, allowEmpty = true) {
  if (typeof relativePath !== 'string' || (!allowEmpty && relativePath.length === 0) ||
      relativePath.includes('\0') || relativePath.includes('\\') || relativePath.startsWith('/')) {
    const error = new Error('Ruta no válida.');
    error.status = 400;
    throw error;
  }
  if (relativePath === '' && allowEmpty) return [];
  const segments = relativePath.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.startsWith('.'))) {
    const error = new Error('Ruta no válida.');
    error.status = 400;
    throw error;
  }
  return segments;
}

function validateName(name) {
  if (typeof name !== 'string' || !name.trim() || name !== name.trim() ||
      name === '.' || name === '..' || name.startsWith('.') ||
      /[\/\\\0]/.test(name) || name.length > 255) {
    const error = new Error('Nombre de archivo no válido.');
    error.status = 400;
    throw error;
  }
  return name;
}

async function resolveManagedPath(root, category, relativePath, options = {}) {
  validateCategory(category);
  const segments = validateRelativePath(relativePath, options.allowEmpty !== false);
  const categoryRoot = path.join(root, category);
  const categoryStat = await fs.promises.lstat(categoryRoot);
  if (!categoryStat.isDirectory() || categoryStat.isSymbolicLink()) {
    throw Object.assign(new Error(`La carpeta ${category} no está disponible.`), { status: 500 });
  }

  let candidate = categoryRoot;
  for (const segment of segments) {
    candidate = path.join(candidate, segment);
    if (!isInside(categoryRoot, candidate)) {
      throw Object.assign(new Error('Ruta fuera de la carpeta permitida.'), { status: 400 });
    }
    try {
      const stats = await fs.promises.lstat(candidate);
      if (stats.isSymbolicLink()) {
        throw Object.assign(new Error('No se permiten enlaces simbólicos.'), { status: 400 });
      }
      if (segment !== segments[segments.length - 1] && !stats.isDirectory()) {
        throw Object.assign(new Error('Un componente de la ruta no es una carpeta.'), { status: 400 });
      }
    } catch (error) {
      if (error.code === 'ENOENT' && options.allowMissingLeaf &&
          segment === segments[segments.length - 1]) break;
      throw error;
    }
  }

  return { categoryRoot, filePath: candidate, relativePath: segments.join('/') };
}

function sendError(response, error) {
  const status = Number.isInteger(error.status)
    ? error.status
    : error.code === 'EEXIST' || error.code === 'ENOTEMPTY' ? 409 : 500;
  if (status === 409) {
    response.status(status).json({ error: error.code === 'EEXIST'
      ? 'Ya existe un elemento con ese nombre.'
      : 'La carpeta no está vacía.' });
    return;
  }
  if (status >= 500) console.error(`Error en gestor de archivos: ${error.message}`);
  response.status(status).json({ error: status >= 500 ? 'Error interno del gestor de archivos.' : error.message });
}

async function listDirectory(root, category, relativePath) {
  const resolved = await resolveManagedPath(root, category, relativePath);
  const stats = await fs.promises.lstat(resolved.filePath);
  if (!stats.isDirectory()) {
    throw Object.assign(new Error('La ruta no es una carpeta.'), { status: 400 });
  }
  const entries = await fs.promises.readdir(resolved.filePath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
    const filePath = path.join(resolved.filePath, entry.name);
    const entryStats = await fs.promises.lstat(filePath);
    if (entryStats.isSymbolicLink()) continue;
    files.push({
      name: entry.name,
      kind: entryStats.isDirectory() ? 'directory' : 'file',
      size: entryStats.isFile() ? entryStats.size : 0,
      modifiedAt: entryStats.mtime.toISOString()
    });
  }
  files.sort((left, right) =>
    Number(right.kind === 'directory') - Number(left.kind === 'directory') ||
    left.name.localeCompare(right.name)
  );
  return {
    category,
    path: resolved.relativePath,
    parent: resolved.relativePath ? path.posix.dirname(resolved.relativePath) === '.'
      ? '' : path.posix.dirname(resolved.relativePath) : null,
    entries: files
  };
}

function createFileManagerRouter(rootDirectory) {
  const root = path.resolve(rootDirectory);
  const router = express.Router();

  router.get('/api/manage/files', async (request, response) => {
    try {
      const listing = await listDirectory(root, request.query.category, request.query.path || '');
      response.set('Cache-Control', 'no-store').json(listing);
    } catch (error) {
      sendError(response, error);
    }
  });

  router.get('/api/manage/markdown', async (request, response) => {
    try {
      if (request.query.category !== 'documentos') {
        throw Object.assign(new Error('Solo se pueden leer documentos Markdown.'), { status: 400 });
      }
      const resolved = await resolveManagedPath(root, 'documentos', request.query.path, { allowEmpty: false });
      if (path.extname(resolved.filePath).toLowerCase() !== '.md') {
        throw Object.assign(new Error('El archivo solicitado no es Markdown.'), { status: 400 });
      }
      const stats = await fs.promises.lstat(resolved.filePath);
      if (!stats.isFile()) {
        throw Object.assign(new Error('El documento no existe.'), { status: 404 });
      }
      if (stats.size > 1024 * 1024) {
        throw Object.assign(new Error('El documento supera el límite de lectura de 1 MB.'), { status: 413 });
      }
      const content = await fs.promises.readFile(resolved.filePath, 'utf8');
      response.set('Cache-Control', 'no-store').json({ name: path.posix.basename(resolved.relativePath), content });
    } catch (error) {
      sendError(response, error);
    }
  });

  router.get('/api/manage/open', async (request, response) => {
    try {
      const resolved = await resolveManagedPath(root, request.query.category, request.query.path, { allowEmpty: false });
      const stats = await fs.promises.lstat(resolved.filePath);
      if (!stats.isFile()) throw Object.assign(new Error('Solo se pueden abrir archivos.'), { status: 400 });
      response.redirect(`/${encodeURIComponent(resolved.category)}/${resolved.relativePath.split('/').map(encodeURIComponent).join('/')}`);
    } catch (error) {
      sendError(response, error);
    }
  });

  router.post('/api/manage/upload', upload.array('files', 10), async (request, response) => {
    try {
      const category = request.body.category;
      const directory = await resolveManagedPath(root, category, request.body.path || '');
      const stats = await fs.promises.lstat(directory.filePath);
      if (!stats.isDirectory()) throw Object.assign(new Error('El destino no es una carpeta.'), { status: 400 });
      if (!request.files || request.files.length === 0) {
        throw Object.assign(new Error('Selecciona al menos un archivo.'), { status: 400 });
      }

      const created = [];
      for (const file of request.files) {
        const name = validateName(file.originalname);
        const destination = path.join(directory.filePath, name);
        const handle = await fs.promises.open(destination, 'wx', 0o640);
        try {
          await handle.writeFile(file.buffer);
          created.push(name);
        } catch (error) {
          await fs.promises.unlink(destination).catch((cleanupError) => {
            console.error(`No se pudo limpiar la carga parcial: ${cleanupError.message}`);
          });
          throw error;
        } finally {
          await handle.close();
        }
      }
      response.status(201).json({ created });
    } catch (error) {
      sendError(response, error);
    }
  });

  router.post('/api/projects/upload-folder', prepareFolderUpload, folderUpload.array('files', MAX_FOLDER_UPLOAD_FILES), async (request, response) => {
    const createdFiles = [];
    const createdDirectories = [];
    try {
      const destination = await resolveManagedPath(
        root, 'proyectos', request.body.destination || ''
      );
      const destinationStats = await fs.promises.lstat(destination.filePath);
      if (!destinationStats.isDirectory()) {
        throw Object.assign(new Error('El destino seleccionado no es una carpeta.'), { status: 400 });
      }
      if (!request.files || request.files.length === 0) {
        throw Object.assign(new Error('La carpeta seleccionada no contiene archivos.'), { status: 400 });
      }

      const normalizedFiles = request.files.map((file) => {
        const segments = validateRelativePath(file.originalname, false);
        if (segments.length < 2) {
          throw Object.assign(new Error('La selección debe incluir la carpeta y sus archivos.'), { status: 400 });
        }
        segments.forEach(validateName);
        return { file, segments, relativePath: segments.join('/') };
      });
      const topFolders = new Set(normalizedFiles.map(({ segments }) => segments[0]));
      if (topFolders.size !== 1) {
        throw Object.assign(new Error('Selecciona una sola carpeta cada vez.'), { status: 400 });
      }

      const nodeKinds = new Map();
      for (const { segments } of normalizedFiles) {
        for (let index = 1; index < segments.length; index += 1) {
          const directoryName = segments.slice(0, index).join('/');
          if (nodeKinds.get(directoryName) === 'file') {
            throw Object.assign(new Error('La carpeta seleccionada contiene rutas incompatibles.'), { status: 400 });
          }
          nodeKinds.set(directoryName, 'directory');
        }
        if (nodeKinds.has(segments.join('/'))) {
          throw Object.assign(new Error('La carpeta contiene un archivo y una carpeta con el mismo nombre.'), { status: 400 });
        }
        nodeKinds.set(segments.join('/'), 'file');
      }

      normalizedFiles.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
      const firstSegment = [...topFolders][0];
      const topFolderPath = path.join(destination.filePath, firstSegment);
      try {
        await fs.promises.lstat(topFolderPath);
        throw Object.assign(new Error(`Ya existe la carpeta "${firstSegment}" en el destino.`), { status: 409 });
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }

      for (const { segments } of normalizedFiles) {
        let parentPath = destination.filePath;
        for (const segment of segments.slice(0, -1)) {
          parentPath = path.join(parentPath, segment);
          try {
            const stats = await fs.promises.lstat(parentPath);
            if (stats.isSymbolicLink() || !stats.isDirectory()) {
              throw Object.assign(new Error('La ruta de destino contiene un elemento incompatible.'), { status: 409 });
            }
          } catch (error) {
            if (error.code !== 'ENOENT') throw error;
            await fs.promises.mkdir(parentPath, { mode: 0o750 });
            createdDirectories.push(parentPath);
          }
        }
      }

      for (const { file, segments } of normalizedFiles) {
        const target = path.join(destination.filePath, ...segments);
        await fs.promises.copyFile(file.path, target, fs.constants.COPYFILE_EXCL);
        createdFiles.push(target);
        await fs.promises.chmod(target, 0o640);
      }

      response.status(201).json({
        folder: firstSegment,
        destination: destination.relativePath,
        fileCount: normalizedFiles.length,
        totalBytes: request.slqUploadBytes,
        skippedFiles: request.slqSkippedFiles
      });
    } catch (error) {
      for (const filePath of createdFiles.reverse()) {
        await fs.promises.unlink(filePath).catch((cleanupError) => {
          if (cleanupError.code !== 'ENOENT') {
            console.error(`No se pudo revertir un archivo de carpeta importada: ${cleanupError.message}`);
          }
        });
      }
      for (const directoryPath of createdDirectories.reverse()) {
        await fs.promises.rmdir(directoryPath).catch((cleanupError) => {
          if (cleanupError.code !== 'ENOENT' && cleanupError.code !== 'ENOTEMPTY') {
            console.error(`No se pudo revertir una carpeta importada: ${cleanupError.message}`);
          }
        });
      }
      sendError(response, error);
    } finally {
      await fs.promises.rm(request.slqUploadDirectory, { recursive: true, force: true });
    }
  });

  router.post('/api/manage/folders', express.json({ limit: '16kb' }), async (request, response) => {
    try {
      const name = validateName(request.body.name);
      const directory = await resolveManagedPath(root, request.body.category, request.body.path || '');
      const parentStats = await fs.promises.lstat(directory.filePath);
      if (!parentStats.isDirectory()) throw Object.assign(new Error('El destino no es una carpeta.'), { status: 400 });
      await fs.promises.mkdir(path.join(directory.filePath, name), { mode: 0o750 });
      response.status(201).json({ created: name });
    } catch (error) {
      sendError(response, error);
    }
  });

  router.post('/api/manage/copy', express.json({ limit: '16kb' }), async (request, response) => {
    try {
      const source = await resolveManagedPath(root, request.body.category, request.body.path, { allowEmpty: false });
      const stats = await fs.promises.lstat(source.filePath);
      if (!stats.isFile()) throw Object.assign(new Error('Solo se pueden copiar archivos.'), { status: 400 });
      const destinationCategory = request.body.destinationCategory || request.body.category;
      const destination = await resolveManagedPath(root, destinationCategory, request.body.destinationPath || '');
      const destinationStats = await fs.promises.lstat(destination.filePath);
      if (!destinationStats.isDirectory()) throw Object.assign(new Error('El destino no es una carpeta.'), { status: 400 });
      const name = validateName(request.body.name || path.basename(source.filePath));
      await fs.promises.copyFile(source.filePath, path.join(destination.filePath, name), fs.constants.COPYFILE_EXCL);
      response.status(201).json({ copied: name });
    } catch (error) {
      sendError(response, error);
    }
  });

  router.post('/api/manage/move', express.json({ limit: '16kb' }), async (request, response) => {
    try {
      const source = await resolveManagedPath(root, request.body.category, request.body.path, { allowEmpty: false });
      const stats = await fs.promises.lstat(source.filePath);
      if (!stats.isFile()) throw Object.assign(new Error('Solo se pueden mover archivos.'), { status: 400 });
      const destinationCategory = request.body.destinationCategory || request.body.category;
      const destination = await resolveManagedPath(root, destinationCategory, request.body.destinationPath || '');
      const destinationStats = await fs.promises.lstat(destination.filePath);
      if (!destinationStats.isDirectory()) throw Object.assign(new Error('El destino no es una carpeta.'), { status: 400 });
      const name = validateName(request.body.name || path.basename(source.filePath));
      const destinationPath = path.join(destination.filePath, name);
      await fs.promises.copyFile(source.filePath, destinationPath, fs.constants.COPYFILE_EXCL);
      try {
        await fs.promises.unlink(source.filePath);
      } catch (error) {
        await fs.promises.unlink(destinationPath).catch((cleanupError) => {
          console.error(`No se pudo limpiar la copia tras fallar el movimiento: ${cleanupError.message}`);
        });
        throw error;
      }
      response.json({ moved: name });
    } catch (error) {
      sendError(response, error);
    }
  });

  router.post('/api/manage/rename', express.json({ limit: '16kb' }), async (request, response) => {
    try {
      const source = await resolveManagedPath(root, request.body.category, request.body.path, { allowEmpty: false });
      const name = validateName(request.body.name);
      const destination = path.join(path.dirname(source.filePath), name);
      const parent = await resolveManagedPath(root, request.body.category, path.posix.dirname(source.relativePath) === '.'
        ? '' : path.posix.dirname(source.relativePath));
      if (!isInside(parent.categoryRoot, destination) ||
          path.relative(parent.filePath, destination).includes(path.sep)) {
        throw Object.assign(new Error('Renombrado fuera de la carpeta actual no permitido.'), { status: 400 });
      }
      const sourceStats = await fs.promises.lstat(source.filePath);
      if (!sourceStats.isFile()) {
        throw Object.assign(new Error('Solo se pueden renombrar archivos.'), { status: 400 });
      }
      await fs.promises.link(source.filePath, destination);
      try {
        await fs.promises.unlink(source.filePath);
      } catch (error) {
        await fs.promises.unlink(destination).catch((cleanupError) => {
          console.error(`No se pudo limpiar el enlace tras fallar el renombrado: ${cleanupError.message}`);
        });
        throw error;
      }
      response.json({ renamed: name });
    } catch (error) {
      sendError(response, error);
    }
  });

  router.delete('/api/manage/files', express.json({ limit: '16kb' }), async (request, response) => {
    try {
      const target = await resolveManagedPath(root, request.body.category, request.body.path, { allowEmpty: false });
      const stats = await fs.promises.lstat(target.filePath);
      if (stats.isDirectory()) {
        await fs.promises.rmdir(target.filePath);
      } else if (stats.isFile()) {
        await fs.promises.unlink(target.filePath);
      } else {
        throw Object.assign(new Error('Tipo de archivo no permitido.'), { status: 400 });
      }
      response.status(204).end();
    } catch (error) {
      sendError(response, error);
    }
  });

  router.get('/api/manage/scripts', async (_request, response) => {
    try {
      const entries = await fs.promises.readdir(root, { withFileTypes: true });
      const scripts = await Promise.all(entries
        .filter((entry) => entry.isFile() && !entry.name.startsWith('.') && entry.name.toLowerCase().endsWith('.slq'))
        .map(async (entry) => {
          const stats = await fs.promises.lstat(path.join(root, entry.name));
          if (stats.isSymbolicLink()) return null;
          return { name: entry.name, size: stats.size, modifiedAt: stats.mtime.toISOString() };
        }));
      response.set('Cache-Control', 'no-store').json(scripts.filter(Boolean));
    } catch (error) {
      sendError(response, error);
    }
  });

  router.post('/api/manage/run-script', express.json({ limit: '16kb' }), async (request, response) => {
    try {
      const name = validateName(request.body.name);
      if (!name.toLowerCase().endsWith('.slq')) {
        throw Object.assign(new Error('Solo se pueden ejecutar scripts .slq.'), { status: 400 });
      }
      const scriptPath = path.join(root, name);
      const stats = await fs.promises.lstat(scriptPath);
      if (stats.isSymbolicLink() || !stats.isFile()) {
        throw Object.assign(new Error('El script no existe.'), { status: 404 });
      }
      const result = await runSlQScript(name, root);
      response.json(result);
    } catch (error) {
      sendError(response, error);
    }
  });

  router.use(async (error, request, response, _next) => {
    if (request.slqUploadDirectory) {
      await fs.promises.rm(request.slqUploadDirectory, { recursive: true, force: true }).catch((cleanupError) => {
        console.error(`No se pudo limpiar la carpeta temporal de importación: ${cleanupError.message}`);
      });
    }
    if (error.code === 'SLQ_TOTAL_LIMIT') {
      response.status(413).json({ error: error.message });
      return;
    }
    if (error instanceof multer.MulterError) {
      const status = error.code === 'LIMIT_FILE_SIZE' || error.code === 'LIMIT_FILE_COUNT' ? 413 : 400;
      response.status(status).json({ error: error.code === 'LIMIT_FILE_SIZE'
        ? 'La carpeta supera el límite total de 50 MB.'
        : error.code === 'LIMIT_FILE_COUNT'
          ? `La carpeta supera el límite de ${MAX_FOLDER_UPLOAD_FILES} archivos.`
        : 'Carga de archivos no válida.' });
      return;
    }
    sendError(response, error);
  });

  return router;
}

module.exports = { createFileManagerRouter, resolveManagedPath };
