#!/usr/bin/env bash

iso_name="slq-os"
iso_label="SLQ_OS_$(date --date="@${SOURCE_DATE_EPOCH:-$(date +%s)}" +%Y%m)"
iso_publisher="SlQ-OS"
iso_application="SlQ-OS Live System"
iso_version="$(date --date="@${SOURCE_DATE_EPOCH:-$(date +%s)}" +%Y.%m.%d)"
install_dir="arch"
bootmodes=('uefi.systemd-boot')
pacman_conf="pacman.conf"
airootfs_image_type="squashfs"
airootfs_image_tool_options=('-comp' 'xz' '-Xbcj' 'x86,arm64' '-b' '1M' '-Xdict-size' '1M')
file_permissions=(
  ["/etc/sudoers.d/10-slq-live"]="0:0:440"
  ["/etc/lightdm/lightdm.conf"]="0:0:644"
  ["/etc/systemd/user/slq-os-web.service"]="0:0:644"
  ["/etc/xdg/autostart/slq-os-firefox.desktop"]="0:0:644"
  ["/etc/xdg/autostart/slq-os-terminal.desktop"]="0:0:644"
  ["/usr/share/applications/slq-os-installer.desktop"]="0:0:644"
  ["/home/slq"]="1000:1000:750"
  ["/home/slq/.bash_profile"]="1000:1000:644"
  ["/usr/local/bin/slq-os"]="0:0:755"
  ["/usr/local/bin/slq-os-install"]="0:0:755"
)
