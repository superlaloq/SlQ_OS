const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');

const MAX_DESKTOP_FILE_SIZE = 256 * 1024;
const APPLICATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,254}$/;
const ICON_EXTENSIONS = ['.svg', '.png', '.xpm'];
const ICON_SIZES = ['scalable', '512x512', '256x256', '128x128', '96x96','64x64', '48x48', '32x32', '24x24', '22x22', '16x16'];

function isWithinDirectory(directory, candidate) {
  const relative = path.relative(directory, candidate);
  return relative !== '' && relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function desktopDirectories(options = {}) {
  if (options.applicationDirectories) return options.applicationDirectories;
  const dataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  const dataDirectories = (process.env.XDG_DATA_DIRS || '/usr/local/share:/usr/share')
    .split(path.delimiter)
    .filter(Boolean);
  return [
    path.join(dataHome, 'applications'),
    ...dataDirectories.map((directory) => path.join(directory, 'applications'))
  ];
}

function parseDesktopEntry(contents, desktopEnvironment) {
  const values = {};
  let inDesktopEntry = false;
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      inDesktopEntry = trimmed === '[Desktop Entry]';
      continue;
    }
    if (!inDesktopEntry) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    values[trimmed.slice(0, separator)] = trimmed.slice(separator + 1);
  }

  if (values.Type !== 'Application' || values.Hidden === 'true' ||
      values.NoDisplay === 'true' || !values.Exec) return null;

  const onlyShowIn = (values.OnlyShowIn || '').split(';').filter(Boolean);
  const notShowIn = (values.NotShowIn || '').split(';').filter(Boolean);
  const environments = desktopEnvironment.split(':').filter(Boolean);
  if ((onlyShowIn.length && !onlyShowIn.some((item) => environments.includes(item))) ||
      notShowIn.some((item) => environments.includes(item))) return null;

  const localizedNames = [
    process.env.LANG?.split('.')[0],
    process.env.LANGUAGE?.split(':')[0]?.split('.')[0],
    'es'
  ].filter(Boolean);
  const name = localizedNames
    .map((locale) => values[`Name[${locale}]`])
    .find(Boolean) || values.Name;
  if (!name) return null;

  const categories = (values.Categories || '').split(';').filter(Boolean);
  return {
    name,
    icon: values.Icon || '',
    categories,
    tryExec: values.TryExec || ''
  };
}

function applicationCategory(categories) {
  if (categories.some((category) => ['AudioVideo', 'Audio', 'Video', 'Player'].includes(category))) {
    return 'Multimedia';
  }
  if (categories.some((category) => ['Development', 'IDE'].includes(category))) return 'Desarrollo';
  if (categories.some((category) => ['Graphics', 'Photography'].includes(category))) return 'Gráficos';
  if (categories.some((category) => ['Office', 'WordProcessor', 'Spreadsheet', 'Presentation'].includes(category))) {
    return 'Oficina';
  }
  if (categories.some((category) => ['Education', 'Science'].includes(category))) return 'Educación';
  if (categories.some((category) => ['Network', 'WebBrowser', 'Email'].includes(category))) return 'Internet';
  if (categories.some((category) => ['Settings', 'System', 'Utility'].includes(category))) return 'Sistema';
  if (categories.includes('Game')) return 'Juegos';
  return 'Aplicaciones';
}

function tryExecutableExists(command) {
  if (!command) return true;
  if (command.includes('/') || path.isAbsolute(command)) {
    try {
      fs.accessSync(command, fs.constants.X_OK);
      return true;
    } catch (_error) {
      return false;
    }
  }
  return (process.env.PATH || '').split(path.delimiter)
    .some((directory) => {
      try {
        fs.accessSync(path.join(directory, command), fs.constants.X_OK);
        return true;
      } catch (_error) {
        return false;
      }
    });
}

async function readDesktopFiles(directory, relativeDirectory = '', depth = 0) {
  let entries;
  try {
    entries = await fs.promises.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
    const relativePath = path.join(relativeDirectory, entry.name);
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory() && depth < 5) {
      files.push(...await readDesktopFiles(absolutePath, relativePath, depth + 1));
    } else if (entry.isFile() && entry.name.endsWith('.desktop')) {
      files.push({ absolutePath, relativePath });
    }
  }
  return files;
}

