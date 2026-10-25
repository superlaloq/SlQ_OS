#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -un)" != "slq" ]]; then
  echo "La configuración inicial del Frontweb debe ejecutarse como el usuario slq." >&2
  exit 1
fi

state_directory="/run/slq-os"
auth_file="${state_directory}/web-auth.env"
umask 077
if [[ -L "${state_directory}" || ( -e "${state_directory}" && ! -d "${state_directory}" ) ]]; then
  echo "El directorio de estado live no es una carpeta normal." >&2
  exit 1
fi
mkdir -p "${state_directory}"
chmod 0700 "${state_directory}"
exec 9>"${state_directory}/web-auth-setup.lock"
flock -x 9

start_web_service() {
  local session_variables=()
  if [[ -n "${DISPLAY:-}" ]]; then session_variables+=(DISPLAY); fi
  if [[ -n "${WAYLAND_DISPLAY:-}" ]]; then session_variables+=(WAYLAND_DISPLAY); fi
  if [[ -n "${XDG_CURRENT_DESKTOP:-}" ]]; then session_variables+=(XDG_CURRENT_DESKTOP); fi
  if [[ -n "${XDG_SESSION_TYPE:-}" ]]; then session_variables+=(XDG_SESSION_TYPE); fi
  if [[ -n "${DBUS_SESSION_BUS_ADDRESS:-}" ]]; then session_variables+=(DBUS_SESSION_BUS_ADDRESS); fi
  if [[ -n "${XDG_RUNTIME_DIR:-}" ]]; then session_variables+=(XDG_RUNTIME_DIR); fi

  if ((${#session_variables[@]})) &&
     ! systemctl --user import-environment "${session_variables[@]}"; then
    echo "No se pudo compartir el entorno de la sesión gráfica con SlQ-OS Web." >&2
    return 1
  fi

  if [[ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]] &&
     systemctl --user is-active --quiet slq-os-web.service; then
    if ! systemctl --user restart slq-os-web.service; then
      echo "No se pudo reiniciar SlQ-OS Web en la sesión gráfica." >&2
      return 1
    fi
  elif ! systemctl --user start slq-os-web.service; then
    echo "No se pudo iniciar SlQ-OS Web en la sesión actual." >&2
    return 1
  fi

  if ! systemctl --user is-active --quiet slq-os-web.service; then
    echo "SlQ-OS Web no quedó activo; revisa 'systemctl --user status slq-os-web.service'." >&2
    return 1
  fi
  echo "SlQ-OS Web está disponible en http://localhost:3000."
}

if [[ -e "${auth_file}" || -L "${auth_file}" ]]; then
  if [[ ! -f "${auth_file}" || -L "${auth_file}" ]]; then
    echo "La configuración de autenticación live no es un archivo normal." >&2
    exit 1
  fi
  if [[ "$(stat -c '%a:%u' "${auth_file}")" != "600:$(id -u)" ]]; then
    echo "La configuración de autenticación live debe ser privada y pertenecer al usuario slq." >&2
    exit 1
  fi
  start_web_service
  exit
fi

web_user="slq"
read -r -p "Usuario del Frontweb [${web_user}]: " supplied_user
web_user="${supplied_user:-${web_user}}"
if [[ ! "${web_user}" =~ ^[A-Za-z0-9_.-]{1,64}$ ]]; then
  echo "El usuario solo puede contener letras, números, punto, guion y guion bajo." >&2
  exit 1
fi

read -r -s -p "Contraseña del Frontweb (mínimo 12 caracteres): " web_password
echo
read -r -s -p "Confirma la contraseña: " confirmed_password
echo
if [[ "${web_password}" != "${confirmed_password}" ||
      "${#web_password}" -lt 12 || "${#web_password}" -gt 1024 ]]; then
  unset web_password confirmed_password
  echo "Las contraseñas no coinciden o no tienen entre 12 y 1024 caracteres." >&2
  exit 1
fi

password_salt="$(node -e 'process.stdout.write(require("crypto").randomBytes(16).toString("hex"))')"
password_hash="$(printf '%s' "${web_password}" | SLQ_WEB_SALT="${password_salt}" node -e '
  const crypto = require("crypto");
  const chunks = [];
  process.stdin.on("data", (chunk) => chunks.push(chunk));
  process.stdin.on("end", () => {
    crypto.scrypt(Buffer.concat(chunks), Buffer.from(process.env.SLQ_WEB_SALT, "hex"), 32,
      (error, key) => {
        if (error) {
          console.error(error.message);
          process.exitCode = 1;
        } else {
          process.stdout.write(key.toString("hex"));
        }
      });
  });
')"
unset web_password confirmed_password

temporary_auth="$(mktemp "${auth_file}.XXXXXX")"
trap 'rm -f "${temporary_auth}"' EXIT
{
  printf 'SLQ_WEB_USER=%s\n' "${web_user}"
  printf 'SLQ_WEB_PASSWORD_SALT=%s\n' "${password_salt}"
  printf 'SLQ_WEB_PASSWORD_HASH=%s\n' "${password_hash}"
} > "${temporary_auth}"
chmod 0600 "${temporary_auth}"
mv -- "${temporary_auth}" "${auth_file}"
trap - EXIT
unset password_hash password_salt

start_web_service
