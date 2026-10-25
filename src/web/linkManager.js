const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');

const seedSocialLinks = [
  { name: 'X', url: 'https://x.com/', loginUrl: 'https://x.com/i/flow/login' },
  { name: 'Facebook', url: 'https://www.facebook.com/', loginUrl: 'https://www.facebook.com/login/' },
  { name: 'Instagram', url: 'https://www.instagram.com/', loginUrl: 'https://www.instagram.com/accounts/login/' },
  { name: 'LinkedIn', url: 'https://www.linkedin.com/', loginUrl: 'https://www.linkedin.com/login' },
  { name: 'Blogger', url: 'https://www.blogger.com/', loginUrl: 'https://accounts.google.com/' },
  { name: 'GitHub', url: 'https://github.com/', loginUrl: 'https://github.com/login' },
  { name: 'Binance', url: 'https://www.binance.com/', loginUrl: 'https://accounts.binance.com/en/login' }
];
const seedLinks = {
  'redes-sociales': seedSocialLinks,
  correos: [{
    name: 'Gmail',
    url: 'https://mail.google.com/',
    loginUrl: 'https://accounts.google.com/'
  }],
  'webs-destacadas': [{
    name: 'Free Software Foundation',
    url: 'https://www.fsf.org/'
  }]
};
const defaultsVersion = 1;

const categoryFiles = {
  'redes-sociales': 'redes-sociales.slq.json',
  correos: 'correos.slq.json',
  'webs-destacadas': 'webs-destacadas.slq.json'
};

function linkError(status, message) {
  return Object.assign(new Error(message), { status });
}

function validateName(name) {
  if (typeof name !== 'string' || !name.trim() || name !== name.trim() || name.length > 100) {
    throw linkError(400, 'El nombre debe tener entre 1 y 100 caracteres y no llevar espacios exteriores.');
  }
  return name;
}

function normalizeLink(category, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw linkError(400, 'El objeto del enlace no es válido.');
  }
  const name = validateName(input.name);
  if (typeof input.url !== 'string' || input.url.length > 2048 || input.url !== input.url.trim()) {
    throw linkError(400, 'La dirección del enlace no es válida.');
  }

  let url = input.url;
  if (category === 'correos' && !/^https:\/\//i.test(url)) {
    const address = url.replace(/^mailto:/i, '');
    if (!/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(address) || address.length > 254) {
      throw linkError(400, 'Escribe una dirección HTTPS de correo o una dirección de correo válida.');
    }
    url = `mailto:${address}`;
  } else {
    url = normalizeHttpsUrl(url);
  }

  const normalized = { name, url };
  if (input.loginUrl !== undefined && input.loginUrl !== '') {
    normalized.loginUrl = normalizeHttpsUrl(input.loginUrl);
  }
  if (normalized.loginUrl && url.startsWith('mailto:')) {
    throw linkError(400, 'Un correo personal no admite una dirección de inicio de sesión.');
  }
  return normalized;
}

function normalizeHttpsUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (_error) {
    throw linkError(400, 'Escribe una dirección web completa que comience con https://.');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw linkError(400, 'Solo se admiten enlaces HTTPS sin credenciales incrustadas.');
  }
  return parsed.toString();
}

