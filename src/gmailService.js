const fs = require('fs');
const path = require('path');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

async function loadSavedCredentialsIfExist() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const content = fs.readFileSync(TOKEN_PATH);
      const credentials = JSON.parse(content);
      return google.auth.fromJSON(credentials);
    }
  } catch (err) {
    return null;
  }
  return null;
}

async function saveCredentials(client) {
  const content = fs.readFileSync(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  fs.writeFileSync(TOKEN_PATH, payload);
}

async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) return client;

  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error("No se encontró 'credentials.json'.");
  }

  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });

  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

async function moverAPapelera(query) {
  try {
    const auth = await authorize();
    const gmail = google.gmail({ version: 'v1', auth });

    console.log(`\x1b[36m[SlQ Gmail]: Buscando correos con filtro: "${query}"...\x1b[0m`);
    
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: query,
    });

    const messages = res.data.messages || [];

    if (messages.length === 0) {
      console.log(`\x1b[33m[SlQ Gmail]: No se encontraron correos para "${query}".\x1b[0m`);
      return;
    }

    console.log(`\x1b[32m[SlQ Gmail]: Se encontraron ${messages.length} correo(s). Moviendo a la papelera...\x1b[0m`);

    for (const msg of messages) {
      await gmail.users.messages.trash({
        userId: 'me',
        id: msg.id,
      });
    }

    console.log(`\x1b[32m[SlQ Gmail]: ¡Éxito! ${messages.length} correo(s) movido(s) a la papelera.\x1b[0m`);
  } catch (error) {
    console.error(`\x1b[31m[SlQ Gmail Error]: ${error.message}\x1b[0m`);
  }
}

module.exports = { moverAPapelera };
