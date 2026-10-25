const assert = require('node:assert/strict');
const test = require('node:test');
const { parseAIResponse, validateGeneratedScript } = require('../src/aiResponse');

test('AI response parser extracts a valid JSON object with escaped text', () => {
  const parsed = parseAIResponse('```json\n{"type":"CHAT","response":"Hola \\"SlQ\\""}\n```');
  assert.deepEqual(parsed, { type: 'CHAT', response: 'Hola "SlQ"' });
});

test('AI response parser reports malformed JSON clearly', () => {
  assert.throws(
    () => parseAIResponse('{"type":"CHAT","response":"bad\\x escape"}'),
    /JSON inválido/
  );
});

test('AI-generated scripts must use safe .slq filenames and non-empty code', () => {
  assert.deepEqual(validateGeneratedScript({
    filename: 'inventario_red.slq',
    code: '# Inventario de red\nescanear red'
  }), {
    filename: 'inventario_red.slq',
    code: '# Inventario de red\nescanear red'
  });
  assert.throws(() => validateGeneratedScript({
    filename: 'list_network_devices.sql',
    code: 'SELECT * FROM hosts'
  }), /extensión \.slq/);
  assert.throws(() => validateGeneratedScript({
    filename: '../fuera.slq',
    code: 'imprimir "no"'
  }), /nombre no válido/);
});
