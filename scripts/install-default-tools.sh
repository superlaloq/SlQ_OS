#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Ejecuta este instalador como root (por ejemplo, con sudo)." >&2
  exit 1
fi

if [[ ! -r /etc/os-release ]]; then
  echo "No se pudo identificar la distribución: falta /etc/os-release." >&2
  exit 1
fi

# shellcheck disable=SC1091
source /etc/os-release
if [[ " ${ID:-} ${ID_LIKE:-} " != *" debian "* && " ${ID:-} ${ID_LIKE:-} " != *" ubuntu "* ]]; then
  echo "Distribución no compatible: este instalador requiere Debian o Ubuntu." >&2
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "No se encontró apt-get; no se pueden instalar los paquetes requeridos." >&2
  exit 1
fi

packages=(
  nmap
  wireshark
  aircrack-ng
  strongswan
)

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y "${packages[@]}"

echo "Herramientas predeterminadas de SlQ_OS instaladas correctamente."
