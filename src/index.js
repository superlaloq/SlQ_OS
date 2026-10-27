const express = require('express');
const path = require('path');
const { getApplicationEntries, launchApplication } = require('./applicationManager');
const { processNaturalQuery } = require('./aiAssistant');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'web')));
app.use(express.static(path.join(__dirname, '../frontweb')));

// Endpoint principal de la IA de Lalo
app.get('/api/ai/query', (req, res) => {
  const query = req.query.q || '';
  if (!query.trim()) {
    return res.json({ response: "¿Qué deseas hacer?" });
  }
  processNaturalQuery(query, (answer) => {
    res.json({ response: answer });
  });
});

// Endpoint de aplicaciones
app.get('/api/apps', async (req, res) => {
  try {
    const apps = await getApplicationEntries();
    res.json(apps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para lanzar aplicaciones
app.post('/api/apps/:id/launch', async (req, res) => {
  try {
    const appId = decodeURIComponent(req.params.id);
    const result = await launchApplication(appId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


const { findOfficialIconPath } = require('./iconResolver');

app.get('/api/icon', (req, res) => {
  const iconName = req.query.name;
  const iconPath = findOfficialIconPath(iconName);
  if (iconPath) {
    res.sendFile(iconPath);
  } else {
    res.status(404).send('Icon not found');
  }
});



app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'web/dashboard.html'));
});


app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SlQ-OS] Servidor de Lalo operando en http://localhost:${PORT}`);
});
