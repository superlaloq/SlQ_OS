const { exec, execSync } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { summarizeHardware, summarizeSoftware, scanLocalNetwork, connectToHost } = require('./systemScanner');
const { askOnlineAI } = require('@slq/ia');
const { generateSystemDashboard } = require('./web/systemDashboard');

const slqContext = {};

const c = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
  magenta: "\x1b[35m"
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveVariables(text) {
  if (typeof text !== 'string') return text;
  let resolved = text.replace(/\$([a-zA-Z0-9_]+)/g, (match, varName) => {
    return slqContext[varName] !== undefined ? slqContext[varName] : match;
  });
  return resolved.replace(/\\n/g, '\n');
}

function normalizeSlqValue(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';

  const quote = trimmed[0];
  if ((quote === '"' || quote === "'") && trimmed.length >= 2 && trimmed.endsWith(quote)) {
    return resolveVariables(trimmed.slice(1, -1));
  }

  return resolveVariables(trimmed);
}

function parseJsonArrayVariable(varName) {
  const value = slqContext[varName];
  if (value === undefined) {
    return { error: `La variable '${varName}' no está definida.` };
  }

  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch (error) {
      return { error: `La variable '${varName}' no contiene JSON válido: ${error.message}` };
    }
  }

  if (!Array.isArray(parsed)) {
    return { error: `La variable '${varName}' debe contener un array JSON.` };
  }

  return { value: parsed };
}

function getJsonField(item, fieldPath) {
  if (item === null || typeof item !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(item, fieldPath)) return item[fieldPath];

  return fieldPath.split('.').reduce((value, field) => {
    if (value === null || typeof value !== 'object') return undefined;
    return value[field];
  }, item);
}

function parseJsonFilterValue(rawValue) {
  const trimmed = rawValue.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return normalizeSlqValue(trimmed);
  }

  const resolved = resolveVariables(trimmed);
  try {
    return JSON.parse(resolved);
  } catch (_error) {
    return resolved;
  }
}

