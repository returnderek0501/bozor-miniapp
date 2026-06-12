import { Router } from 'express';
import {
  isPhoneAllowed, getSession, setSession, normalizePhone,
  getEmployee, publicEmployee, withdrawAdvance, maskCard,
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

  function resolveSession(req) {
    const tgUser = resolveTelegramUser(req);
    if (!tgUser) return null;
    const session = getSession(tgUser.id);
    if (!session?.phone || !isPhoneAllowed(session.phone)) return null;
    return { tgUser, phone: session.phone };
  }

  router.get('/auth/status', (req, res) => {
    const ctx = resolveSession(req);
    if (!ctx) {
      const tgUser = resolveTelegramUser(req);
      if (!tgUser) {
        return res.status(401).json({ authorized: false, reason: 'invalid_init_data' });
      }
      return res.json({ authorized: false, reason: 'phone_required' });
    }

    const emp = getEmployee(ctx.phone);
    res.json({
      authorized: true,
      phone: maskPhone(ctx.phone),
      user: {
        id: ctx.tgUser.id,
        name: emp.fullName || `${ctx.tgUser.first_name || ''} ${ctx.tgUser.last_name || ''}`.trim(),
      },
    });
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
        reason: 'sim_not_supported',
      });
    }

    if (!isPhoneAllowed(normalized)) {
      return res.status(403).json({
        authorized: false,
        reason: 'sim_not_supported',
      });
    }

    setSession(tgUser.id, normalized);
    const emp = getEmployee(normalized);
    res.json({
      authorized: true,
      phone: maskPhone(normalized),
      user: {
        id: tgUser.id,
        name: emp.fullName || `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim(),
      },
    });
  });

  router.get('/cabinet', (req, res) => {
    const ctx = resolveSession(req);
    if (!ctx) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const emp = getEmployee(ctx.phone);
    res.json(publicEmployee(emp, maskPhone(ctx.phone)));
  });

  router.post('/withdraw', (req, res) => {
    const ctx = resolveSession(req);
    if (!ctx) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { cardNumber, amount } = req.body;
    const card = normalizeCardInput(cardNumber);
    if (!card) {
      return res.status(400).json({
        success: false,
        message: 'Karta raqami noto\'g\'ri kiritilgan',
      });
    }

    try {
      const result = withdrawAdvance(ctx.phone, card, amount);
      res.json({
        success: true,
        amount: result.amount,
        balance: result.balance,
        card: result.card,
      });
    } catch (e) {
      const messages = {
        CARD_NOT_SUPPORTED: 'Ushbu karta raqami qo\'llab-quvvatlanmaydi.',
        INSUFFICIENT_BALANCE: 'Mablag\' yetarli emas',
        INVALID_AMOUNT: 'Summa noto\'g\'ri',
        INVALID_DATA: 'Ma\'lumotlar noto\'g\'ri',
      };
      const msg = messages[e.message] || 'Amal bajarilmadi';
      const status = e.message === 'CARD_NOT_SUPPORTED' ? 403 : 400;
      res.status(status).json({ success: false, message: msg });
    }
  });

  return router;
}

function normalizeCardInput(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length < 12 || digits.length > 19) return null;
  return digits;
}

function maskPhone(phone) {
  if (!phone || phone.length < 8) return phone;
  return `${phone.slice(0, 4)} *** ** ${phone.slice(-2)}`;
}
