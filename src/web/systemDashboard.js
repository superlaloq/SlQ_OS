const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { renderSlqMenu } = require('../slqMenu');

const templatePath = path.join(__dirname, 'system-dashboard.html');
const missingReportMessage = 'Aún no se ha generado un informe. Ejecuta cargar reporte_sistema.slq y luego crearWeb en la consola SlQ.';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return entities[character];
  });
}

function getActiveIp() {
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const network of interfaces || []) {
      if ((network.family === 'IPv4' || network.family === 4) && !network.internal) {
        return network.address;
      }
    }
  }
  return '127.0.0.1';
}

function replaceSlot(html, slot, content) {
  const pattern = new RegExp(
    `(<([a-z][a-z\\d]*)\\b[^>]*\\bid="${slot}"[^>]*>)[\\s\\S]*?(</\\2>)`,
    'i'
  );
  const match = html.match(pattern);
  if (!match) {
    throw new Error(`No se encontró el espacio '${slot}' en la plantilla del panel.`);
  }

  return html.replace(pattern, (_match, openingTag, _tagName, closingTag) =>
    `${openingTag}${content}${closingTag}`);
}

function generateSystemDashboard({ directory = process.cwd(), activeIp = getActiveIp() } = {}) {
  const reportPath = path.join(directory, 'reporte_equipo.txt');
  const reportContent = fs.existsSync(reportPath)
    ? fs.readFileSync(reportPath, 'utf8')
    : missingReportMessage;
  let html = fs.readFileSync(templatePath, 'utf8');

  // Los datos del equipo se muestran como texto, nunca como marcado HTML ejecutable.
  html = replaceSlot(html, 'active-ip', escapeHtml(activeIp));
  html = replaceSlot(html, 'local-url', 'http://localhost:3000');
  html = replaceSlot(html, 'report-content', `<pre>${escapeHtml(reportContent)}</pre>`);
  html = replaceSlot(html, 'script-list', renderSlqMenu(directory));

  const outputPath = path.join(directory, 'index.html');
  fs.writeFileSync(outputPath, html, 'utf8');
  return outputPath;
}

module.exports = { generateSystemDashboard };
