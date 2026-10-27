const { exec } = require('child_process');
const { GoogleGenAI } = require('@google/genai');
const { getApplicationEntries } = require('./applicationManager');

// Inicializar cliente de Gemini si la API Key está configurada
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

function openWebUrl(url, fallbackMsg, callback) {
  const cmd = `export DISPLAY=${process.env.DISPLAY || ':0'}; xdg-open "${url}" || firefox "${url}" &`;
  exec(cmd, (err) => {
    if (err) callback("No pude abrir el navegador.");
    else callback(fallbackMsg);
  });
}

async function processNaturalQuery(query, callback) {
  const q = query.toLowerCase().trim();

  // COMANDOS LOCALES RÁPIDOS (Se ejecutan en el Pentium sin gastar API)
  
  // 1. Clima
  if (q.includes('clima') || q.includes('temperatura') || q.includes('tiempo')) {
    openWebUrl("https://www.meteored.cl/valparaiso-valparaiso-cl.html", "Abriendo el pronóstico del tiempo para Valparaíso.", callback);
    return;
  }

  // 2. IP Local
  if (q.includes('mi ip') || q.includes('dirección ip') || q.includes('cual es mi ip')) {
    exec("hostname -I || ip route get 1 | awk '{print $7; exit}'", (err, stdout) => {
      const ip = stdout ? stdout.trim() : "No se pudo determinar la IP";
      callback(`Tu dirección IP actual en el sistema es ${ip}`);
    });
    return;
  }

  // 3. Hora actual
  if (q.includes('hora') || q.includes('que hora es')) {
    const now = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    callback(`Son las ${now} horas.`);
    return;
  }

  // 4. Abrir Aplicaciones Locales
  if (q.includes('abre') || q.includes('abrir') || q.includes('iniciar') || q.includes('ejecutar')) {
    try {
      const apps = await getApplicationEntries();
      const target = apps.find(a => 
        q.includes(a.name.toLowerCase()) || 
        q.includes(a.id.replace('.desktop', '').toLowerCase())
      );

      if (target) {
        exec(`export DISPLAY=${process.env.DISPLAY || ':0'}; ${target.exec} &`, { env: process.env });
        callback(`Abriendo ${target.name}.`);
        return;
      }
    } catch (e) {}
  }

  // CONVERSACIÓN DIRECTA CON GEMINI
  if (ai) {
    try {
      // Le enviamos la consulta a Gemini indicándole la personalidad de Lalo
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Eres Lalo, la interfaz de voz inteligente de SlQ-OS. Responde de forma concisa, breve y amigable (máximo 2 o 3 frases) para que la respuesta pueda ser leída por voz con claridad.\n\nUsuario: ${query}`,
      });

      const text = response.text || "No recibí respuesta de Gemini.";
      callback(text);
      return;
    } catch (error) {
      console.error("[Error Gemini API]:", error);
    }
  }

  // FALLBACK: Búsqueda Web si no hay API Key
  openWebUrl(`https://www.google.com/search?q=${encodeURIComponent(query)}`, `Buscando "${query}" en el navegador.`, callback);
}

module.exports = { processNaturalQuery };
