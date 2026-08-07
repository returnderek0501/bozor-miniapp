import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createApiRouter } from './server/routes.js';
import { startBot } from './server/bot.js';
import { getDataDir } from './server/dataPath.js';
import { isSheetsConfigured } from './server/sheets.js';
import { updateBotStatus } from './server/botStatus.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;

app.use(express.json({ limit: '15mb' }));
app.use('/api', createApiRouter(BOT_TOKEN));
app.use('/api', (error, _req, res, next) => {
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: 'PAYLOAD_TOO_LARGE' });
  }
  return next(error);
});
app.use(express.static(join(__dirname, 'dist')));

app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Uztronix server running on port ${PORT}`);
  console.log(`Data directory: ${getDataDir()}`);
  console.log(`Google Sheets sync: ${isSheetsConfigured() ? 'enabled' : 'disabled'}`);
  if (BOT_TOKEN) {
    startBot(BOT_TOKEN);
  } else {
    updateBotStatus({ configured: false, state: 'disabled', lastError: 'BOT_TOKEN is not set' });
    console.log('BOT_TOKEN not set — bot disabled');
  }
});
