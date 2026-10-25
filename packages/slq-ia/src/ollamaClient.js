const http = require('http');

const REQUEST_TIMEOUT_MS = 120000;

function askOllama(prompt, systemPrompt) {
  return new Promise((resolve, reject) => {
    const model = (process.env.SLQ_AI_LOCAL_MODEL || 'qwen2.5:1.5b').trim();
    const port = Number(process.env.SLQ_OLLAMA_PORT || 11434);
    if (!model) {
      reject(new Error('SLQ_AI_LOCAL_MODEL no puede estar vacío.'));
      return;
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      reject(new Error('SLQ_OLLAMA_PORT debe ser un puerto entre 1 y 65535.'));
      return;
    }

    const postData = JSON.stringify({
      model,
      prompt: prompt,
      system: systemPrompt,
      stream: false,
      format: 'json',
      options: {
        num_ctx: 512,        // Contexto reducido para máxima velocidad en CPU
        num_predict: 128     // Respuestas más cortas y rápidas
      }
    });

    const options = {
      hostname: process.env.SLQ_OLLAMA_HOST || '127.0.0.1',
      port,
      path: '/api/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Ollama respondió con HTTP ${res.statusCode}: ${data.trim()}`));
          return;
        }

        try {
          const parsed = JSON.parse(data);
          if (typeof parsed.response !== 'string' || !parsed.response.trim()) {
            reject(new Error('Ollama devolvió una respuesta sin texto.'));
            return;
          }
          resolve(parsed.response);
        } catch (_error) {
          reject(new Error('Ollama devolvió una respuesta JSON inválida.'));
        }
      });
    });

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error('Tiempo de espera agotado al consultar Ollama.'));
    });
    req.once('error', reject);

    req.write(postData);
    req.end();
  });
}

module.exports = { askOllama };
