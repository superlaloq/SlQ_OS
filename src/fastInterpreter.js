// Comandos rápidos que se ejecutan directamente sin pasar por el modelo
const QUICK_PATTERNS = [
  /^(ls|dir)(\s+.*)?$/i,
  /^(mkdir|rmdir)(\s+.*)?$/i,
  /^(pwd|cd)(\s+.*)?$/i,
  /^(clear|cls)$/i,
  /^(cat|touch|rm)(\s+.*)?$/i,
  /^(ps|top|free|df|uptime)(\s+.*)?$/i
];

function checkQuickCommand(input) {
  const trimmed = input.trim();
  
  if (trimmed.toLowerCase() === 'clear' || trimmed.toLowerCase() === 'cls') {
    return { isQuick: true, action: 'CLEAR' };
  }

  for (const pattern of QUICK_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        isQuick: true,
        action: 'EXECUTE',
        command: trimmed,
        explanation: 'Comando nativo del sistema'
      };
    }
  }

  return { isQuick: false };
}

module.exports = { checkQuickCommand };
