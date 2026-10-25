const crypto = require('crypto');
const fs = require('fs');

function getWebCredentials(environment = process.env) {
  const username = environment.SLQ_WEB_USER;
  const salt = environment.SLQ_WEB_PASSWORD_SALT;
  const passwordHash = environment.SLQ_WEB_PASSWORD_HASH;

  if (!username || !/^[A-Za-z0-9_.-]{1,64}$/.test(username) ||
      !/^[a-f0-9]{32,128}$/i.test(salt || '') ||
      !/^[a-f0-9]{64}$/i.test(passwordHash || '')) {
    throw new Error('Falta configurar SLQ_WEB_USER, SLQ_WEB_PASSWORD_SALT y SLQ_WEB_PASSWORD_HASH.');
  }

  return {
    username,
    salt: Buffer.from(salt, 'hex'),
    passwordHash: Buffer.from(passwordHash, 'hex')
  };
}

function getWebCredentialsFromFile(filePath = '/etc/slq-os/web-auth.env') {
  const values = {};
  const allowedKeys = new Set([
    'SLQ_WEB_USER',
    'SLQ_WEB_PASSWORD_SALT',
    'SLQ_WEB_PASSWORD_HASH'
  ]);

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line) continue;
    const separator = line.indexOf('=');
    if (separator < 1) {
      throw new Error(`Configuración de autenticación inválida en ${filePath}.`);
    }
    const key = line.slice(0, separator);
    if (!allowedKeys.has(key) || Object.hasOwn(values, key)) {
      throw new Error(`Configuración de autenticación inválida en ${filePath}.`);
    }
    values[key] = line.slice(separator + 1);
  }

  return getWebCredentials(values);
}

function createWebAuthMiddleware(credentials) {
  const failedAttempts = new Map();
  let activeVerifications = 0;

  return (request, response, next) => {
    const client = request.socket.remoteAddress || 'unknown';
    const attemptState = failedAttempts.get(client);
    if (attemptState && attemptState.count >= 8 &&
        Date.now() - attemptState.startedAt < 60_000) {
      response.set('Retry-After', '60');
      response.status(429).type('text/plain').send('Demasiados intentos de autenticación. Intenta en un minuto.');
      return;
    }

    const authorization = request.get('Authorization') || '';
    const match = authorization.match(/^Basic ([A-Za-z0-9+/]+=*)$/);
    if (!match) {
      response.set('WWW-Authenticate', 'Basic realm="SlQ-OS Frontweb", charset="UTF-8"');
      response.status(401).type('text/plain').send('Se requiere iniciar sesión para usar SlQ-OS.');
      return;
    }

    let supplied;
    try {
      supplied = Buffer.from(match[1], 'base64').toString('utf8');
    } catch (_error) {
      supplied = '';
    }
    const separator = supplied.indexOf(':');
    if (separator < 0) {
      response.set('WWW-Authenticate', 'Basic realm="SlQ-OS Frontweb", charset="UTF-8"');
      response.status(401).type('text/plain').send('Credenciales inválidas.');
      return;
    }

    const username = supplied.slice(0, separator);
    const password = supplied.slice(separator + 1);
    if (username.length > 64 || password.length > 1024 || activeVerifications >= 8) {
      response.set('Retry-After', '1');
      response.status(429).type('text/plain').send('Autenticación temporalmente limitada.');
      return;
    }
    activeVerifications += 1;
    crypto.scrypt(password, credentials.salt, credentials.passwordHash.length, (error, derivedHash) => {
      activeVerifications -= 1;
      if (error) {
        next(error);
        return;
      }

      const usernameBytes = Buffer.from(username);
      const expectedUsernameBytes = Buffer.from(credentials.username);
      const usernameMatches = usernameBytes.length === expectedUsernameBytes.length &&
        crypto.timingSafeEqual(usernameBytes, expectedUsernameBytes);
      const passwordMatches = crypto.timingSafeEqual(derivedHash, credentials.passwordHash);
      if (!usernameMatches || !passwordMatches) {
        const current = failedAttempts.get(client);
        if (!current || Date.now() - current.startedAt >= 60_000) {
          failedAttempts.set(client, { count: 1, startedAt: Date.now() });
        } else {
          current.count += 1;
        }
        response.set('WWW-Authenticate', 'Basic realm="SlQ-OS Frontweb", charset="UTF-8"');
        response.status(401).type('text/plain').send('Credenciales inválidas.');
        return;
      }
      failedAttempts.delete(client);
      request.slqUsername = credentials.username;
      next();
    });
  };
}

module.exports = { createWebAuthMiddleware, getWebCredentials, getWebCredentialsFromFile };
