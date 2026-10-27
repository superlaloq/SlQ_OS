#!/bin/bash

echo "=== 1. Actualizando lista de paquetes e instalando libglib2.0-bin (para 'gio') ==="
sudo apt update && sudo apt install -y libglib2.0-bin xdg-utils

echo "=== 2. Verificando la ruta del archivo applicationManager.js ==="
APP_MANAGER_PATH="src/web/applicationManager.js"

if [ ! -f "$APP_MANAGER_PATH" ]; then
    echo "❌ Error: No se encontró '$APP_MANAGER_PATH'. Asegúrate de ejecutar este script desde la carpeta raíz de tu proyecto SlQ_lenguaje."
    exit 1
fi

echo "=== 3. Actualizando el lanzador en $APP_MANAGER_PATH con un fallback robusto ==="

# Creamos un parche temporal o reemplazamos el bloque del launcher
python3 - << 'EOF'
import re

path = "src/web/applicationManager.js"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Patrón original del launcher
old_launcher = """  const launcher = options.launcher || ((desktopFile) => new Promise((resolve, reject) => {
    execFile('gio', ['launch', desktopFile], { timeout: 10_000 }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  }));"""

# Nuevo launcher robusto con respaldo a xdg-open
new_launcher = """  const launcher = options.launcher || ((desktopFile) => new Promise((resolve, reject) => {
    execFile('gio', ['launch', desktopFile], { timeout: 10_000 }, (error) => {
      if (!error) {
        resolve();
        return;
      }
      execFile('xdg-open', [desktopFile], { timeout: 10_000 }, (fallbackError) => {
        if (fallbackError) reject(fallbackError);
        else resolve();
      });
    });
  }));"""

if old_launcher in content:
    content = content.replace(old_launcher, new_launcher)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("✅ ¡applicationManager.js actualizado con éxito!")
else:
    print("⚠️ Nota: El bloque exacto del launcher no coincidió exactamente, revisa si ya fue modificado previamente.")
EOF

echo "=== ¡Listo! Proceso completado con éxito. ==="
echo "Ahora puedes reiniciar tu servidor Node.js y probar abrir VirtualBox desde el frontweb."