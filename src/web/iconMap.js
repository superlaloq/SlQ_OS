const SYSTEM_ICON_MAP = {
  "firefox.desktop": "🌐",
  "thunderbird.desktop": "✉️",
  "hypnotix.desktop": "📺",
  "transmission-gtk.desktop": "📥",
  "org.wireshark.Wireshark.desktop": "🦈",
  "org.x.Warpinator.desktop": "🔄",
  "org.gnome.Calculator.desktop": "🧮",
  "org.gnome.Calendar.desktop": "📅",
  "org.x.editor.desktop": "📝",
  "org.gnome.FileRoller.desktop": "📦",
  "xfce4-dict.desktop": "📖",
  "gucharmap.desktop": "🔣",
  "sticky.desktop": "📌",
  "xfce4-terminal.desktop": "💻",
  "org.gnome.Nautilus.desktop": "📁",
  "thunar.desktop": "📂",
  "xfce4-taskmanager.desktop": "📊",
  "org.gnome.DiskUtility.desktop": "💾",
  "org.gnome.baobab.desktop": "📈",
  "lstopo.desktop": "⚡",
  "simple-scan.desktop": "🖨️",
  "com.github.maoschanz.drawing.desktop": "🎨",
  "io.github.celluloid_player.Celluloid.desktop": "🎬",
  "org.gnome.Rhythmbox3.desktop": "🎵",
  "xfce4-screenshooter.desktop": "📸",
  "xfce-settings-manager.desktop": "⚙️",
  "nm-connection-editor.desktop": "📶",
  "blueman-adapters.desktop": "🦷",
  "pavucontrol.desktop": "🔊",
  "system-config-printer.desktop": "🖨️",
  "users.desktop": "👥",
  "mintinstall.desktop": "🛒",
  "mintupdate.desktop": "🔄",
  "mintbackup.desktop": "💾",
  "mintreport.desktop": "⚠️",
  "mintdesktop.desktop": "🖥️",
  "xfce4-appfinder.desktop": "🔍",
  "xfce4-run.desktop": "🚀"
};

function getAppEmojiIcon(appId) {
  if (SYSTEM_ICON_MAP[appId]) return SYSTEM_ICON_MAP[appId];
  const lower = appId.toLowerCase();
  if (lower.includes('setting') || lower.includes('config') || lower.includes('manager')) return '⚙️';
  if (lower.includes('terminal') || lower.includes('shell') || lower.includes('code')) return '💻';
  if (lower.includes('file') || lower.includes('thunar') || lower.includes('nautilus')) return '📁';
  if (lower.includes('net') || lower.includes('browser') || lower.includes('firefox')) return '🌐';
  if (lower.includes('audio') || lower.includes('video') || lower.includes('player') || lower.includes('media')) return '🎵';
  if (lower.includes('edit') || lower.includes('text') || lower.includes('note')) return '📝';
  return '⚡';
}

module.exports = { getAppEmojiIcon };
