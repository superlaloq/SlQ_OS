#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Ejecuta el constructor como root, por ejemplo: sudo ./scripts/build-distro-iso.sh" >&2
  exit 1
fi

for tool in lb rsync sha256sum xorriso debootstrap findmnt umount; do
  if ! command -v "${tool}" >/dev/null 2>&1; then
    echo "Falta la herramienta requerida '${tool}'. Instala live-build, rsync, xorriso, debootstrap y coreutils." >&2
    exit 1
  fi
done

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
build_dir="${project_dir}/build/slq-os-live"
config_source="${project_dir}/distro/live-build/config"
staged_source="${build_dir}/config/includes.chroot/opt/slq-os"
bootstrap_target="ubuntu noble amd64"
bootstrap_target_file="${build_dir}/.slq-live-bootstrap-target"
bootstrap_cache="${build_dir}/cache/bootstrap"
bootstrap_package_cache="${build_dir}/cache/packages.bootstrap"

if [[ -L "${project_dir}/build" || -L "${build_dir}" ]]; then
  echo "La ruta de construcción no puede ser un enlace simbólico." >&2
  exit 1
fi
if [[ ! -f "${project_dir}/package-lock.json" || ! -f "${project_dir}/src/index.js" ]]; then
  echo "No se encuentra el código fuente de SlQ-OS en ${project_dir}." >&2
  exit 1
fi
if [[ ! -d "${config_source}" || -L "${config_source}" ]]; then
  echo "No se encontró una configuración segura de live-build." >&2
  exit 1
fi

mkdir -p "${build_dir}"
if [[ -e "${build_dir}" && ! -f "${build_dir}/.slq-live-build-root" ]]; then
  if [[ ! -f "${build_dir}/auto/config" ||
        ! -f "${build_dir}/config/package-lists/slq-os.list.chroot" ||
        -n "$(find "${build_dir}" -mindepth 1 -maxdepth 1 \
          ! -name config ! -name auto -print -quit)" ]] ||
     ! cmp -s "${config_source}/auto/config" "${build_dir}/auto/config" ||
     ! cmp -s "${config_source}/package-lists/slq-os.list.chroot" \
       "${build_dir}/config/package-lists/slq-os.list.chroot"; then
    echo "El directorio ${build_dir} ya existe, pero no se reconoce como una construcción incompleta de SlQ-OS." >&2
    echo "No se borró ni modificó su contenido. Revísalo o usa una carpeta de construcción vacía." >&2
    exit 1
  fi
fi
if [[ -L "${build_dir}/.slq-live-build-root" ||
      ( -e "${build_dir}/.slq-live-build-root" && ! -f "${build_dir}/.slq-live-build-root" ) ]]; then
  echo "El marcador del directorio de construcción no es un archivo regular." >&2
  exit 1
fi
touch "${build_dir}/.slq-live-build-root"

rsync -a --delete "${config_source}/" "${build_dir}/config/"
mkdir -p "${build_dir}/auto"
rsync -a --delete "${config_source}/auto/" "${build_dir}/auto/"
mkdir -p "${staged_source}"
rsync -a --delete \
  "${project_dir}/src" \
  "${project_dir}/packages" \
  "${project_dir}/frontweb" \
  "${project_dir}/scripts" \
  "${project_dir}/package.json" \
  "${project_dir}/package-lock.json" \
  "${staged_source}/"
mkdir -p "${staged_source}/imagenes" "${staged_source}/videos" \
  "${staged_source}/documentos" "${staged_source}/proyectos"
install -m 0644 \
  "${project_dir}/docs/guia-operacion-servicios-red-y-mantenimiento.md" \
  "${staged_source}/documentos/guia-operacion-servicios-red-y-mantenimiento.md"
install -m 0644 "${project_dir}/docs/vision-y-arquitectura.md" \
  "${staged_source}/documentos/vision-y-arquitectura.md"

cd "${build_dir}"
if [[ -L "${bootstrap_target_file}" ||
      ( -e "${bootstrap_target_file}" && ! -f "${bootstrap_target_file}" ) ]]; then
  echo "El marcador de la caché bootstrap no es un archivo regular." >&2
  exit 1
