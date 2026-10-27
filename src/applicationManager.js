const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');

const DESKTOP_DIRS = [
  '/usr/share/applications',
  '/usr/local/share/applications',
  path.join(process.env.HOME || '/root', '.local/share/applications')
];

const APP_TRANSLATIONS = {
  "Calculator": "Calculadora",
  "Calendar": "Calendario",
  "Text Editor": "Editor de Texto",
  "Terminal": "Terminal",
  "File Manager": "Gestor de Archivos",
  "Web Browser": "Navegador Web",
  "Task Manager": "Administrador de Tareas",
  "Disk Usage Analyzer": "Analizador de Uso de Disco",
  "Screenshot": "Captura de Pantalla",
  "Settings": "Configuración",
  "Settings Manager": "Gestor de Configuración",
  "Software Manager": "Gestor de Software",
  "Backup Tool": "Herramienta de Respaldo",
  "System Report": "Informes del Sistema",
  "Printers": "Impresoras",
  "Users and Groups": "Usuarios y Grupos",
  "Audio Mixer": "Mezclador de Audio",
  "Connections": "Conexiones de Red",
  "Image Viewer": "Visor de Imágenes",
  "Document Viewer": "Visor de Documentos",
  "Draw": "Dibujo"
};

const CATEGORY_TRANSLATIONS = {
  "AudioVideo": "Multimedia",
  "Development": "Desarrollo",
  "Education": "Educación",
  "Game": "Juegos",
  "Graphics": "Gráficos",
  "Network": "Internet",
  "Office": "Oficina",
  "Settings": "Configuración",
  "System": "Sistema",
  "Utility": "Utilidades"
};

async function getApplicationEntries() {
  const appsMap = new Map();

  for (const dir of DESKTOP_DIRS) {
    try {
      const files = await fs.readdir(dir);
      for (const file of files) {
        if (!file.endsWith('.desktop')) continue;
        const filePath = path.join(dir, file);
        try {
          const content = await fs.readFile(filePath, 'utf8');
          if (content.includes('NoDisplay=true') || content.includes('Hidden=true')) continue;

          let name = file.replace('.desktop', '');
          let exec = '';
          let category = 'Sistema';
          let iconName = '';

          const lines = content.split('\n');
          for (const line of lines) {
            if (line.startsWith('Name=')) {
              let rawName = line.split('=')[1].trim();
              name = APP_TRANSLATIONS[rawName] || rawName;
            }
            if (line.startsWith('Exec=')) {
              exec = line.split('=')[1].trim().replace(/%[fFuUdDnN]/g, '').trim();
            }
            if (line.startsWith('Categories=')) {
              const rawCat = line.split('=')[1].split(';')[0].trim();
              category = CATEGORY_TRANSLATIONS[rawCat] || rawCat || 'Sistema';
            }
            if (line.startsWith('Icon=')) {
              iconName = line.split('=')[1].trim();
            }
          }

          if (exec && !appsMap.has(file)) {
            appsMap.set(file, { id: file, name, exec, category, icon: iconName });
          }
        } catch (e) {}
      }
    } catch (e) {}
  }

  return Array.from(appsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

async function launchApplication(appId) {
  const apps = await getApplicationEntries();
  const target = apps.find(a => a.id === appId);
  if (!target) throw new Error("Aplicación no encontrada");

  return new Promise((resolve, reject) => {
    const cmd = `export DISPLAY=${process.env.DISPLAY || ':0'}; ${target.exec} &`;
    exec(cmd, { env: process.env }, (err) => {
      if (err) reject(err);
      else resolve({ success: true, message: `Lanzado ${target.name}` });
    });
  });
}

module.exports = { getApplicationEntries, launchApplication };