function evaluateCondition(left, op, right) {
  const valLeft = slqContext[left] !== undefined ? slqContext[left] : left.replace(/^["']|["']$/g, '');
  const valRight = slqContext[right] !== undefined ? slqContext[right] : right.replace(/^["']|["']$/g, '');

  switch (op) {
    case '==': return valLeft == valRight;
    case '!=': return valLeft != valRight;
    case '>':  return parseFloat(valLeft) > parseFloat(valRight);
    case '<':  return parseFloat(valLeft) < parseFloat(valRight);
    case '>=': return parseFloat(valLeft) >= parseFloat(valRight);
    case '<=': return parseFloat(valLeft) <= parseFloat(valRight);
    default: return false;
  }
}

function getDiskStatus() {
  const isWin = os.platform() === 'win32';
  try {
    if (isWin) {
      const out = execSync('powershell "Get-PSDrive -PSProvider FileSystem | Select-Name, @{Name=\'FreeGB\';Expression={[math]::round($_.Free/1GB,2)}}, @{Name=\'UsedGB\';Expression={[math]::round($_.Used/1GB,2)}}"', { encoding: 'utf-8' });
      return out.trim();
    } else {
      const out = execSync('df -h .', { encoding: 'utf-8' }).trim();
      return out;
    }
  } catch (e) {
    return 'No se pudo obtener el estado del disco: ' + e.message;
  }
}

async function parseAndExecuteSlQ(input) {
  const line = input.trim();

  if (line.toLowerCase() === 'fin' || line.toLowerCase() === 'end') {
    return { handled: true, type: 'SLQ_NOP', output: `${c.gray}[SlQ Ignorado]: Fin de bloque${c.reset}` };
  }

  const onlineAIMatch = line.match(/^consultarIAInternet\s+(.+)$/i);
  if (onlineAIMatch) {
    const prompt = normalizeSlqValue(onlineAIMatch[1]);
    try {
      const answer = await askOnlineAI(prompt, 'Responde en español, con claridad y precisión.');
      return { handled: true, type: 'SLQ_AI_ONLINE', output: `${c.green}[SlQ IA Online]:${c.reset} ${answer}` };
    } catch (error) {
      return { handled: true, type: 'SLQ_AI_ONLINE_ERROR', output: `${c.red}[SlQ IA Online Error]: ${error.message}${c.reset}` };
    }
  }

  const filterJsonMatch = line.match(/^filtrarJson\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+(.+?)\s+(.+?)\s+en\s+([a-zA-Z_][a-zA-Z0-9_]*)$/i);
  if (filterJsonMatch) {
    const [, sourceName, rawField, rawValue, destination] = filterJsonMatch;
    const source = parseJsonArrayVariable(sourceName);
    if (source.error) {
      return { handled: true, type: 'SLQ_JSON_ERROR', output: `${c.red}[SlQ JSON Error]: ${source.error}${c.reset}` };
    }

    const field = normalizeSlqValue(rawField);
    if (!field) {
      return { handled: true, type: 'SLQ_JSON_ERROR', output: `${c.red}[SlQ JSON Error]: El campo de filtrado no puede estar vacío.${c.reset}` };
    }

    const expected = parseJsonFilterValue(rawValue);
    const filtered = source.value.filter((item) => getJsonField(item, field) === expected);
    slqContext[destination] = JSON.stringify(filtered);
    return {
      handled: true,
      type: 'SLQ_JSON_FILTER',
      output: `${c.green}[SlQ JSON]: ${filtered.length} elemento(s) guardado(s) en '${destination}'.${c.reset}`
    };
  }

  const mapJsonMatch = line.match(/^mapearJson\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+(.+?)\s+en\s+([a-zA-Z_][a-zA-Z0-9_]*)$/i);
  if (mapJsonMatch) {
    const [, sourceName, rawField, destination] = mapJsonMatch;
    const source = parseJsonArrayVariable(sourceName);
    if (source.error) {
      return { handled: true, type: 'SLQ_JSON_ERROR', output: `${c.red}[SlQ JSON Error]: ${source.error}${c.reset}` };
    }

    const field = normalizeSlqValue(rawField);
    if (!field) {
      return { handled: true, type: 'SLQ_JSON_ERROR', output: `${c.red}[SlQ JSON Error]: El campo a extraer no puede estar vacío.${c.reset}` };
    }

    const mapped = source.value.map((item) => {
      const value = getJsonField(item, field);
      return value === undefined ? null : value;
    });
    slqContext[destination] = JSON.stringify(mapped);
    return {
      handled: true,
      type: 'SLQ_JSON_MAP',
      output: `${c.green}[SlQ JSON]: ${mapped.length} valor(es) guardado(s) en '${destination}'.${c.reset}`
    };
  }

  const executeBashMatch = line.match(/^ejecutarBash\s+(.+)\s+en\s+([a-zA-Z_][a-zA-Z0-9_]*)$/i);
  if (executeBashMatch) {
    const command = normalizeSlqValue(executeBashMatch[1]);
    const destination = executeBashMatch[2];
    if (!command) {
      return { handled: true, type: 'SLQ_BASH_ERROR', output: `${c.red}[SlQ Bash Error]: El comando no puede estar vacío.${c.reset}` };
    }

    return new Promise((resolve) => {
      exec(command, { timeout: 15000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
        slqContext[destination] = stdout;
        if (error) {
          const detail = (stderr || error.message).trim();
          const status = error.code === null ? error.signal || 'desconocido' : error.code;
          resolve({
            handled: true,
            type: 'SLQ_BASH_ERROR',
            output: `${c.red}[SlQ Bash Error]: El comando terminó con estado ${status}: ${detail}${c.reset}`
          });
          return;
        }

        resolve({
          handled: true,
          type: 'SLQ_BASH',
          output: `${c.green}[SlQ Bash]: Salida (${stdout.length} caracteres) guardada en '${destination}'.${c.reset}`
        });
      });
    });
  }

  
  // Integration: basuraGmail "<query>"
  const gmailTrashMatch = line.match(/^basuraGmail\s+(.+)$/i);
  if (gmailTrashMatch) {
    const query = gmailTrashMatch[1].trim().replace(/^["']|["']$/g, '');
    try {
      const { moverAPapelera } = require('./gmailService');
      await moverAPapelera(query);
      return { handled: true, type: 'SLQ_GMAIL', output: `[SlQ Gmail]: Solicitud completada para "${query}".` };
    } catch (e) {
      return { handled: true, type: 'SLQ_GMAIL_ERR', output: `[SlQ Gmail Error]: ${e.message}` };
    }
  }

  // 0. Ayuda / Help
  if (/^(?:ayuda|help|\?)$/i.test(line)) {
    const helpBox = `
${c.cyan}┌─────────────────────────────────────────────────────────────────────────────┐${c.reset}
${c.cyan}│${c.reset} ${c.bright}${c.magenta}                     GUÍA DE SINTAXIS NATIVA SlQ-OS                     ${c.reset}${c.cyan}│${c.reset}
${c.cyan}├─────────────────────────────────────────┬───────────────────────────────────┤${c.reset}
${c.cyan}│${c.reset} ${c.bright}${c.yellow}Comando / Instrucción${c.reset}                   ${c.cyan}│${c.reset} ${c.bright}${c.yellow}Descripción / Uso${c.reset}                 ${c.cyan}│${c.reset}
${c.cyan}├─────────────────────────────────────────┼───────────────────────────────────┤${c.reset}
${c.cyan}│${c.reset} ${c.green}limpiar | cls | clear${c.reset}                 ${c.cyan}│${c.reset} Limpia la pantalla de la terminal${c.cyan}│${c.reset}
${c.cyan}│${c.reset} ${c.green}crearWeb | crearHtml${c.reset}                 ${c.cyan}│${c.reset} Genera portal web con el reporte ${c.cyan}│${c.reset}
${c.cyan}│${c.reset} ${c.green}variables | info${c.reset}                     ${c.cyan}│${c.reset} Lista las variables en memoria   ${c.cyan}│${c.reset}
${c.cyan}│${c.reset} ${c.green}limpiarVariables | resetVariables${c.reset}     ${c.cyan}│${c.reset} Vacía la memoria de variables    ${c.cyan}│${c.reset}
${c.cyan}│${c.reset} ${c.green}esperar <ms> | sleep <ms>${c.reset}             ${c.cyan}│${c.reset} Pausa la ejecución por X miliseg${c.cyan}│${c.reset}
${c.cyan}│${c.reset} ${c.green}definir <var> = "<valor>"${c.reset}              ${c.cyan}│${c.reset} Asigna valor a una variable      ${c.cyan}│${c.reset}
${c.cyan}│${c.reset} ${c.green}ver <var>${c.reset}                               ${c.cyan}│${c.reset} Muestra el valor de una variable ${c.cyan}│${c.reset}
${c.cyan}│${c.reset} ${c.green}imprimir "<texto>"${c.reset}                     ${c.cyan}│${c.reset} Imprime un texto o variable ($var)${c.cyan}│${c.reset}
${c.cyan}│${c.reset} ${c.green}sumar <var> <num>${c.reset}                       ${c.cyan}│${c.reset} Incrementa valor numérico        ${c.cyan}│${c.reset}
${c.cyan}│${c.reset} ${c.green}obtener memoria | sistema | red | disco${c.reset} ${c.cyan}│${c.reset} Datos de RAM, SO, Red o Disco    ${c.cyan}│${c.reset}
${c.cyan}│${c.reset} ${c.green}obtener ip en <var>${c.reset}                   ${c.cyan}│${c.reset} Guarda la IP activa en variable  ${c.cyan}│${c.reset}
${c.cyan}│${c.reset} ${c.green}obtener disco en <var>${c.reset}                ${c.cyan}│${c.reset} Carga el reporte de disco en var ${c.cyan}│${c.reset}
${c.cyan}│${c.reset} ${c.green}escanear hardware${c.reset}                       ${c.cyan}│${c.reset} Detecta CPU, RAM, discos y red   ${c.cyan}│${c.reset}
${c.cyan}│${c.reset} ${c.green}escanear red [CIDR]${c.reset}                     ${c.cyan}│${c.reset} Detecta equipos y posibles SO    ${c.cyan}│${c.reset}
${c.cyan}│${c.reset} ${c.green}escanear software${c.reset}                       ${c.cyan}│${c.reset} Lista paquetes y binaries activos${c.cyan}│${c.reset}
${c.cyan}│${c.reset} ${c.green}conectar <host> [puerto]${c.reset}                ${c.cyan}│${c.reset} Prueba conexión TCP al destino ${c.cyan}│${c.reset}
${c.cyan}│${c.reset} ${c.green}consultarIAInternet "<pregunta>"${c.reset}          ${c.cyan}│${c.reset} Consulta la IA remota configurada${c.cyan}│${c.reset}
${c.cyan}│${c.reset} ${c.green}filtrarJson <var> <campo> <valor> en <dest>${c.reset} ${c.cyan}│${c.reset} Filtra un array JSON por campo   ${c.cyan}│${c.reset}
${c.cyan}│${c.reset} ${c.green}mapearJson <var> <campo> en <dest>${c.reset}      ${c.cyan}│${c.reset} Extrae un campo de cada objeto   ${c.cyan}│${c.reset}
${c.cyan}│${c.reset} ${c.green}ejecutarBash "<cmd>" en <dest>${c.reset}          ${c.cyan}│${c.reset} Ejecuta comando host y captura   ${c.cyan}│${c.reset}
${c.cyan}│${c.reset} ${c.green}obtenerProcesos${c.reset}                          ${c.cyan}│${c.reset} Lista top 10 procesos por RAM    ${c.cyan}│${c.reset}
${c.cyan}│${c.reset} ${c.green}matarProceso <PID|Nombre>${c.reset}                ${c.cyan}│${c.reset} Finaliza una tarea activa        ${c.cyan}│${c.reset}
${c.cyan}│${c.reset} ${c.green}guardarTexto "<txt>" en "<file>"${c.reset}        ${c.cyan}│${c.reset} Escribe datos en un archivo      ${c.cyan}│${c.reset}
${c.cyan}│${c.reset} ${c.green}leerTexto "<file>" en <var>${c.reset}               ${c.cyan}│${c.reset} Carga archivo en variable        ${c.cyan}│${c.reset}
${c.cyan}│${c.reset} ${c.green}eliminarArchivo "<file>"${c.reset}                 ${c.cyan}│${c.reset} Borra un archivo de disco        ${c.cyan}│${c.reset}
${c.cyan}│${c.reset} ${c.green}si <cond> entonces <cmd>${c.reset}                 ${c.cyan}│${c.reset} Condición simple (==, !=, >, <)   ${c.cyan}│${c.reset}
${c.cyan}│${c.reset} ${c.green}mientras <cond> hacer <cmd>${c.reset}              ${c.cyan}│${c.reset} Bucle de repetición              ${c.cyan}│${c.reset}
${c.cyan}│${c.reset} ${c.green}cargar <script.slq> [arg1] [arg2]${c.reset}        ${c.cyan}│${c.reset} Ejecuta script con argumentos ($1)${c.cyan}│${c.reset}
${c.cyan}└─────────────────────────────────────────┴───────────────────────────────────┘${c.reset}`;
    return { handled: true, type: 'SLQ_HELP', output: helpBox };
  }

  // 1. Sintaxis Nativa: limpiar / cls / clear
  if (/^(?:limpiar|cls|clear)$/i.test(line)) {
    process.stdout.write('\x1b[2J\x1b[0;0H');
    return { handled: true, type: 'SLQ_CLEAR', output: `${c.gray}[SlQ Console]: Pantalla limpia.${c.reset}` };
  }

  // 2. Sintaxis Nativa: crearWeb / crearHtml
  if (/^(?:crearWeb|crearHtml)$/i.test(line)) {
    generateSystemDashboard();
    return { handled: true, type: 'SLQ_WEB_GEN', output: `${c.green}[SlQ Web]: Archivo 'index.html' actualizado dinámicamente con el reporte.${c.reset}` };
  }

  // 3. Sintaxis Nativa: esperar / sleep / pausa <milisegundos>
  const sleepMatch = line.match(/^(?:esperar|sleep|pausa)\s+(\d+)$/i);
  if (sleepMatch) {
    const ms = parseInt(sleepMatch[1], 10);
    await delay(ms);
    return { handled: true, type: 'SLQ_SLEEP', output: `${c.yellow}[SlQ Timer]: Pausa de ${ms}ms finalizada.${c.reset}` };
  }

  // 4. Sintaxis Nativa: variables / info / verVariables
  if (/^(?:variables|info|verVariables)$/i.test(line)) {
    const keys = Object.keys(slqContext);
    if (keys.length === 0) {
      return { handled: true, type: 'SLQ_VARS', output: `${c.yellow}[SlQ Context]: No hay variables definidas en memoria.${c.reset}` };
    }

    let varLogs = [`${c.cyan}[SlQ Context]: Variables activas en memoria (${keys.length}):${c.reset}\n`];
    keys.forEach((key) => {
      varLogs.push(`  • ${c.bright}${c.green}${key}${c.reset} = ${c.yellow}"${slqContext[key]}"${c.reset}`);
    });

    return { handled: true, type: 'SLQ_VARS', output: varLogs.join('\n') };
  }

  // 5. Sintaxis Nativa: limpiarVariables / resetVariables / borrarVariables
  if (/^(?:limpiarVariables|resetVariables|borrarVariables)$/i.test(line)) {
    const count = Object.keys(slqContext).length;
    for (const key in slqContext) {
      delete slqContext[key];
    }
    return { handled: true, type: 'SLQ_VARS_RESET', output: `${c.yellow}[SlQ Context]: Memoria de variables reseteada a cero (${count} variable(s) eliminada(s)).${c.reset}` };
  }

  // 6. Sintaxis Nativa: obtener disco en <variable>
  const getDiskVarMatch = line.match(/^obtener\s+disco\s+en\s+([a-zA-Z0-9_]+)$/i);
  if (getDiskVarMatch) {
    const varDest = getDiskVarMatch[1].trim();
    const diskInfo = getDiskStatus();
    slqContext[varDest] = diskInfo;
    return {
      handled: true,
      type: 'SLQ_DISK_VAR',
      output: `${c.cyan}[SlQ Disco]: Reporte de almacenamiento guardado en variable '${varDest}'.${c.reset}`
    };
  }

  // 7. Sintaxis Nativa: obtenerProcesos
  if (/^(?:obtenerProcesos|obtener\s+procesos|procesos|ver\s+procesos)$/i.test(line)) {
    try {
      const cmd = os.platform() === 'win32' 
        ? 'tasklist /FO TABLE /NH' 
        : 'ps aux --sort=-%mem | head -n 10';
      const output = execSync(cmd, { encoding: 'utf-8' }).trim();
      return { handled: true, type: 'SLQ_PROC_LIST', output: `${c.cyan}[SlQ Procesos]: Top 10 procesos por uso de RAM:${c.reset}\n\n${c.gray}${output}${c.reset}` };
    } catch (e) {
      return { handled: true, type: 'SLQ_PROC_ERROR', output: `${c.red}[SlQ Error]: No se pudieron obtener procesos: ${e.message}${c.reset}` };
    }
  }

  // 8. Sintaxis Nativa: matarProceso <PID|Nombre>
  const killMatch = line.match(/^matarProceso\s+(.+)$/i);
  if (killMatch) {
    let target = killMatch[1].trim().replace(/^["']|["']$/g, '');
    if (slqContext[target] !== undefined) target = slqContext[target];

    try {
      if (/^\d+$/.test(target)) {
        process.kill(parseInt(target, 10), 'SIGTERM');
        return { handled: true, type: 'SLQ_PROC_KILL', output: `${c.green}[SlQ Procesos]: Proceso PID ${target} terminado.${c.reset}` };
      } else {
        const killCmd = os.platform() === 'win32' ? `taskkill /F /IM ${target}*` : `pkill -f ${target}`;
        execSync(killCmd);
        return { handled: true, type: 'SLQ_PROC_KILL', output: `${c.green}[SlQ Procesos]: Proceso(s) '${target}' terminado(s).${c.reset}` };
      }
    } catch (e) {
      return { handled: true, type: 'SLQ_PROC_ERROR', output: `${c.red}[SlQ Error]: No se pudo terminar '${target}'.${c.reset}` };
    }
  }

  // 8.1. Sintaxis Nativa: escanear hardware | escanear software | conectar <host> [puerto]
  const scanHardwareMatch = line.match(/^(?:escanear|scanner|detectar)\s+(?:hardware|equipo|dispositivos)$/i);
  if (scanHardwareMatch) {
    const report = summarizeHardware();
    return { handled: true, type: 'SLQ_HW_SCAN', output: `${c.cyan}[SlQ Hardware]: Inventario detectado:${c.reset}

${c.gray}${report}${c.reset}` };
  }

  const scanNetworkMatch = line.match(/^(?:escanear|scanner|detectar)\s+red(?:\s+(\S+))?$/i);
  if (scanNetworkMatch) {
    try {
      const report = scanLocalNetwork(scanNetworkMatch[1]);
      return { handled: true, type: 'SLQ_NET_SCAN', output: `${c.cyan}[SlQ Red]: Escaneo autorizado de red local:${c.reset}\n\n${report}` };
    } catch (error) {
      return { handled: true, type: 'SLQ_NET_SCAN_ERROR', output: `${c.red}[SlQ Red Error]: ${error.message}${c.reset}` };
    }
  }

  const scanSoftwareMatch = line.match(/^(?:escanear|scanner|detectar)\s+(?:software|programas|aplicaciones)$/i);
  if (scanSoftwareMatch) {
    const report = summarizeSoftware();
    return { handled: true, type: 'SLQ_SW_SCAN', output: `${c.green}[SlQ Software]: Paquetes binarios detectados:${c.reset}

${c.gray}${report}${c.reset}` };
  }

  const connectMatch = line.match(/^(?:conectar|connect)\s+([^\s]+)(?:\s+(\d+))?$/i);
  if (connectMatch) {
    const target = connectMatch[1].trim();
    const port = connectMatch[2] ? parseInt(connectMatch[2], 10) : 80;
    const result = await connectToHost(target, port, 2500);
    return { handled: true, type: 'SLQ_CONNECT', output: `${result.success ? c.green : c.red}[SlQ Conexión]: ${result.output}${c.reset}` };
  }

  // 9. Sintaxis Nativa: eliminarArchivo "archivo.txt"
  const delMatch = line.match(/^eliminarArchivo\s+(.+)$/i);
  if (delMatch) {
    let fileName = normalizeSlqValue(delMatch[1]);
    const fullPath = path.resolve(process.cwd(), fileName);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return { handled: true, type: 'SLQ_FILE_DEL', output: `${c.yellow}[SlQ Disco]: Archivo '${fileName}' eliminado.${c.reset}` };
    }
    return { handled: true, type: 'SLQ_FILE_ERROR', output: `${c.red}[SlQ Disco]: Archivo '${fileName}' no encontrado.${c.reset}` };
  }

  // 10. Sintaxis Nativa: guardarTexto "contenido" en "archivo.txt"
  const saveMatch = line.match(/^guardarTexto\s+(.+?)\s+en\s+(.+)$/i);
  if (saveMatch) {
    let rawContent = normalizeSlqValue(saveMatch[1]);
    let fileName = normalizeSlqValue(saveMatch[2]);

    const contentToSave = resolveVariables(rawContent);
    const fullPath = path.resolve(process.cwd(), fileName);
    fs.writeFileSync(fullPath, contentToSave, 'utf-8');

    return {
      handled: true,
      type: 'SLQ_FILE_WRITE',
      output: `${c.green}[SlQ Disco]: Texto guardado en '${fileName}'.${c.reset}`
    };
  }

  // 11. Sintaxis Nativa: leerTexto "archivo.txt" en variableDestino
  const readMatch = line.match(/^leerTexto\s+(.+?)\s+en\s+([a-zA-Z0-9_]+)$/i);
  if (readMatch) {
    let fileName = normalizeSlqValue(readMatch[1]);
    let varDest = readMatch[2].trim();

    const fullPath = path.resolve(process.cwd(), fileName);
    if (!fs.existsSync(fullPath)) {
      return {
        handled: true,
        type: 'SLQ_FILE_ERROR',
        output: `${c.red}[SlQ Error]: El archivo '${fileName}' no existe.${c.reset}`
      };
    }

    const contentRead = fs.readFileSync(fullPath, 'utf-8').trim();
    slqContext[varDest] = contentRead;

    return {
      handled: true,
      type: 'SLQ_FILE_READ',
      output: `${c.cyan}[SlQ Disco]: Archivo '${fileName}' leído -> Variable '${varDest}' cargada.${c.reset}`
    };
  }

  // 12. Sintaxis Nativa: obtener (ip|red) en <variable>
  const getIpVarMatch = line.match(/^obtener\s+(?:ip|red)\s+en\s+([a-zA-Z0-9_]+)$/i);
  if (getIpVarMatch) {
    const varDest = getIpVarMatch[1].trim();
    const nets = os.networkInterfaces();
    let detectedIp = '127.0.0.1';

    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        const family = net.family === 'IPv4' || net.family === 4 ? 'IPv4' : 'IPv6';
        if (family === 'IPv4' && !net.internal) {
          detectedIp = net.address;
          break;
        }
      }
      if (detectedIp !== '127.0.0.1') break;
    }

    slqContext[varDest] = detectedIp;
    return {
      handled: true,
      type: 'SLQ_NET_VAR',
      output: `${c.cyan}[SlQ Red]: Variable '${varDest}' asignada con IP activa "${detectedIp}"${c.reset}`
    };
  }

  // 13. Sintaxis Nativa: mientras <var1> <op> <var2> hacer <comando>
  const whileMatch = line.match(/^mientras\s+(.+?)\s*(==|!=|>|<|>=|<=)\s*(.+?)\s+hacer\s+(.+)$/i);
  if (whileMatch) {
    const left = whileMatch[1];
    const op = whileMatch[2];
    const right = whileMatch[3];
    const action = whileMatch[4];

    let iterations = 0;
    const maxIterations = 100;
    const loopLogs = [];

    while (evaluateCondition(left, op, right) && iterations < maxIterations) {
      iterations++;
      const res = await parseAndExecuteSlQ(action);
      if (res.handled) loopLogs.push(`${c.gray}Iteración ${iterations}:${c.reset} ${res.output}`);
    }

    if (iterations >= maxIterations) {
      loopLogs.push(`${c.red}[SlQ Alerta]: Bucle detenido por seguridad (máx ${maxIterations}).${c.reset}`);
    }

    return {
      handled: true,
      type: 'SLQ_WHILE',
      output: loopLogs.length > 0 ? loopLogs.join('\n') : `${c.yellow}[SlQ Bucle]: Condición falsa, 0 iteraciones.${c.reset}`
    };
  }

  // 14. Sintaxis Nativa: sumar <variable> <cantidad>
  const addMatch = line.match(/^(?:sumar|inc)\s+([a-zA-Z0-9_]+)\s+([0-9]+)$/i);
  if (addMatch) {
    const varName = addMatch[1];
    const increment = parseInt(addMatch[2], 10);
    const currentVal = parseInt(slqContext[varName] || 0, 10);
    slqContext[varName] = currentVal + increment;
    return {
      handled: true,
      type: 'SLQ_MATH',
      output: `${c.magenta}[SlQ Math]: Variable '${varName}' = ${slqContext[varName]}${c.reset}`
    };
  }

  // 15. Sintaxis Nativa: cargar <script.slq> [argumentos...]
  const runMatch = line.match(/^(?:cargar|ejecutarScript)\s+(.+\.slq)(.*)$/i);
  if (runMatch) {
    const scriptPathWithArgs = (runMatch[1] + runMatch[2]).trim();
    const { runSlQScript } = require('./scriptRunner');
    const scriptRes = await runSlQScript(scriptPathWithArgs);
    return {
      handled: true,
      type: scriptRes.success ? 'SLQ_SCRIPT' : 'SLQ_SCRIPT_ERROR',
      output: scriptRes.output || 'El script no produjo salida.'
    };
  }

  // 16. Sintaxis Nativa: definir <variable> = <valor>
  const defMatch = line.match(/^(?:definir\s+)?([a-zA-Z0-9_]+)\s*=\s*(.+)$/i);
  if (defMatch) {
    const varName = defMatch[1];
    let value = defMatch[2].replace(/^["']|["']$/g, '');
    slqContext[varName] = value;
    return { handled: true, type: 'SLQ_DEF', output: `${c.cyan}[SlQ Context]: Variable '${varName}' = "${value}"${c.reset}` };
  }

  // 17. Sintaxis Nativa: ver <variable>
  const printVarMatch = line.match(/^ver\s+([a-zA-Z0-9_]+)$/i);
  if (printVarMatch) {
    const varName = printVarMatch[1];
    const val = slqContext[varName];
    return { handled: true, type: 'SLQ_PRINT', output: val !== undefined ? `${c.green}[SlQ Val]: ${varName} = ${val}${c.reset}` : `${c.red}[SlQ Error]: Variable '${varName}' no definida${c.reset}` };
  }

  // 18. Sintaxis Nativa: imprimir "<texto>"
  const printTextMatch = line.match(/^imprimir\s+(.+)$/i);
  if (printTextMatch) {
    let rawContent = printTextMatch[1].trim().replace(/^["']|["']$/g, '');
    let content = resolveVariables(rawContent);
    return { handled: true, type: 'SLQ_OUT', output: `${c.bright}${c.green}[SlQ Output]: ${content}${c.reset}` };
  }

  // 19. Sintaxis Nativa: obtener <recurso> (memoria | sistema | red | disco)
  const getMatch = line.match(/^obtener\s+(memoria|sistema|red|ip|disco|almacenamiento)$/i);
  if (getMatch) {
    const resource = getMatch[1].toLowerCase();
    
    if (resource === 'memoria') {
      const free = Math.round(os.freemem() / 1024 / 1024);
      const total = Math.round(os.totalmem() / 1024 / 1024);
      return { handled: true, type: 'SLQ_SYS', output: `${c.yellow}[SlQ Status]: RAM ${free}MB libres de ${total}MB${c.reset}` };
    }
    
    if (resource === 'sistema') {
      return { handled: true, type: 'SLQ_SYS', output: `${c.yellow}[SlQ Status]: OS ${os.type()} ${os.release()} (${os.arch()})${c.reset}` };
    }

    if (resource === 'red' || resource === 'ip') {
      const nets = os.networkInterfaces();
      let netLogs = [`${c.cyan}[SlQ Red]: Interfaces e IP activas:${c.reset}\n`];

      for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
          const family = net.family === 'IPv4' || net.family === 4 ? 'IPv4' : 'IPv6';
          const internalStr = net.internal ? `${c.gray}(interna)${c.reset}` : `${c.green}(activa)${c.reset}`;
          netLogs.push(`  • ${c.bright}${name}${c.reset} [${family}]: ${c.yellow}${net.address}${c.reset} MAC: ${c.gray}${net.mac}${c.reset} ${internalStr}`);
        }
      }

      return { handled: true, type: 'SLQ_NET', output: netLogs.join('\n') };
    }

    if (resource === 'disco' || resource === 'almacenamiento') {
      const diskReport = getDiskStatus();
      return { handled: true, type: 'SLQ_DISK', output: `${c.cyan}[SlQ Disco]: Uso de almacenamiento local:${c.reset}\n\n${c.gray}${diskReport}${c.reset}` };
    }
  }

  // 20. Sintaxis Nativa: si <var1> <op> <var2> entonces <comando>
  const ifMatch = line.match(/^si\s+(.+?)\s*(==|!=|>|<|>=|<=)\s*(.+?)\s+entonces\s+(.+)$/i);
  if (ifMatch) {
    const left = ifMatch[1];
    const op = ifMatch[2];
    const right = ifMatch[3];
    const thenAction = ifMatch[4];

    if (evaluateCondition(left, op, right)) {
      const innerResult = await parseAndExecuteSlQ(thenAction);
      return { handled: true, type: 'SLQ_IF_TRUE', output: `${c.green}[SlQ Condición CUMPLIDA]:${c.reset} -> ${innerResult.handled ? innerResult.output : thenAction}` };
    } else {
      return { handled: true, type: 'SLQ_IF_FALSE', output: `${c.gray}[SlQ Condición NO CUMPLIDA]: Ignorada la acción '${thenAction}'${c.reset}` };
    }
  }

  return { handled: false };
}

module.exports = { parseAndExecuteSlQ, slqContext };
