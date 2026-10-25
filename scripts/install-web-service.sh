#!/usr/bin/env bash
set -euo pipefail

reset_credentials="${1:-}"
if [[ -n "${reset_credentials}" && "${reset_credentials}" != "--reset-password" ]]; then
  echo "Uso: $0 [--reset-password]" >&2
  exit 1
fi

if [[ "${EUID}" -ne 0 ]]; then
  echo "Ejecuta este instalador con sudo para configurar el inicio del sistema." >&2
  exit 1
fi

if ! command -v systemctl >/dev/null 2>&1; then
  echo "No se encontró systemctl; se requiere systemd para habilitar el inicio automático." >&2
  exit 1
fi

if ! command -v systemd-analyze >/dev/null 2>&1; then
  echo "No se encontró systemd-analyze; no se puede validar la unidad antes de instalarla." >&2
  exit 1
fi

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
node_bin="$(command -v node || true)"
service_user="${SUDO_USER:-$(stat -c '%U' "${project_dir}")}"

if [[ -z "${node_bin}" ]]; then
  echo "No se encontró Node.js en PATH." >&2
  exit 1
fi

if ! id "${service_user}" >/dev/null 2>&1; then
  echo "No se encontró la cuenta de servicio '${service_user}'." >&2
  exit 1
fi

user_home="$(getent passwd "${service_user}" | cut -d: -f6)"
service_group="$(id -gn "${service_user}")"
if [[ -z "${user_home}" || ! -d "${user_home}" ]]; then
  echo "No se encontró el directorio personal de '${service_user}'." >&2
  exit 1
fi

if [[ ! -f "${project_dir}/src/index.js" || ! -d "${project_dir}/node_modules/express" ]]; then
  echo "Faltan src/index.js o Express en ${project_dir}; ejecuta 'npm install' primero." >&2
  exit 1
fi

for directory in imagenes videos documentos proyectos; do
  managed_directory="${project_dir}/${directory}"
  if [[ -L "${managed_directory}" || ( -e "${managed_directory}" && ! -d "${managed_directory}" ) ]]; then
    echo "La ruta ${managed_directory} debe ser una carpeta normal, no un enlace simbólico." >&2
    exit 1
  fi
  install -d -m 0750 -o "${service_user}" -g "${service_group}" "${managed_directory}"
done

quote_systemd_value() {
  local value="${1//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '"%s"' "${value}"
}

escape_systemd_path() {
  local value="${1//\\/\\\\}"
  value="${value// /\\x20}"
  value="${value//$'\t'/\\x09}"
  printf '%s' "${value}"
}

quote_shell_value() {
  printf "'%s'" "${1//\'/\'\\\'\'}"
}

unit_file="/etc/systemd/system/slq-os-web.service"
auth_directory="/etc/slq-os"
auth_file="${auth_directory}/web-auth.env"
temporary_unit="$(mktemp)"
temporary_console="$(mktemp)"
temporary_profile="$(mktemp)"
temporary_workspace="$(mktemp)"
temporary_auth="$(mktemp)"
trap 'rm -f "${temporary_unit}" "${temporary_console}" "${temporary_profile}" "${temporary_workspace}" "${temporary_auth}"' EXIT

if [[ ! -f "${auth_file}" || "${reset_credentials}" == "--reset-password" ]]; then
  read -r -p "Usuario del Frontweb [${service_user}]: " web_user
  web_user="${web_user:-${service_user}}"
  if [[ ! "${web_user}" =~ ^[A-Za-z0-9_.-]{1,64}$ ]]; then
    echo "El usuario solo puede contener letras, números, punto, guion y guion bajo." >&2
    exit 1
  fi
  read -r -s -p "Contraseña del Frontweb (mínimo 12 caracteres): " web_password
  echo
  read -r -s -p "Confirma la contraseña: " confirmed_password
  echo
  if [[ "${web_password}" != "${confirmed_password}" || "${#web_password}" -lt 12 ]]; then
    unset web_password confirmed_password
    echo "Las contraseñas no coinciden o no alcanzan los 12 caracteres mínimos." >&2
    exit 1
  fi

  password_salt="$(openssl rand -hex 16)"
  password_hash="$(printf '%s' "${web_password}" | SLQ_WEB_SALT="${password_salt}" "${node_bin}" -e '
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

  cat > "${temporary_auth}" <<EOF
SLQ_WEB_USER=${web_user}
SLQ_WEB_PASSWORD_SALT=${password_salt}
SLQ_WEB_PASSWORD_HASH=${password_hash}
EOF
  install -d -m 0750 -o root -g "${service_group}" "${auth_directory}"
  install -m 0640 -o root -g "${service_group}" "${temporary_auth}" "${auth_file}"