function createApplicationManager(options = {}) {
  const directories = desktopDirectories(options).map((directory) => path.resolve(directory));
  const desktopEnvironment = options.desktopEnvironment || process.env.XDG_CURRENT_DESKTOP || 'XFCE';
  const launcher = options.launcher || ((desktopFile) => new Promise((resolve, reject) => {
    execFile('gio', ['launch', desktopFile], { timeout: 10_000 }, (error)=> {
      if (!error) {
        resolve();
        return;
      }
      execFile('xdg-open', [desktopFile], { timeout: 10_000 }, (fallbackError) => {
        if (fallbackError) reject(fallbackError);
        else resolve();
      });
    });
  }));
  let cachedApplications = null;
  let cacheExpiresAt = 0;
  let discoveryPromise = null;

  async function discoverApplications() {
    const applicationsMap = new Map();
    for (const directory of directories) {
      const files = await readDesktopFiles(directory);
      for (const file of files) {
        const id = file.relativePath.split(path.sep).join('-');
        if (!APPLICATION_ID_PATTERN.test(id) || applicationsMap.has(id)) continue;

        const stats = await fs.promises.stat(file.absolutePath);
        if (stats.size > MAX_DESKTOP_FILE_SIZE) continue;
        const entry = parseDesktopEntry(
          await fs.promises.readFile(file.absolutePath, 'utf8'),
          desktopEnvironment
        );
        if (!entry || !tryExecutableExists(entry.tryExec)) continue;
        
        applicationsMap.set(id, {
          id,
          name: entry.name,
          category: applicationCategory(entry.categories),
          icon: entry.icon,
          desktopFile: file.absolutePath
        });
      }
    }
    return Array.from(applicationsMap.values()).sort((left, right) =>
      left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }));
  }

  async function getApplicationEntries() {
    if (cachedApplications && Date.now() < cacheExpiresAt) return cachedApplications;
    if (discoveryPromise) return discoveryPromise;
    discoveryPromise = discoverApplications().then((applications) => {
      cachedApplications = applications;
      cacheExpiresAt = Date.now() + 5_000;
      return applications;
    }).finally(() => {
      discoveryPromise = null;
    });
    return discoveryPromise;
  }

  async function getApplications() {
    return (await getApplicationEntries()).map((application) => ({
      id: application.id,
      name: application.name,
      category: application.category,
      iconUrl: application.icon
        ? `/api/apps/${encodeURIComponent(application.id)}/icon`
        : null
    }));
  }

  async function findApplication(id) {
    if (typeof id !== 'string' || !APPLICATION_ID_PATTERN.test(id)) return null;
    return (await getApplicationEntries()).find((entry) => entry.id === id) || null;
  }

  const router = express.Router();
  router.get('/api/apps', async (_request, response) => {
    try {
      response
        .set('Cache-Control', 'no-store')
        .json(await getApplications());
    } catch (error) {
      console.error(`No se pudo leer el catálogo de aplicaciones: ${error.message}`);
      response.status(500).json({ error: 'No se pudo leer el catálogo de aplicaciones.' });
    }
  });

  router.post('/api/apps/:id/launch', async (request, response) => {
    let application;
    try {
      application = await findApplication(request.params.id);
      if (!application) {
        response.status(404).json({ error: 'La aplicación no está instalada o no se puede abrir.' });
        return;
      }
      await launcher(application.desktopFile);
      response.status(202).json({ launched: true, name: application.name });
    } catch (error) {
      console.error(`No se pudo abrir una aplicación de escritorio: ${error.message}`);
      response.status(error.code === 'ENOENT' ? 503 : 500).json({
        error: error.code === 'ENOENT'
          ? 'No se encontró gio para abrir aplicaciones del escritorio.'
          : 'No se pudo abrir la aplicación solicitada.'
      });
    }
  });

  router.get('/api/apps/:id/icon', async (request, response) => {
    try {
      const application = await findApplication(request.params.id);
      if (!application) {
        response.status(404).end();
        return;
      }
      const iconPath = await findIconPath(application.icon || '');
      if (!iconPath) {
        response.status(404).end();
        return;
      }
      const extension = path.extname(iconPath).toLowerCase();
      const contentType = extension === '.svg' ? 'image/svg+xml' :
        extension === '.png' ? 'image/png' : 'image/x-xpixmap';
      response
        .set('Content-Type', contentType)
        .set('X-Content-Type-Options', 'nosniff')
        .set('Cache-Control', 'public, max-age=3600')
        .sendFile(iconPath);
    } catch (error) {
      console.error(`No se pudo leer el icono de la aplicación: ${error.message}`);
      response.status(500).end();
    }
  });

  async function findIconPath(icon) {
    if (!icon) return null;
    const iconDirectories = directories.map((directory) => path.resolve(directory, '..', 'icons'));
    iconDirectories.push(...directories.map((directory) => path.resolve(directory, '..', 'pixmaps')));
    const candidates = [];
    if (path.isAbsolute(icon)) candidates.push(icon);
    else {
      if (path.basename(icon) !== icon || icon.includes('..')) return null;
      const extension = path.extname(icon);
      const name = extension ? icon.slice(0, -extension.length) : icon;
      const extensions = extension ? [extension.toLowerCase()] : ICON_EXTENSIONS;
      for (const iconDirectory of iconDirectories) {
        if (extension) {
          candidates.push(path.join(iconDirectory, icon));
          continue;
        }
        for (const theme of ['hicolor', 'Adwaita', 'breeze', 'gnome']) {
          for (const size of ICON_SIZES) {
            const scale = size === 'scalable' ? 'apps' : `${size}/apps`;
            for (const candidateExtension of extensions) {
              candidates.push(path.join(iconDirectory, theme, scale, `${name}${candidateExtension}`));
            }
          }
        }
        for (const candidateExtension of extensions) {
          candidates.push(path.join(iconDirectory, `${name}${candidateExtension}`));
        }
      }
    }

    for (const candidate of candidates) {
      try {
        const realPath = await fs.promises.realpath(candidate);
        if (!ICON_EXTENSIONS.includes(path.extname(realPath).toLowerCase()) ||
            !iconDirectories.some((directory) =>
              realPath === directory || isWithinDirectory(directory, realPath))) continue;
        const stats = await fs.promises.stat(realPath);
        if (stats.isFile() && stats.size <= 2 * 1024 * 1024) return realPath;
      } catch (error) {
        if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
      }
    }
    return null;
  }

  return { router, getApplications, findApplication };
}

module.exports = { createApplicationManager };
