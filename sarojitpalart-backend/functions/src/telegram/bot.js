const TelegramBot = require('node-telegram-bot-api');
const { config } = require('../config');

let botInstance = null;

function getBot() {
  if (botInstance) return botInstance;

  if (!config.telegram.botToken) {
    console.warn('Telegram bot token not configured');
    return null;
  }

  botInstance = new TelegramBot(config.telegram.botToken, { webHook: true });
  return botInstance;
}

module.exports = { getBot };
