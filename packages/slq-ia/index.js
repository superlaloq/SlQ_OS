const { askOllama } = require('./src/ollamaClient');
const { askOnlineAI, isOnlineAIConfigured } = require('./src/onlineAIClient');

module.exports = {
  askOllama,
  askOnlineAI,
  isOnlineAIConfigured
};
