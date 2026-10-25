const { execFileSync, execSync } = require('child_process');
const os = require('os');
const net = require('net');

function safeExec(command) {
  try {
    return execSync(command, { encoding: 'utf-8', timeout: 5000 }).trim();
  } catch (_error) {
    return '';
  }
}

function normalizeList(raw, limit = 20) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('WARNING') && !line.startsWith('No se'))
    .slice(0, limit);
}

function getHardwareInventory() {
  const cpuModel = safeExec('grep "model name" /proc/cpuinfo 2>/dev/null | head -n 1 | cut -d: -f2-') || 'No disponible';
  const cpuCount = safeExec('nproc 2>/dev/null || grep -c ^processor /proc/cpuinfo 2>/dev/null || echo 1') || '1';
  const memory = safeExec("free -m 2>/dev/null | awk 'NR==2 {print $2 \" MB\"}'") || `${Math.round(os.totalmem() / 1024 / 1024)} MB`;
  const disks = safeExec('lsblk -o NAME,SIZE,TYPE,MOUNTPOINT 2>/dev/null || df -h 2>/dev/null') || 'No disponible';
  const network = safeExec('ip -o link show 2>/dev/null || cat /proc/net/dev 2>/dev/null') || 'No disponible';
  const bios = safeExec('cat /sys/class/dmi/id/product_name 2>/dev/null || cat /sys/class/dmi/id/sys_vendor 2>/dev/null') || 'No disponible';
  const distro = safeExec("grep PRETTY_NAME /etc/os-release 2>/dev/null | head -n 1 | cut -d= -f2- | tr -d '\"'") || os.release();

  return {
    platform: os.platform(),
    architecture: os.arch(),
    distro,
    cpuModel: cpuModel.trim(),
    cpuCount: cpuCount.trim(),
    memory: memory.trim(),
    bios: bios.trim(),
    disks: normalizeList(disks, 10),
    network: normalizeList(network, 10)
  };
}

function getSoftwareInventory() {
  const candidates = [];
  const packageManagers = [
    'dpkg-query -W -f="${Package} ${Version}\\n" 2>/dev/null',
    'rpm -qa 2>/dev/null',
    'apk info 2>/dev/null',
    'pacman -Q 2>/dev/null',
    'brew list --versions 2>/dev/null'
  ];

  for (const command of packageManagers) {
    const output = safeExec(command);
    if (output) {
      candidates.push(...normalizeList(output, 25));
    }
  }

  const commonBins = safeExec('compgen -c 2>/dev/null || ls /usr/bin /usr/local/bin 2>/dev/null') || '';
  if (commonBins) {
    candidates.push(...normalizeList(commonBins, 30).filter((item) => !item.includes('/')));
  }

  const unique = [...new Set(candidates.map((item) => item.trim()))].filter(Boolean);
  return unique.slice(0, 80);
}

function summarizeHardware() {
  const inventory = getHardwareInventory();
  const summaryLines = [
    `Plataforma: ${inventory.platform} (${inventory.architecture})`,
    `Distribución: ${inventory.distro}`,
    `CPU: ${inventory.cpuModel}`,
    `Núcleos: ${inventory.cpuCount}`,
    `Memoria: ${inventory.memory}`,
    `BIOS/Modelo: ${inventory.bios}`
  ];

  summaryLines.push('Discos/almacenamiento:');
  if (inventory.disks.length) {
    inventory.disks.forEach((item) => summaryLines.push(`- ${item}`));
  } else {
    summaryLines.push('- No disponible');
  }

  summaryLines.push('Interfaces/red:');
  if (inventory.network.length) {
    inventory.network.forEach((item) => summaryLines.push(`- ${item}`));
  } else {
    summaryLines.push('- No disponible');
  }

  return summaryLines.join('\n');
}

function summarizeSoftware() {
  const installed = getSoftwareInventory();
  if (!installed.length) {
    return 'No se detectaron paquetes o binarios instalados.';
  }

  return installed.slice(0, 40).join('\n');
}

function ipv4ToNumber(address) {
  if (!net.isIPv4(address)) return null;
  return address.split('.').reduce((value, octet) => ((value << 8) | Number(octet)) >>> 0, 0);
}

function isPrivateIpv4(address) {
  const value = ipv4ToNumber(address);
  if (value === null) return false;
  return (value >>> 24) === 10 ||
    (value >>> 20) === 0xac1 ||
    (value >>> 16) === 0xc0a8;
}

function validateNetworkTarget(target) {
  const match = String(target || '').match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/);
  if (!match || !isPrivateIpv4(match[1])) {
    throw new Error('Usa una subred IPv4 privada, por ejemplo 192.168.1.0/24.');
  }

  const prefix = Number(match[2]);
  if (prefix < 24 || prefix > 30) {
    throw new Error('Por seguridad, el escaneo se limita a subredes de hasta 256 direcciones (prefijo /24 a /30).');
  }

  const address = ipv4ToNumber(match[1]);
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  if (((address & mask) >>> 0) !== address) {
    throw new Error('La dirección indicada no es la dirección de red correspondiente a su prefijo.');
  }

  return `${match[1]}/${prefix}`;
}

