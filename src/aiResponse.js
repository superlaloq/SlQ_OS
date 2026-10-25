function extractJsonObject(response) {
  if (typeof response !== 'string' || !response.trim()) {
    throw new Error('La IA devolvió una respuesta vacía.');
  }

  const start = response.indexOf('{');
  if (start === -1) {
    throw new Error('La IA no devolvió el objeto JSON esperado.');
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < response.length; index += 1) {
    const character = response[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }

    if (character === '"') inString = true;
    else if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return response.slice(start, index + 1);
    }
  }

  throw new Error('La IA devolvió un objeto JSON incompleto.');
}

function parseAIResponse(response) {
  const json = extractJsonObject(response);
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new Error(`La IA devolvió JSON inválido: ${error.message}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('La respuesta de la IA debe ser un objeto JSON.');
  }
  return parsed;
}

function validateGeneratedScript(parsed) {
  const { filename, code } = parsed;
  if (typeof filename !== 'string' || !/^[a-zA-Z0-9_-]+\.slq$/i.test(filename)) {
    throw new Error('La IA propuso un nombre no válido. Los scripts deben tener un nombre simple y extensión .slq.');
  }
  if (typeof code !== 'string' || !code.trim()) {
    throw new Error('La IA no generó contenido válido para el script.');
  }
  return { filename, code };
}

module.exports = { parseAIResponse, validateGeneratedScript };
