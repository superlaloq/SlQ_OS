const { exec } = require('child_process');
const readline = require('readline');
const { processNaturalQuery } = require('./aiAssistant');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function speakLalo(text, callback) {
  console.log(`\n🗣️ Lalo: "${text}"`);
  const clean = text.replace(/["`$\\]/g, "").substring(0, 250);
  exec(`espeak-ng -v es -s 130 -p 45 "${clean}"`, () => {
    if (callback) callback();
  });
}

function startLaloExperience() {
  console.clear();
  console.log("==================================================");
  console.log(" ⚡ SlQ-OS Shell V0.7.4 // [LALO - Asistente de Voz]");
  console.log("==================================================");
  console.log(" Estado: Núcleo autónomo activo (Modo Accesibilidad)");
  console.log("--------------------------------------------------");

  const welcomeMessage = "Hola. Soy Lalo, tu sistema operativo SlQ-OS. Estoy listo para ayudarte.";
  
  speakLalo(welcomeMessage, () => {
    promptUser();
  });
}

function promptUser() {
  console.log("\n--------------------------------------------------");
  rl.question("🎙️ Di o escribe una orden a Lalo (ej. 'abre chrome', 'dime mi ip', 'ayuda'): ", (input) => {
    const query = input.trim();
    if (!query) {
      promptUser();
      return;
    }

    if (query.toLowerCase() === 'salir' || query.toLowerCase() === 'exit') {
      speakLalo("Apagando sesión de Lalo. Hasta pronto.", () => {
        rl.close();
        process.exit(0);
      });
      return;
    }

    speakLalo("Procesando tu solicitud...", () => {
      processNaturalQuery(query, (response) => {
        speakLalo(response, () => {
          promptUser();
        });
      });
    });
  });
}

// Iniciar presentación de Lalo
startLaloExperience();
