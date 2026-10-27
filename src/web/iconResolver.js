const fs = require('fs');
const path = require('path');

const ICON_DIRS = [
  '/usr/share/pixmaps',
  '/usr/share/icons/hicolor/48x48/apps',
  '/usr/share/icons/hicolor/scalable/apps',
  '/usr/share/icons/hicolor/64x64/apps',
  '/usr/share/icons/hicolor/128x128/apps',
  '/usr/share/icons/gnome/48x48/apps',
  '/usr/share/icons/Adwaita/48x48/apps'
];

function findOfficialIconPath(iconName) {
  if (!iconName) return null;
  if (iconName.startsWith('/') && fs.existsSync(iconName)) {
    return iconName;
  }

  const cleanName = iconName.replace(/\.(png|svg|xpm)$/i, '');
  const extensions = ['.png', '.svg', '.xpm'];

  for (const dir of ICON_DIRS) {
    for (const ext of extensions) {
      const fullPath = path.join(dir, cleanName + ext);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }
  }

  return null;
}

module.exports = { findOfficialIconPath };
