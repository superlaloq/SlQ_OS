const fs = require('fs');

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => {
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

function renderSlqMenu(directory = process.cwd()) {
  const scripts = fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.slq'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (!scripts.length) {
    return '<p>No hay archivos .slq disponibles.</p>';
  }

  const links = scripts
    .map((name) => `<li><a href="./${encodeURIComponent(name)}">${escapeHtml(name)}</a></li>`)
    .join('\n');

  return `<ul>\n${links}\n</ul>`;
}

module.exports = { renderSlqMenu };
