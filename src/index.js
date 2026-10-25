#!/usr/bin/env node
const readline = require('readline');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { askOllama, askOnlineAI, isOnlineAIConfigured } = require('@slq/ia');
const { executeAction } = require('./executor');
const { checkQuickCommand } = require('./fastInterpreter');
const { parseAndExecuteSlQ } = require('./slqParser');
const { createWebServer } = require('./web/server');
const { getWebCredentials, getWebCredentialsFromFile } = require('./web/auth');
const { generateSystemDashboard } = require('./web/systemDashboard');
const { parseAIResponse, validateGeneratedScript } = require('./aiResponse');

// --- Paleta de Colores ANSI ---
const c = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
  bgCyan: "\x1b[46m\x1b[30m",
  bgGreen: "\x1b[42m\x1b[30m",
  bgMagenta: "\x1b[45m\x1b[30m",
  bgYellow: "\x1b[43m\x1b[30m"
};

let httpServer = null;

const standaloneWebServer = process.argv.includes('--web-server');
const webServerManagedSeparately = process.argv.includes('--no-web-server');
const rl = standaloneWebServer ? null : readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const SYSTEM_PROMPT = `Eres SlQ-AI, asistente del intérprete SlQ-OS. Responde siempre con un único objeto JSON válido, sin Markdown ni texto adicional.
Para conversar usa {"type":"CHAT","response":"respuesta breve en español"}.
Para crear un programa usa {"type":"CREATE_SLQ_SCRIPT","filename":"nombre_seguro.slq","explanation":"descripción","code":"imprimir \\"Hola\\""}.
Para sugerir un comando usa {"type":"EXECUTE_COMMAND","command":"comando","explanation":"motivo"}.
REGLAS DE SlQ:
- Los scripts son archivos .slq, NO SQL. Nunca escribas SELECT, tablas SQL ni sintaxis de otro lenguaje.
- Usa únicamente instrucciones SlQ como imprimir, definir, obtener, escanear, conectar, ejecutarBash y cargar.
- Para descubrir equipos de la red local y sus posibles sistemas operativos, crea un script con la línea exacta "escanear red". Se puede indicar una subred privada pequeña, por ejemplo "escanear red 192.168.1.0/24". No inventes tablas, datos ni resultados.
- Un script debe ser código SlQ válido, con una instrucción por línea. No declares que el escaneo garantiza detectar el SO; la identificación puede requerir permisos y no siempre es posible.
- Usa nombres de archivo sencillos con letras, números, guion o guion bajo y extensión .slq.`;

function showHeader() {
  const freeMem = Math.round(os.freemem() / 1024 / 1024);
  const totalMem = Math.round(os.totalmem() / 1024 / 1024);
  console.log(`\n${c.cyan}====================================================${c.reset}`);
  console.log(`${c.bright}${c.magenta}=== SlQ-OS Shell v0.7.4 ${c.gray}(Dynamic Report Web Engine)${c.magenta} ===${c.reset}`);
  console.log(`${c.gray}Sistema:${c.reset} ${c.yellow}${os.platform()} (${os.arch()})${c.reset} | ${c.gray}RAM Libre:${c.reset} ${c.green}${freeMem}MB${c.reset} / ${totalMem}MB`);
  console.log(`${c.cyan}====================================================${c.reset}\n`);
}

function askConfirmation(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function askSystemAI(prompt, systemPrompt) {
  if (!isOnlineAIConfigured()) {
    return askOllama(prompt, systemPrompt);
  }

  try {
    return await askOnlineAI(prompt, systemPrompt);
  } catch (error) {
    console.log(`${c.yellow}[SlQ-AI]: IA online no disponible (${error.message}); se intentará con Ollama local.${c.reset}`);
    return askOllama(prompt, systemPrompt);
  }
}

function startWebServer(port = Number(process.env.PORT || 3000)) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('PORT debe ser un número entero entre 1 y 65535.');
    return null;
  }

  let credentials;
  try {
    const hasEnvironmentCredentials = [
      'SLQ_WEB_USER',
      'SLQ_WEB_PASSWORD_SALT',
      'SLQ_WEB_PASSWORD_HASH'
    ].some((key) => Object.hasOwn(process.env, key));
    credentials = hasEnvironmentCredentials
      ? getWebCredentials()
      : getWebCredentialsFromFile();
  } catch (error) {
    console.error(`No se pudo iniciar el servidor web: ${error.message}`);
    console.error('Configura la autenticación ejecutando sudo ./scripts/install-web-service.sh.');
    return null;
  }

  let server;
  try {
    server = createWebServer(process.cwd(), { credentials });
  } catch (error) {
    console.error(`No se pudo preparar el servidor web: ${error.message}`);
    return null;
  }
  httpServer = server;
  server.on('error', (error) => {
    console.error(`No se pudo iniciar el servidor web en el puerto ${port}: ${error.message}`);
    if (error.code === 'EADDRINUSE') {
      console.error('Puede que el servicio SlQ-OS Web ya esté ejecutándose en ese puerto.');
    }
    if (httpServer === server) httpServer = null;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`SlQ-OS Web disponible en http://localhost:${port}`);
  });
  return server;
}

