import { Router } from 'express';
import {
  getUser, markNotificationRead, markAllNotificationsRead, addNotification,
} from './store.js';
import { validateInitData } from './telegram.js';
import { createBotApi } from './telegram.js';

export function createApiRouter(botToken) {
  const router = Router();
  const bot = botToken ? createBotApi(botToken) : null;

  function resolveUser(req) {
    const initData = req.headers.authorization?.replace('tma ', '') || req.query.initData;
    if (botToken && initData) {
      const tgUser = validateInitData(initData, botToken);
      if (tgUser) return getUser(tgUser.id, tgUser);
    }
    const demoId = req.query.demoId || '0';
    return getUser(demoId);
  }

  router.get('/me', (req, res) => {
    res.json(resolveUser(req));
  });

  router.get('/notifications', (req, res) => {
    const user = resolveUser(req);
    res.json(user.notifications || []);
  });

  router.patch('/notifications/:id/read', (req, res) => {
    const user = resolveUser(req);
    const notifications = markNotificationRead(user.telegramId, req.params.id);
    res.json(notifications);
  });

  router.patch('/notifications/read-all', (req, res) => {
    const user = resolveUser(req);
    const notifications = markAllNotificationsRead(user.telegramId);
    res.json(notifications);
  });

  router.post('/notifications', async (req, res) => {
    const user = resolveUser(req);
    const { title, body, type, signalId } = req.body;
    const notif = addNotification(user.telegramId, { title, body, type: type || 'info', signalId });

    if (bot && user.telegramId) {
      try {
        await bot.sendMessage(user.telegramId, `<b>${title}</b>\n\n${body}`);
      } catch (e) {
        console.error('DM send failed:', e.message);
      }
    }

    res.json(notif);
  });

  return router;
}
