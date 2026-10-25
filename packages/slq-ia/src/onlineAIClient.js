const http = require('http');
const https = require('https');

const MAX_RESPONSE_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 20000;

function getConfig() {
  return {
    baseUrl: (process.env.SLQ_AI_BASE_URL || '').trim(),
    model: (process.env.SLQ_AI_MODEL || '').trim(),
    apiKey: (process.env.SLQ_AI_API_KEY || '').trim()
  };
}

function isOnlineAIConfigured() {
  const { baseUrl, model } = getConfig();
  return Boolean(baseUrl && model);
}

function getEndpoint(baseUrl) {
  let endpoint;
  try {
    endpoint = new URL(`${baseUrl.replace(/\/+$/, '')}/chat/completions`);
  } catch (_error) {
    throw new Error('SLQ_AI_BASE_URL no es una URL válida.');
  }

  if (!['http:', 'https:'].includes(endpoint.protocol) ||
      endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error('SLQ_AI_BASE_URL debe ser una URL HTTP(S) sin credenciales, query ni fragmento.');
  }

  const isLoopback = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(endpoint.hostname);
  if (endpoint.protocol === 'http:' && !isLoopback) {
    throw new Error('La IA online requiere HTTPS; HTTP solo está permitido para servicios en localhost.');
  }

  return endpoint;
}

function extractResponseText(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .filter((part) => part && part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('')
      .trim();
  }
  return '';
}

function askOnlineAI(prompt, systemPrompt) {
  const { baseUrl, model, apiKey } = getConfig();
  if (!baseUrl || !model) {
    return Promise.reject(new Error('Configura SLQ_AI_BASE_URL y SLQ_AI_MODEL para habilitar la IA online.'));
  }
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return Promise.reject(new Error('La consulta para la IA online no puede estar vacía.'));
  }

  let endpoint;
  try {
    endpoint = getEndpoint(baseUrl);
  } catch (error) {
    return Promise.reject(error);
  }

  const transport = endpoint.protocol === 'https:' ? https : http;
  const body = JSON.stringify({
    model,
    messages: [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      { role: 'user', content: prompt }
    ],
    stream: false
  });
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  return new Promise((resolve, reject) => {
    const request = transport.request(endpoint, { method: 'POST', headers }, (response) => {
      let responseBody = '';
      let responseBytes = 0;

      response.on('data', (chunk) => {
        responseBytes += chunk.length;
        if (responseBytes > MAX_RESPONSE_BYTES) {
          request.destroy(new Error('La respuesta de la IA online supera el límite permitido.'));
          return;
        }
        responseBody += chunk;
      });

      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`La IA online respondió con HTTP ${response.statusCode}.`));
          return;
        }

        let payload;
        try {
          payload = JSON.parse(responseBody);
        } catch (_error) {
          reject(new Error('La IA online devolvió una respuesta JSON inválida.'));
          return;
        }

        const answer = extractResponseText(payload);
        if (!answer) {
          reject(new Error('La respuesta de la IA online no contiene texto utilizable.'));
          return;
        }
        resolve(answer);
      });
    });

    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error('Tiempo de espera agotado al consultar la IA online.'));
    });
    request.once('error', reject);
    request.end(body);
  });
}

module.exports = { askOnlineAI, isOnlineAIConfigured };
