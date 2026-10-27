const { exec } = require('child_process');

function speakTerminalAI(text) {
  if (!text) return;
  // Limpiar caracteres especiales para la síntesis de voz por CLI
  const cleanText = text.replace(/["`$\\]/g, "").substring(0, 200);
  // Usar espeak-ng en español con parámetros pausados (estilo Hawking)
  exec(`espeak-ng -v es -s 130 -p 45 "${cleanText}"`, (err) => {
    if (err) {
      console.warn("[SlQ-OS Audio] No se pudo reproducir voz nativa en terminal:", err.message);
    }
  });
}

module.exports = { speakTerminalAI };
