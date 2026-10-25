const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const { askOllama, askOnlineAI, isOnlineAIConfigured } = require('@slq/ia');

test('Ollama uses the configured local model and surfaces server errors', async (t) => {
  const previous = {
    host: process.env.SLQ_OLLAMA_HOST,
    port: process.env.SLQ_OLLAMA_PORT,
    model: process.env.SLQ_AI_LOCAL_MODEL
  };
  const server = http.createServer((request, response) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      const payload = JSON.parse(body);
      if (payload.model !== 'qwen2.5:1.5b') {
        response.writeHead(400);
        response.end('unknown model');
        return;
      }
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ response: 'IA OK' }));
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    for (const [key, value] of Object.entries({
      SLQ_OLLAMA_HOST: previous.host,
      SLQ_OLLAMA_PORT: previous.port,
      SLQ_AI_LOCAL_MODEL: previous.model
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  process.env.SLQ_OLLAMA_HOST = '127.0.0.1';
  process.env.SLQ_OLLAMA_PORT = String(server.address().port);
  process.env.SLQ_AI_LOCAL_MODEL = 'qwen2.5:1.5b';

  assert.equal(await askOllama('hola'), 'IA OK');
  process.env.SLQ_AI_LOCAL_MODEL = 'missing-model';
  await assert.rejects(askOllama('hola'), /Ollama respondió con HTTP 400: unknown model/);
});

test('SlQ_IA exports both providers and rejects remote cleartext endpoints', async () => {
  const previous = {
    baseUrl: process.env.SLQ_AI_BASE_URL,
    model: process.env.SLQ_AI_MODEL,
    apiKey: process.env.SLQ_AI_API_KEY
  };

  try {
    delete process.env.SLQ_AI_BASE_URL;
    delete process.env.SLQ_AI_MODEL;
    delete process.env.SLQ_AI_API_KEY;

    assert.equal(typeof askOllama, 'function');
    assert.equal(typeof askOnlineAI, 'function');
    assert.equal(isOnlineAIConfigured(), false);
    await assert.rejects(askOnlineAI('hola'), /Configura SLQ_AI_BASE_URL y SLQ_AI_MODEL/);

    process.env.SLQ_AI_BASE_URL = 'http://example.com/v1';
    process.env.SLQ_AI_MODEL = 'test-model';
    assert.equal(isOnlineAIConfigured(), true);
    await assert.rejects(askOnlineAI('hola'), /requiere HTTPS/);
  } finally {
    for (const [key, value] of Object.entries({
      SLQ_AI_BASE_URL: previous.baseUrl,
      SLQ_AI_MODEL: previous.model,
      SLQ_AI_API_KEY: previous.apiKey
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
