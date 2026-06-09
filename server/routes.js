import { Router } from 'express';
import {
  isPhoneAllowed, getSession, setSession, normalizePhone,
} from './store.js';
import { validateInitData } from './telegram.js';

export function createApiRouter(botToken) {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'uztronix' });
  });

  function resolveTelegramUser(req) {
    const initData = req.headers.authorization?.replace('tma ', '') || req.query.initData;
    if (botToken && initData) {
      return validateInitData(initData, botToken);
    }
    if (!botToken && req.query.demoId) {
      return { id: Number(req.query.demoId) || 0, first_name: 'Demo' };
    }
    return null;
  }

  router.get('/auth/status', (req, res) => {
    const tgUser = resolveTelegramUser(req);
    if (!tgUser) {
      return res.status(401).json({ authorized: false, reason: 'invalid_init_data' });
    }

    const session = getSession(tgUser.id);
    if (session?.phone && isPhoneAllowed(session.phone)) {
      return res.json({
        authorized: true,
        phone: maskPhone(session.phone),
        user: {
          id: tgUser.id,
          name: `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim(),
        },
      });
    }

    res.json({ authorized: false, reason: 'phone_required' });
  });

  router.post('/auth/verify', (req, res) => {
    const tgUser = resolveTelegramUser(req);
    if (!tgUser) {
      return res.status(401).json({ authorized: false, reason: 'invalid_init_data' });
    }

    const { phone } = req.body;
    const normalized = normalizePhone(phone);
    if (!normalized) {
      return res.status(400).json({
        authorized: false,
        reason: 'invalid_phone',
        message: 'Telefon raqami aniqlanmadi',
      });
    }

    if (!isPhoneAllowed(normalized)) {
      return res.status(403).json({
        authorized: false,
        reason: 'sim_not_supported',
        message: 'Ushbu raqam tizimga kiritilmagan. Eski SIM-kartalar qo\'llab-quvvatlanmaydi.',
      });
    }

    setSession(tgUser.id, normalized);
    res.json({
      authorized: true,
      phone: maskPhone(normalized),
      user: {
        id: tgUser.id,
        name: `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim(),
      },
    });
  });

  return router;
}

function maskPhone(phone) {
  if (!phone || phone.length < 8) return phone;
  return `${phone.slice(0, 4)} *** ** ${phone.slice(-2)}`;
}