function getLocalNetworkTarget(interfaces = os.networkInterfaces()) {
  let broadNetwork;
  for (const entries of Object.values(interfaces)) {
    for (const network of entries || []) {
      if (network.family !== 'IPv4' && network.family !== 4) continue;
      if (network.internal || !isPrivateIpv4(network.address) || !network.cidr) continue;

      const prefix = Number(network.cidr.split('/')[1]);
      if (prefix < 24 || prefix > 30) {
        broadNetwork = network.cidr;
        continue;
      }

      const address = ipv4ToNumber(network.address);
      const mask = (0xffffffff << (32 - prefix)) >>> 0;
      const baseAddress = (address & mask) >>> 0;
      const networkAddress = [
        baseAddress >>> 24,
        baseAddress >>> 16 & 0xff,
        baseAddress >>> 8 & 0xff,
        baseAddress & 0xff
      ].join('.');
      return `${networkAddress}/${prefix}`;
    }
  }

  if (broadNetwork) {
    throw new Error(`La interfaz usa una subred ${broadNetwork} demasiado amplia para escanearla automáticamente. Indica una subred privada /24 a /30.`);
  }
  throw new Error('No se encontró una interfaz IPv4 privada activa. Indica la subred, por ejemplo: escanear red 192.168.1.0/24.');
}

function scanLocalNetwork(target) {
  const networkTarget = target
    ? validateNetworkTarget(target)
    : getLocalNetworkTarget();
  const nmapPath = process.platform === 'win32' ? 'nmap.exe' : 'nmap';

  let discovery;
  try {
    discovery = execFileSync(nmapPath, ['-sn', '-T4', networkTarget], {
      encoding: 'utf8',
      timeout: 90000,
      maxBuffer: 1024 * 1024
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('No se encontró nmap. Instala nmap para habilitar el escaneo de red.');
    }
    throw new Error(`Falló el descubrimiento de equipos en ${networkTarget}: ${(error.stderr || error.message).trim()}`);
  }

  const hosts = [...discovery.matchAll(/^Nmap scan report for (.+)$/gm)]
    .map(([, host]) => {
      const address = host.match(/\(((?:\d{1,3}\.){3}\d{1,3})\)$/)?.[1] || host;
      return address.match(/^(?:\d{1,3}\.){3}\d{1,3}$/) ? address : null;
    })
    .filter((address, index, addresses) => address && addresses.indexOf(address) === index);

  if (!hosts.length) {
    return `Subred analizada: ${networkTarget}\nNo se detectaron equipos activos.`;
  }

  let osDetails;
  try {
    osDetails = execFileSync(nmapPath, ['-O', '--osscan-guess', '-T4', ...hosts], {
      encoding: 'utf8',
      timeout: 90000,
      maxBuffer: 1024 * 1024
    });
  } catch (error) {
    const detail = (error.stderr || error.message).trim();
    return `Subred analizada: ${networkTarget}\nEquipos activos (${hosts.length}):\n${hosts.map((host) => `- ${host} — sistema operativo no detectado`).join('\n')}\n\nNmap no pudo identificar los sistemas operativos: ${detail}\nEn Linux, la detección de SO puede requerir ejecutar SlQ con permisos de administrador.`;
  }

  const hostReports = osDetails.split(/^Nmap scan report for /m).slice(1);
  const summaries = hostReports.map((report) => {
    const address = report.match(/^(.+)/)?.[1]?.trim() || 'Host desconocido';
    const operatingSystem = report.match(/^(?:Running|OS details):\s*(.+)$/m)?.[1]?.trim() ||
      'Sistema operativo no identificado';
    return `- ${address}: ${operatingSystem}`;
  });

  return `Subred analizada: ${networkTarget}\nEquipos activos (${hosts.length}):\n${summaries.length ? summaries.join('\n') : hosts.map((host) => `- ${host}: Sistema operativo no identificado`).join('\n')}`;
}

function connectToHost(target, port = 80, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const host = String(target || '').trim();
    const hostPort = Number(port || 80);

    if (!host) {
      resolve({ success: false, output: 'No se especificó un host o dirección para conectar.' });
      return;
    }

    const done = (success, output) => {
      if (!socket.destroyed) socket.destroy();
      resolve({ success, output });
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true, `Conexión establecida con ${host}:${hostPort}.`));
    socket.once('timeout', () => done(false, `Tiempo de espera agotado al conectar a ${host}:${hostPort}.`));
    socket.once('error', (error) => done(false, `Error de conexión con ${host}:${hostPort}: ${error.message}`));
    socket.connect(hostPort, host);
  });
}

module.exports = {
  getHardwareInventory,
  getSoftwareInventory,
  summarizeHardware,
  summarizeSoftware,
  validateNetworkTarget,
  getLocalNetworkTarget,
  scanLocalNetwork,
  connectToHost
};