else
  if ! grep -q '^SLQ_WEB_USER=' "${auth_file}" ||
     ! grep -q '^SLQ_WEB_PASSWORD_SALT=' "${auth_file}" ||
     ! grep -q '^SLQ_WEB_PASSWORD_HASH=' "${auth_file}"; then
    echo "${auth_file} no contiene una configuración de autenticación completa." >&2
    exit 1
  fi
fi

cat > "${temporary_unit}" <<EOF
[Unit]
Description=SlQ-OS Web Dashboard
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${service_user}
WorkingDirectory=$(escape_systemd_path "${project_dir}")
StateDirectory=slq-os
StateDirectoryMode=0750
Environment=PORT=3000
Environment=SLQ_PROJECT_APPROVALS_FILE=/var/lib/slq-os/project-approvals.json
Environment=SLQ_LINKS_DIRECTORY=/var/lib/slq-os/links
EnvironmentFile=${auth_file}
ExecStart=$(quote_systemd_value "${node_bin}") $(quote_systemd_value "${project_dir}/src/index.js") --web-server
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

cat > "${temporary_console}" <<EOF
#!/bin/sh
cd $(quote_shell_value "${project_dir}")
exec $(quote_shell_value "${node_bin}") $(quote_shell_value "${project_dir}/src/index.js")
EOF

cat > "${temporary_profile}" <<'EOF'
case "$-" in
  *i*) ;;
  *) return ;;
esac

if [ -n "${SLQ_OS_CONSOLE_STARTED:-}" ] ||
   [ ! -t 0 ] || [ ! -t 1 ] ||
   [ -n "${DISPLAY:-}" ] || [ -n "${WAYLAND_DISPLAY:-}" ] ||
   [ "$(id -u)" -eq 0 ]; then
  return
fi

case "$(tty 2>/dev/null || true)" in
  /dev/tty[0-9]*)
    export SLQ_OS_CONSOLE_STARTED=1
    slq-os-console
    ;;
esac
EOF

cat > "${temporary_workspace}" <<EOF
#!/bin/sh
if command -v code >/dev/null 2>&1; then
  exec code --new-window $(quote_shell_value "${project_dir}")
fi
echo "Visual Studio Code (comando 'code') no está instalado o no está disponible en PATH."
echo "Se abrirá el Frontweb por separado; puedes instalar VS Code y volver a ejecutar el instalador."
EOF

install -m 0644 "${temporary_unit}" "${unit_file}"
install -m 0755 "${temporary_console}" /usr/local/bin/slq-os-console
install -m 0644 "${temporary_profile}" /etc/profile.d/slq-os-console.sh
install -m 0755 "${temporary_workspace}" /usr/local/bin/slq-os-open-vscode
install -m 0755 "$(dirname -- "${BASH_SOURCE[0]}")/open-frontweb.sh" /usr/local/bin/slq-os-open-frontweb
install -d -m 0755 -o "${service_user}" -g "${service_group}" "${user_home}/.config/autostart"
cat > "${user_home}/.config/autostart/slq-os-frontweb.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=SlQ-OS Frontweb
Comment=Abrir el portal web de SlQ-OS al iniciar sesión
Exec=/usr/local/bin/slq-os-open-frontweb
Terminal=false
X-GNOME-Autostart-enabled=true
EOF
chown "${service_user}:${service_group}" "${user_home}/.config/autostart/slq-os-frontweb.desktop"
chmod 0644 "${user_home}/.config/autostart/slq-os-frontweb.desktop"
cat > "${user_home}/.config/autostart/slq-os-vscode.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=SlQ-OS Visual Studio Code
Comment=Abrir el proyecto SlQ-OS con su terminal interactiva
Exec=/usr/local/bin/slq-os-open-vscode
Terminal=false
X-GNOME-Autostart-enabled=true
EOF
chown "${service_user}:${service_group}" "${user_home}/.config/autostart/slq-os-vscode.desktop"
chmod 0644 "${user_home}/.config/autostart/slq-os-vscode.desktop"

systemctl daemon-reload
systemd-analyze verify "${unit_file}"
systemctl enable --now slq-os-web.service
systemctl restart slq-os-web.service

if ! systemctl is-active --quiet slq-os-web.service; then
  echo "No se pudo iniciar slq-os-web.service. Revisa 'systemctl status slq-os-web.service'." >&2
  systemctl status slq-os-web.service --no-pager >&2 || true
  exit 1
fi

echo "SlQ-OS Web quedó habilitado en el puerto 3000."
echo "Al iniciar sesión gráfica en ${service_user}, se abrirá http://localhost:3000."
echo "También se abrirá el proyecto en Visual Studio Code si el comando 'code' está disponible."
echo "En una consola TTY, después de iniciar sesión, se abrirá la terminal SlQ interactiva."
