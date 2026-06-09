import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createApiRouter } from './server/routes.js';
import { startBot } from './server/bot.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;

app.use(express.json());
app.use('/api', createApiRouter(BOT_TOKEN));
app.use(express.static(join(__dirname, 'dist')));

app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Bozor server running on port ${PORT}`);
  if (BOT_TOKEN) {
    startBot(BOT_TOKEN);
  } else {
    console.log('BOT_TOKEN not set — bot disabled, API demo mode active');
  }
});