function createLinkManager(rootDirectory, options = {}) {
  const directory = path.resolve(
    options.linksDirectory || process.env.SLQ_LINKS_DIRECTORY || path.join(rootDirectory, 'data', 'links')
  );
  const router = express.Router();
  const locks = new Map();

  const fileFor = (category) => {
    const filename = categoryFiles[category];
    if (!filename) throw linkError(404, 'Categoría de enlaces no encontrada.');
    return path.join(directory, filename);
  };

  async function readLinksFile(category) {
    const filename = fileFor(category);
    try {
      const stats = await fs.promises.lstat(filename);
      if (!stats.isFile() || stats.isSymbolicLink()) {
        throw linkError(500, 'El archivo de enlaces no es un archivo normal.');
      }
      const data = JSON.parse(await fs.promises.readFile(filename, 'utf8'));
      if (data?.format !== 'slq.links.v1' || data.category !== category || !Array.isArray(data.links)) {
        throw linkError(500, 'El archivo de enlaces tiene un formato inválido.');
      }
      for (const entry of data.links) {
        if (!entry || typeof entry.id !== 'string') {
          throw linkError(500, 'El archivo de enlaces contiene un elemento inválido.');
        }
        const normalized = normalizeLink(category, entry);
        if (normalized.name !== entry.name || normalized.url !== entry.url ||
            normalized.loginUrl !== entry.loginUrl) {
          throw linkError(500, 'El archivo de enlaces contiene un acceso no válido.');
        }
      }
      if ((data.defaultsVersion || 0) < defaultsVersion) {
        const upgraded = data.links.map((entry) => {
          const seed = seedLinks[category].find((link) =>
            link.name === entry.name && link.url === entry.url
          );
          return seed?.loginUrl && !entry.loginUrl ? { ...entry, loginUrl: seed.loginUrl } : entry;
        });
        for (const seed of seedLinks[category]) {
          if (!upgraded.some((entry) => entry.name === seed.name || entry.url === seed.url)) {
            upgraded.push({ id: crypto.randomUUID(), ...seed });
          }
        }
        await writeLinks(category, upgraded);
        return upgraded;
      }
      return data.links;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const initial = seedLinks[category].map((link) => ({ id: crypto.randomUUID(), ...link }));
      await writeLinks(category, initial);
      return initial;
    }
  }

  async function writeLinks(category, links) {
    const filename = fileFor(category);
    await fs.promises.mkdir(directory, { recursive: true, mode: 0o750 });
    const temporary = `${filename}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`;
    try {
      await fs.promises.writeFile(temporary, `${JSON.stringify({
        format: 'slq.links.v1',
        category,
        defaultsVersion,
        links
      }, null, 2)}\n`, {
        encoding: 'utf8',
        mode: 0o600,
        flag: 'wx'
      });
      await fs.promises.rename(temporary, filename);
    } catch (error) {
      await fs.promises.unlink(temporary).catch((cleanupError) => {
        if (cleanupError.code !== 'ENOENT') {
          console.error(`No se pudo limpiar un JSON temporal de enlaces: ${cleanupError.message}`);
        }
      });
      throw error;
    }
  }

  function serialize(category, action) {
    const previous = locks.get(category) || Promise.resolve();
    const current = previous.then(action, action);
    locks.set(category, current.catch(() => {}));
    return current;
  }

  function readLinks(category) {
    fileFor(category);
    return serialize(category, () => readLinksFile(category));
  }

  function updateLinks(category, update) {
    fileFor(category);
    return serialize(category, async () => {
      const links = await readLinksFile(category);
      const result = await update(links);
      await writeLinks(category, result.links);
      return result.value;
    });
  }

  router.get('/api/links/:category', async (request, response) => {
    try {
      const links = await readLinks(request.params.category);
      response.set('Cache-Control', 'no-store').json(links);
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 500;
      if (status >= 500) console.error(`No se pudieron cargar los enlaces: ${error.message}`);
      response.status(status).json({ error: status >= 500 ? 'No se pudieron cargar los enlaces.' : error.message });
    }
  });

  router.post('/api/links/:category', express.json({ limit: '16kb' }), async (request, response) => {
    try {
      const category = request.params.category;
      fileFor(category);
      const link = normalizeLink(category, request.body);
      const created = await updateLinks(category, (links) => {
        const entry = { id: crypto.randomUUID(), ...link };
        return { links: [...links, entry], value: entry };
      });
      response.status(201).json(created);
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 500;
      if (status >= 500) console.error(`No se pudo guardar el enlace: ${error.message}`);
      response.status(status).json({ error: status >= 500 ? 'No se pudo guardar el enlace.' : error.message });
    }
  });

  router.delete('/api/links/:category/:id', async (request, response) => {
    try {
      const category = request.params.category;
      fileFor(category);
      const deleted = await updateLinks(category, (links) => {
        const remaining = links.filter((entry) => entry.id !== request.params.id);
        if (remaining.length === links.length) throw linkError(404, 'No se encontró el enlace solicitado.');
        return { links: remaining, value: true };
      });
      if (!deleted) throw linkError(404, 'No se encontró el enlace solicitado.');
      response.status(204).end();
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 500;
      if (status >= 500) console.error(`No se pudo eliminar el enlace: ${error.message}`);
      response.status(status).json({ error: status >= 500 ? 'No se pudo eliminar el enlace.' : error.message });
    }
  });

  return {
    router,
    async count(category) {
      return (await readLinks(category)).length;
    }
  };
}

module.exports = { createLinkManager, categoryFiles, seedSocialLinks, seedLinks };
