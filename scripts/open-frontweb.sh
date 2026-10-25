#!/usr/bin/env bash
set -euo pipefail

url="${SLQ_OS_URL:-http://localhost:3000}"
port="${url##*:}"
port="${port%%/*}"
ready=false

for ((attempt = 0; attempt < 60; attempt += 1)); do
  if command -v curl >/dev/null 2>&1; then
    status="$(curl --silent --show-error --max-time 2 "${url}" --output /dev/null --write-out '%{http_code}' 2>/dev/null || true)"
    if [[ "${status}" == 2?? || "${status}" == 3?? || "${status}" == 401 ]]; then
      ready=true
      break
    fi
  elif command -v wget >/dev/null 2>&1; then
    response="$(wget --quiet --server-response --spider --timeout=2 "${url}" 2>&1 || true)"
    if [[ "${response}" == *" 200 "* || "${response}" == *" 204 "* ||
          "${response}" == *" 301 "* || "${response}" == *" 302 "* ||
          "${response}" == *" 401 "* ]]; then
      ready=true
      break
    fi
  elif (echo >"/dev/tcp/127.0.0.1/${port}") >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done

if [[ "${ready}" != true ]]; then
  echo "SlQ-OS Web no respondió en ${url} después de 60 segundos." >&2
  exit 1
fi

if command -v xdg-open >/dev/null 2>&1; then
  exec xdg-open "${url}"
elif command -v gio >/dev/null 2>&1; then
  exec gio open "${url}"
fi

echo "No se encontró xdg-open ni gio para abrir el Frontweb." >&2
exit 1
