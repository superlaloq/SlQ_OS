#!/usr/bin/env bash
set -euo pipefail

url="http://localhost:3000"
health_url="http://127.0.0.1:3000"
auth_file="/run/slq-os/web-auth.env"
ready=false

if ! command -v curl >/dev/null 2>&1; then
  echo "No se encontró curl para comprobar SlQ-OS Web." >&2
  exit 1
fi

for ((attempt = 0; attempt < 300; attempt += 1)); do
  if [[ -f "${auth_file}" && ! -L "${auth_file}" ]]; then
    status="$(curl --silent --show-error --max-time 2 "${health_url}" \
      --output /dev/null --write-out '%{http_code}' 2>/dev/null || true)"
    if [[ "${status}" == 2?? || "${status}" == 3?? || "${status}" == 401 ]]; then
      ready=true
      break
    fi
  fi
  sleep 1
done

if [[ "${ready}" != true ]]; then
  echo "SlQ-OS Web no quedó disponible en ${url} en cinco minutos." >&2
  exit 1
fi

if ! command -v firefox >/dev/null 2>&1; then
  echo "Firefox no está instalado o no está disponible en PATH." >&2
  exit 1
fi

exec firefox --new-window "${url}"
