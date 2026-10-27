const { processNaturalQuery } = require('./aiAssistant');

function registerAiRoutes(app) {
  app.get('/api/ai/query', (req, res) => {
    const q = req.query.q || '';
    if (!q) {
      return res.json({ response: "No recibí ninguna consulta." });
    }
    processNaturalQuery(q, (answer) => {
      res.json({ response: answer });
    });
  });
}

module.exports = { registerAiRoutes };
