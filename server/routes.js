import { Router } from 'express';
import {
  isPhoneAllowed, getSession, setSession, normalizePhone,
  getEmployee, publicEmployee, withdrawAdvance, maskCard,
  submitKyc,
} from './store.js';
import {
  saveKycBuffer, parseBase64Image, deleteKycDocuments,
} from './attachments.js';
import { validateInitData } from './telegram.js';
import { notifyOperatorKycReview } from './kyc.js';

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

  router.get('/kyc/status', (req, res) => {
    const ctx = resolveSession(req);
    if (!ctx) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const emp = getEmployee(ctx.phone);
    res.json(publicEmployee(emp, maskPhone(ctx.phone)));
  });

  router.post('/kyc/submit', async (req, res) => {
    const ctx = resolveSession(req);
    if (!ctx) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { idCardFront, idCardBack, selfie } = req.body || {};
    if (!idCardFront || !idCardBack || !selfie) {
      return res.status(400).json({ success: false, error: 'KYC_DOCUMENTS_REQUIRED' });
    }

    let savedDocuments = null;
    let submitted = false;
    try {
      const emp = getEmployee(ctx.phone);
      if (!emp?.clientId) {
        return res.status(404).json({ success: false, error: 'PROFILE_NOT_FOUND' });
      }
      if (emp.kycStatus === 'pending') throw new Error('KYC_PENDING');
      if (emp.kycStatus === 'approved') throw new Error('KYC_ALREADY_APPROVED');

      const frontParsed = parseBase64Image(idCardFront);
      const backParsed = parseBase64Image(idCardBack);
      const selfieParsed = parseBase64Image(selfie);
      savedDocuments = {};
      savedDocuments.idCardFront = saveKycBuffer(emp.clientId, 'id_card_front', frontParsed.buffer, frontParsed.ext);
      savedDocuments.idCardBack = saveKycBuffer(emp.clientId, 'id_card_back', backParsed.buffer, backParsed.ext);
      savedDocuments.selfie = saveKycBuffer(emp.clientId, 'selfie', selfieParsed.buffer, selfieParsed.ext);

      const previousDocuments = emp.kycDocuments;
      const updated = submitKyc(ctx.phone, savedDocuments);
      submitted = true;
      deleteKycDocuments(previousDocuments);
      await notifyOperatorKycReview(updated);
      res.json({
        success: true,
        kycStatus: updated.kycStatus,
        kycCanSubmit: false,
        withdrawAllowed: false,
      });
    } catch (e) {
      if (!submitted && savedDocuments) deleteKycDocuments(savedDocuments);
      const knownErrors = new Set([
        'KYC_PENDING',
        'KYC_ALREADY_APPROVED',
        'KYC_DOCUMENTS_REQUIRED',
        'INVALID_IMAGE',
        'IMAGE_TOO_SMALL',
        'IMAGE_TOO_LARGE',
      ]);
      const error = knownErrors.has(e.message) ? e.message : 'KYC_SUBMIT_FAILED';
      const status = error === 'KYC_PENDING' || error === 'KYC_ALREADY_APPROVED' ? 409 : 400;
      res.status(status).json({
        success: false,
        error,
      });
    }
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
        KYC_NOT_APPROVED: 'Сначала пройдите проверку KYC в разделе «Документы»',
      };
      const msg = messages[e.message] || 'Amal bajarilmadi';
      const status = e.message === 'CARD_NOT_SUPPORTED' || e.message === 'KYC_NOT_APPROVED' ? 403 : 400;
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
