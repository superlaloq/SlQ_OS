const fs = require('fs');
const path = require('path');
const { parseAndExecuteSlQ, slqContext } = require('./slqParser');

const c = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  gray: "\x1b[90m"
};

function splitScriptArguments(input) {
  const tokens = [];
  let current = '';
  let quote = null;

  for (const char of input.trim()) {
    if ((char === '"' || char === "'") && (quote === null || quote === char)) {
      quote = quote === char ? null : char;
      current += char;
      continue;
    }

    if (/\s/.test(char) && quote === null) {
      if (current.trim()) {
        tokens.push(current.trim());
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    tokens.push(current.trim());
  }

  return tokens;
}

async function runSlQScript(scriptPathWithArgs, rootDirectory = process.cwd()) {
  // Separar el nombre del script y los argumentos pasados
  const tokens = splitScriptArguments(scriptPathWithArgs);
  const scriptName = tokens[0].replace(/^["']|["']$/g, '');
  const args = tokens.slice(1);

  const fullPath = path.resolve(rootDirectory, scriptName);

  if (!fs.existsSync(fullPath)) {
    return {
      success: false,
      output: `${c.red}[SlQ Script Error]: Archivo '${scriptName}' no encontrado.${c.reset}`
    };
  }

  // Asignar variables de argumentos en slqContext ($0, $1, $2...)
  slqContext['$0'] = scriptName;
  args.forEach((arg, idx) => {
    slqContext[`$${idx + 1}`] = arg.replace(/^["']|["']$/g, '');
  });

  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');

  let logs = [`${c.cyan}=== Ejecutando Script: ${scriptName} ===${c.reset}`];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();

    if (!rawLine || rawLine.startsWith('#')) continue;

    // Reemplazar tokens $1, $2... por sus valores en el contexto si aplican
    let lineToExecute = rawLine;
    Object.keys(slqContext).forEach((key) => {
      if (key.startsWith('$')) {
        const regex = new RegExp(`\\${key}\\b`, 'g');
        lineToExecute = lineToExecute.replace(regex, slqContext[key]);
      }
    });

    const res = await parseAndExecuteSlQ(lineToExecute);
    if (res.handled) {
      logs.push(`${c.gray}[Línea ${i + 1}]:${c.reset} ${res.output}`);
      if (typeof res.type === 'string' && res.type.endsWith('_ERROR')) {
        return { success: false, output: logs.join('\n') };
      }
    } else {
      logs.push(`${c.red}[Línea ${i + 1}]: Instrucción SlQ no reconocida: ${rawLine}${c.reset}`);
      return { success: false, output: logs.join('\n') };
    }
  }

  logs.push(`${c.cyan}================================================${c.reset}`);

  return {
    success: true,
    output: logs.join('\n')
  };
}

module.exports = { runSlQScript };
