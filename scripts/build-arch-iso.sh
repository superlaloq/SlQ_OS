#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Ejecuta el constructor como root: sudo ./scripts/build-arch-iso.sh" >&2
  exit 1
fi

for tool in mkarchiso rsync npm node sha256sum; do
  if ! command -v "${tool}" >/dev/null 2>&1; then
    echo "Falta la herramienta requerida '${tool}'. En Arch Linux instala archiso, rsync, nodejs y npm." >&2
    exit 1
  fi
done

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
build_root="${project_dir}/build"
build_dir="${build_root}/slq-os-arch"
profile_source="${project_dir}/distro/archiso"
profile_stage="${build_dir}/profile"
app_stage="${profile_stage}/airootfs/home/slq/SlQ_lenguaje"
marker="${build_dir}/.slq-archiso-build-root"

if [[ -L "${build_root}" || -L "${build_dir}" ]]; then
  echo "La ruta de construccion no puede ser un enlace simbolico." >&2
  exit 1
fi
if [[ ! -f "${project_dir}/package-lock.json" ||
      ! -f "${project_dir}/src/index.js" ||
      ! -f "${profile_source}/profiledef.sh" ]]; then
  echo "No se encuentra el codigo fuente o perfil Arch de SlQ-OS." >&2
  exit 1
fi
if [[ -e "${build_dir}" && ! -f "${marker}" ]] &&
   [[ -n "$(find "${build_dir}" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
  echo "El directorio ${build_dir} ya existe y no se reconoce como construccion de SlQ-OS. No se modifico." >&2
  exit 1
fi
if [[ -L "${marker}" || ( -e "${marker}" && ! -f "${marker}" ) ]]; then
  echo "El marcador del directorio de construccion no es un archivo regular." >&2
  exit 1
fi

mkdir -p "${build_dir}"
touch "${marker}"
if [[ -L "${profile_stage}" || -L "${build_dir}/work" || -L "${build_dir}/out" ]]; then
  echo "Los directorios profile/work/out no pueden ser enlaces simbolicos." >&2
  exit 1
fi
mkdir -p "${profile_stage}"
rsync -a --delete "${profile_source}/" "${profile_stage}/"

mkdir -p "${app_stage}"
rsync -a --delete "${project_dir}/src/" "${app_stage}/src/"
rsync -a --delete "${project_dir}/packages/" "${app_stage}/packages/"
rsync -a --delete "${project_dir}/frontweb/" "${app_stage}/frontweb/"
install -m 0644 "${project_dir}/package.json" "${app_stage}/package.json"
install -m 0644 "${project_dir}/package-lock.json" "${app_stage}/package-lock.json"
install -m 0644 "${project_dir}/src/web/system-dashboard.html" \
  "${app_stage}/index.html"
mkdir -p "${app_stage}/scripts"
install -m 0755 "${profile_source}/airootfs/usr/local/bin/slq-os" \
  "${app_stage}/scripts/slq-os"
install -m 0755 "${project_dir}/scripts/setup-live-web-auth.sh" \
  "${profile_stage}/airootfs/usr/local/bin/slq-os-live-auth"
install -m 0755 "${project_dir}/scripts/open-slq-firefox.sh" \
  "${profile_stage}/airootfs/usr/local/bin/slq-os-open-firefox"
mkdir -p "${app_stage}/imagenes" "${app_stage}/videos" \
  "${app_stage}/documentos" "${app_stage}/proyectos"

npm ci --prefix "${app_stage}" --omit=dev --ignore-scripts --no-audit --no-fund
chown -R 1000:1000 "${app_stage}"

for directory in \
  "${profile_stage}/airootfs/etc/systemd/system/multi-user.target.wants" \
  "${profile_stage}/airootfs/etc/systemd/system/graphical.target.wants" \
  "${profile_stage}/airootfs/etc/systemd/user/default.target.wants"; do
  mkdir -p "${directory}"
done
network_manager_link="${profile_stage}/airootfs/etc/systemd/system/multi-user.target.wants/NetworkManager.service"
if [[ -e "${network_manager_link}" || -L "${network_manager_link}" ]]; then
  if [[ ! -L "${network_manager_link}" ||
        "$(readlink "${network_manager_link}")" != "/usr/lib/systemd/system/NetworkManager.service" ]]; then
    echo "El destino de NetworkManager.service en el perfil no es el enlace esperado." >&2
    exit 1
  fi
else
  ln -s /usr/lib/systemd/system/NetworkManager.service "${network_manager_link}"
fi

lightdm_link="${profile_stage}/airootfs/etc/systemd/system/graphical.target.wants/lightdm.service"
if [[ -e "${lightdm_link}" || -L "${lightdm_link}" ]]; then
  if [[ ! -L "${lightdm_link}" ||
        "$(readlink "${lightdm_link}")" != "/usr/lib/systemd/system/lightdm.service" ]]; then
    echo "El destino de lightdm.service en el perfil no es el enlace esperado." >&2
    exit 1
  fi
else
  ln -s /usr/lib/systemd/system/lightdm.service "${lightdm_link}"
fi

web_server_link="${profile_stage}/airootfs/etc/systemd/user/default.target.wants/slq-os-web.service"
if [[ -e "${web_server_link}" || -L "${web_server_link}" ]]; then
  if [[ ! -L "${web_server_link}" ||
        "$(readlink "${web_server_link}")" != "/etc/systemd/user/slq-os-web.service" ]]; then
    echo "El destino de slq-os-web.service en el perfil no es el enlace esperado." >&2
    exit 1
  fi
else
  ln -s /etc/systemd/user/slq-os-web.service "${web_server_link}"
fi

default_target="${profile_stage}/airootfs/etc/systemd/system/default.target"
if [[ -e "${default_target}" || -L "${default_target}" ]]; then
  if [[ ! -L "${default_target}" ||
        "$(readlink "${default_target}")" != "/usr/lib/systemd/system/graphical.target" ]]; then
    echo "El destino default.target en el perfil no es el enlace grafico esperado." >&2
    exit 1
  fi
else
  ln -s /usr/lib/systemd/system/graphical.target "${default_target}"
fi

if ! grep -qx '%wheel ALL=(ALL:ALL) NOPASSWD: ALL' \
  "${profile_stage}/airootfs/etc/sudoers.d/10-slq-live"; then
  echo "La regla sudo del usuario live no coincide con la configuracion esperada." >&2
  exit 1
fi

output_dir="${build_dir}/out"
mkdir -p "${output_dir}"

mkarchiso -v -w "${build_dir}/work" -o "${output_dir}" "${profile_stage}"

image="${output_dir}/slq-os-$(date +%Y.%m.%d)-x86_64.iso"
if [[ ! -s "${image}" ]]; then
  echo "La construccion termino sin producir la ISO esperada: ${image}" >&2
  exit 1
fi

sha256sum "${image}" | tee "${image}.sha256"
printf 'ISO lista: %s\n' "${image}"
