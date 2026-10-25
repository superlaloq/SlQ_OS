#!/usr/bin/env bash
set -euo pipefail

read -r -p "¿Reiniciar el sistema ahora? Escribe REINICIAR para confirmar: " confirmacion
if [[ "$confirmacion" != "REINICIAR" ]]; then
  echo "Reinicio cancelado."
  exit 0
fi

exec sudo systemctl reboot