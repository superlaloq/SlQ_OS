const { exec } = require('child_process');
const os = require('os');

function getSystemInfo() {
  return {
    platform: os.platform(),
    architecture: os.arch(),
    freeMemMB: Math.round(os.freemem() / 1024 / 1024),
    totalMemMB: Math.round(os.totalmem() / 1024 / 1024),
    uptimeSeconds: os.uptime()
  };
}

function executeShellCommand(command) {
  return new Promise((resolve) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, output: stderr || error.message });
      } else {
        resolve({ success: true, output: stdout.trim() });
      }
    });
  });
}

module.exports = { getSystemInfo, executeShellCommand };
