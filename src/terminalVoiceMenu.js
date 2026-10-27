const readline = require('readline');
const { exec } = require('child_process');
const { processNaturalQuery } = require('./aiAssistant');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let voiceEnabled = true;

function speak(text) {
  if (!voiceEnabled) return;
  const clean = text.replace(/["`$\\]/g, "").substring(0, 250);
  exec(`espeak-ng -v es -s 130 -p 45 "${clean}"`, (err) => {
    if (err) console.log("⚠️ [Audio no disponible en este entorno CLI]");
  });
}

function showMenu() {
  console.clear();
  console.log("==================================================");
  console.log(" ⚡ SlQ-OS // TERMINAL AI & VOICE COMMAND CENTER");
  console.log("==================================================");
  console.log(` Estado de la Voz: [ ${voiceEnabled ? "🔊 ACTIVADA (SlQ-IA Hawking Mode)" : "🔇 DESACTIVADA"} ]`);
  console.log("--------------------------------------------------");
  console.log(" [1] 🗣️ Preguntar a SlQ-IA en lenguaje natural (ej. 'dime mi ip')");
  console.log(" [2] 🔊 Alternar Activar / Desactivar Voz");
  console.log(" [3] 🚀 Lanzar Command Center Web (Puerto 3000)");
  console.log(" [0] 🚪 Salir de la terminal");
  console.log("==================================================");
  
  rl.question("\nSelecciona una opción [0-3]: ", (answer) => {
    handleMenuOption(answer.trim());
  });
}

function handleMenuOption(option) {
  switch(option) {
    case '1':
      rl.question("\n🗣️ Habla con SlQ-IA (ej. 'dime mi ip', 'estado del sistema', 'qué hora es'): ", (query) => {
        if (!query.trim()) {
          setTimeout(showMenu, 1000);
          return;
        }
        console.log(`\n🧠 SlQ-IA analizando: "${query}"...`);
        speak("Analizando solicitud.");

        processNaturalQuery(query, (response) => {
          console.log(`\n🤖 SlQ-IA dice: "${response}"`);
          speak(response);
          rl.question("\nPresiona ENTER para volver al menú...", () => {
            showMenu();
          });
        });
      });
      break;

    case '2':
      voiceEnabled = !voiceEnabled;
      console.log(`\n🔊 Voz cambiada a: ${voiceEnabled ? "ACTIVADA" : "DESACTIVADA"}`);
      if (voiceEnabled) speak("Voz reactivada.");
      setTimeout(showMenu, 1500);
      break;

    case '3':
      console.log("\n🚀 El Command Center web corre en http://localhost:3000");
      speak("Command Center web disponible.");
      setTimeout(showMenu, 2000);
      break;

    case '0':
      console.log("\n👋 Saliendo de SlQ-IA. ¡Hasta luego!");
      speak("Hasta luego.");
      rl.close();
      process.exit(0);
      break;

    default:
      console.log("\n❌ Opción no válida.");
      setTimeout(showMenu, 1500);
      break;
  }
}

// Iniciar asistente
speak("SlQ-IA en línea. Asistente de voz preparado.");
showMenu();