fi
if [[ -L "${bootstrap_cache}" ||
      ( -e "${bootstrap_cache}" && ! -d "${bootstrap_cache}" ) ]]; then
  echo "La caché bootstrap no es un directorio normal. No se modificó." >&2
  exit 1
fi
if [[ -L "${bootstrap_package_cache}" ||
      ( -e "${bootstrap_package_cache}" && ! -d "${bootstrap_package_cache}" ) ]]; then
  echo "La caché de paquetes bootstrap no es un directorio normal. No se modificó." >&2
  exit 1
fi

chroot_mounts="$(
  findmnt --raw --noheadings --output TARGET |
    awk -v prefix="${build_dir}/chroot" \
      '$0 == prefix || index($0, prefix "/") == 1' |
    sort -r
)"
if [[ -n "${chroot_mounts}" ]]; then
  echo "Desmontando puntos residuales del chroot anterior..."
  while IFS= read -r mountpoint; do
    [[ -n "${mountpoint}" ]] || continue
    if ! umount --force -- "${mountpoint}"; then
      echo "No se pudo desmontar '${mountpoint}'. No se modificará el chroot." >&2
      exit 1
    fi
  done <<< "${chroot_mounts}"
fi

lb clean
if [[ -e "${build_dir}/chroot" ]]; then
  echo "live-build no pudo limpiar el chroot anterior; se cancela la construcción." >&2
  exit 1
fi

cached_bootstrap_matches=false
if [[ -f "${bootstrap_cache}/etc/os-release" ]] &&
   grep -qx 'ID=ubuntu' "${bootstrap_cache}/etc/os-release" &&
   grep -qx 'VERSION_CODENAME=noble' "${bootstrap_cache}/etc/os-release" &&
   [[ -f "${bootstrap_target_file}" ]] &&
   [[ "$(cat "${bootstrap_target_file}")" == "${bootstrap_target}" ]]; then
  cached_bootstrap_matches=true
fi
if [[ "${cached_bootstrap_matches}" != true ]]; then
  echo "Las cachés bootstrap no corresponden a Ubuntu Noble amd64; se eliminan solo esas cachés generadas."
  rm -rf -- "${bootstrap_cache}"
  rm -rf -- "${bootstrap_package_cache}"
  printf '%s\n' "${bootstrap_target}" > "${bootstrap_target_file}"
fi

lb config
if ! grep -qx 'LB_MODE="ubuntu"' "${build_dir}/config/common" ||
   ! grep -qx 'LB_DISTRIBUTION="noble"' "${build_dir}/config/bootstrap" ||
   ! grep -qx 'LB_INITRAMFS="casper"' "${build_dir}/config/common" ||
   ! grep -qx 'LB_BOOTLOADER="grub"' "${build_dir}/config/binary" ||
   ! grep -qx 'LB_DEBIAN_INSTALLER="false"' "${build_dir}/config/binary" ||
   ! grep -qx 'LB_SECURITY="true"' "${build_dir}/config/chroot"; then
  echo "live-build no cargó la configuración esperada de Ubuntu Noble, Casper, GRUB e índices de seguridad. Se cancela la construcción." >&2
  exit 1
fi
lb bootstrap
if [[ ! -f "${build_dir}/chroot/etc/os-release" ]] ||
   ! grep -qx 'ID=ubuntu' "${build_dir}/chroot/etc/os-release" ||
   ! grep -qx 'VERSION_CODENAME=noble' "${build_dir}/chroot/etc/os-release"; then
  echo "El sistema base generado no es Ubuntu Noble. Se cancela antes de instalar paquetes." >&2
  exit 1
fi
lb build

image="${build_dir}/live-image-amd64.hybrid.iso"
if [[ ! -s "${image}" ]]; then
  echo "La compilación terminó sin producir la ISO esperada: ${image}" >&2
  exit 1
fi

sha256sum "${image}" | tee "${image}.sha256"
printf 'ISO lista: %s\n' "${image}"
