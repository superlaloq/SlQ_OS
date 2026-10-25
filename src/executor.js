const { exec } = require('child_process');

function executeAction(action) {
  return new Promise((resolve) => {
    if (action.type !== 'EXECUTE_COMMAND' || !action.command) {
      return resolve({ success: false, output: 'Acción no reconocida o comando vacío.' });
    }

    // Ejecutar el comando en el SO
    exec(action.command, (error, stdout, stderr) => {
      if (error) {
        return resolve({ success: false, output: stderr || error.message });
      }
      resolve({ success: true, output: stdout || 'Comando ejecutado con éxito (sin salida).' });
    });
  });
}

module.exports = { executeAction };