function promptUser() {
  const username = os.userInfo().username;
  const promptText = `${c.green}${username}${c.reset}${c.gray}@${c.reset}${c.magenta}SlQ${c.reset}:${c.cyan}~$ ${c.reset}`;

  rl.question(promptText, async (input) => {
    const trimmed = input.trim();
    if (!trimmed) return promptUser();

    if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'salir') {
      if (httpServer) httpServer.close();
      console.log(`${c.yellow}Cerrando SlQ-OS Shell... ¡Hasta pronto!${c.reset}`);
      rl.close();
      return;
    }

    // Atajo Instantáneo: servidorWeb / servidor [puerto]
    const serverMatch = trimmed.match(/^(?:servidorWeb|servidor)(?:\s+(\d+))?$/i);
    if (serverMatch) {
      const port = parseInt(serverMatch[1] || '3000', 10);

      if (httpServer) {
        console.log(`\n${c.yellow}[SlQ HTTP]: El servidor ya está corriendo en el puerto http://localhost:${httpServer.address().port}${c.reset}\n`);
        return promptUser();
      }

      httpServer = createWebServer();
      httpServer.on('error', (error) => {
        console.log(`\n${c.red}[SlQ HTTP]: No se pudo iniciar el servidor: ${error.message}${c.reset}\n`);
        httpServer = null;
      });

      httpServer.listen(port, '127.0.0.1', () => {
        console.log(`\n${c.bgGreen} SERVIDOR WEB ${c.reset} Corriendo en ${c.bright}${c.cyan}http://localhost:${port}${c.reset}`);
        console.log(`${c.gray}Frontweb y archivos SlQ-OS listos para recibir peticiones HTTP.${c.reset}\n`);
      });

      return promptUser();
    }

    // Atajo Instantáneo: crearWeb / crearHtml
    if (/^(?:crearWeb|crearHtml)$/i.test(trimmed)) {
      generateSystemDashboard();
      console.log(`\n${c.bgGreen} INSTANTÁNEO ${c.reset} Archivo '${c.bright}index.html${c.reset}' generado con el contenido de '${c.yellow}reporte_equipo.txt${c.reset}'.`);
      return promptUser();
    }

    // Atajo Instantáneo: abrirWeb [archivo.html]
    const openMatch = trimmed.match(/^(?:abrirWeb|abrirHtml)(?:\s+(.+\.html?))?$/i);
    if (openMatch) {
      const targetFile = openMatch[1] || 'index.html';
      const fullPath = path.resolve(process.cwd(), targetFile);

      if (!fs.existsSync(fullPath)) {
        console.log(`\n${c.red}[SlQ Error]: El archivo '${targetFile}' no existe. Ejecuta 'crearWeb' primero.${c.reset}\n`);
        return promptUser();
      }

      const platform = os.platform();
      let openCmd = `xdg-open "${fullPath}"`;
      if (platform === 'win32') openCmd = `start "" "${fullPath}"`;
      if (platform === 'darwin') openCmd = `open "${fullPath}"`;

      exec(openCmd, (err) => {
        if (err) {
          console.log(`\n${c.red}[SlQ Error]: No se pudo abrir el navegador: ${err.message}${c.reset}\n`);
        } else {
          console.log(`\n${c.bgCyan} NAVEGADOR ${c.reset} Abriendo '${c.bright}${targetFile}${c.reset}' en el navegador predeterminado...\n`);
        }
      });
      return promptUser();
    }

    // Atajo Instantáneo: crearScript <nombre.slq>
    const matchQuickScript = trimmed.match(/^crearScript\s+(.+\.slq)$/i);
    if (matchQuickScript) {
      const fileName = matchQuickScript[1];
      const template = `# Script ${fileName}\ndefinir rol = "Admin"\nobtener memoria\nsi rol == "Admin" entonces imprimir rol\n`;
      fs.writeFileSync(path.resolve(process.cwd(), fileName), template, 'utf-8');
      console.log(`\n${c.bgGreen} INSTANTÁNEO ${c.reset} Archivo '${c.bright}${fileName}${c.reset}' creado con éxito.`);
      const runRes = await parseAndExecuteSlQ(`cargar ${fileName}`);
      console.log(runRes.output + '\n');
      return promptUser();
    }

    // Nivel 1: Sintaxis Nativa SlQ
    const slqResult = await parseAndExecuteSlQ(trimmed);
    if (slqResult.handled) {
      console.log(slqResult.output + '\n');
      return promptUser();
    }

    // Nivel 2: Comandos Rápidos Linux
    const quick = checkQuickCommand(trimmed);
    if (quick.isQuick) {
      if (quick.action === 'CLEAR') {
        console.clear();
        showHeader();
        return promptUser();
      }

      console.log(`\n${c.bgCyan} NATIVO LINUX ${c.reset} ${c.bright}${quick.command}${c.reset}`);
      const result = await executeAction({ type: 'EXECUTE_COMMAND', command: quick.command });
      console.log(`${c.gray}--- Salida ---${c.reset}`);
      console.log(result.output.trim());
      console.log(`${c.gray}--------------${c.reset}\n`);
      return promptUser();
    }

    // Nivel 3: Inteligencia SlQ-AI (Optimizada)
    process.stdout.write(`${c.yellow}SlQ-AI > Pensando...${c.reset}`);
    
    try {
      const rawResponse = await askSystemAI(trimmed, SYSTEM_PROMPT);

      readline.cursorTo(process.stdout, 0);
      readline.clearLine(process.stdout, 0);

      const parsed = parseAIResponse(rawResponse);

      if (parsed.type === 'CREATE_SLQ_SCRIPT') {
        const { filename: fileName, code } = validateGeneratedScript(parsed);
        console.log(`\n${c.bgMagenta} SCRIPT IA ${c.reset} ${parsed.explanation || 'Programa SlQ'}`);
        console.log(`${c.gray}Target:${c.reset} ${c.bright}${fileName}${c.reset}`);
        console.log(`\n${c.cyan}--- Código .slq ---${c.reset}`);
        console.log(`${c.green}${code}${c.reset}`);
        console.log(`${c.cyan}-------------------${c.reset}\n`);

        const confirmSave = await askConfirmation(`${c.yellow}¿Guardar y ejecutar '${fileName}'? (s/N): ${c.reset}`);

        if (confirmSave === 's' || confirmSave === 'si' || confirmSave === 'y') {
          fs.writeFileSync(path.resolve(process.cwd(), fileName), code, 'utf-8');
          console.log(`\n${c.green}[OK] Script '${fileName}' guardado con éxito.${c.reset}`);

          const runRes = await parseAndExecuteSlQ(`cargar ${fileName}`);
          console.log(`${runRes.output || 'El script no produjo salida.'}\n`);
        } else {
          console.log(`${c.gray}Creación cancelada.${c.reset}\n`);
        }
      } else if (parsed.type === 'EXECUTE_COMMAND') {
        const desc = parsed.explanation || 'Ejecución de comando';
        console.log(`\n${c.bgYellow} ACCIÓN SUGERIDA ${c.reset} ${desc}`);
        console.log(`${c.gray}Bash:${c.reset} ${c.bright}${parsed.command}${c.reset}`);

        const confirm = await askConfirmation(`${c.yellow}¿Ejecutar en el sistema? (s/N): ${c.reset}`);

        if (confirm === 's' || confirm === 'si' || confirm === 'y') {
          console.log(`${c.gray}Ejecutando...${c.reset}`);
          const result = await executeAction(parsed);
          console.log(`\n${c.gray}--- Salida ---${c.reset}`);
          console.log(result.output.trim());
          console.log(`${c.gray}--------------${c.reset}\n`);
        } else {
          console.log(`${c.gray}Cancelado.${c.reset}\n`);
        }
      } else if (typeof parsed.response === 'string') {
        console.log(`${c.magenta}SlQ-AI >${c.reset} ${parsed.response}\n`);
      } else {
        throw new Error('La IA respondió con un tipo de mensaje desconocido.');
      }
    } catch (e) {
      readline.cursorTo(process.stdout, 0);
      readline.clearLine(process.stdout, 0);
      console.log(`${c.red}SlQ-AI Error > ${e.message}${c.reset}\n`);
    }

    promptUser();
  });
}

if (standaloneWebServer) {
  const port = Number(process.env.PORT || 3000);
  const server = startWebServer(port);
  if (!server) process.exitCode = 1;
  else server.on('error', () => { process.exitCode = 1; });
} else {
  showHeader();
  if (!webServerManagedSeparately) startWebServer();
  promptUser();
}
