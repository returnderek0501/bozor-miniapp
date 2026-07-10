import { Router } from 'express';
import {
  isPhoneAllowed, getSession, setSession, normalizePhone,
  getEmployee, publicEmployee, withdrawAdvance, maskCard,
  submitKyc, listEmployeesForUser, findEmployeeByClientId, setKycStatus,
} from './store.js';
import {
  saveKycBuffer, parseBase64Image, deleteKycDocuments, attachmentAbsolutePath,
} from './attachments.js';
import { validateInitData } from './telegram.js';
import { notifyOperatorKycReview, notifyClientKycResult } from './kyc.js';
import {
  hasStaffAccess, getActor, canManageClient,
} from './permissions.js';
import { isAdmin } from './admins.js';
import {
  getActiveDeskOperator, listRecentDeskNames, rememberDeskOperatorName, enrichActorWithDesk,
} from './deskOperators.js';
import {
  unlockStaffWeb, lockStaffWeb, isStaffWebUnlocked,
} from './panelAccess.js';
import { staffClientSummary } from './staffDto.js';

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

  function resolveStaffIdentity(req) {
    const tgUser = resolveTelegramUser(req);
    if (!tgUser || !hasStaffAccess(tgUser.id)) return null;
    const deskName = getActiveDeskOperator(tgUser.id);
    const actor = enrichActorWithDesk(
      getActor(tgUser.id, `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim()),
      tgUser.id,
      deskName,
    );
    return { tgUser, actor, deskName, isAdmin: isAdmin(tgUser.id) };
  }

  function resolveUnlockedStaff(req) {
    const staff = resolveStaffIdentity(req);
    if (!staff || !isStaffWebUnlocked(staff.tgUser.id)) return null;
    return staff;
  }

  function staffStatus(staff) {
    return {
      staff: true,
      unlocked: isStaffWebUnlocked(staff.tgUser.id),
      role: staff.isAdmin ? 'admin' : 'operator',
      name: staff.actor?.name || staff.tgUser.first_name || '',
      deskName: staff.deskName,
      recentDeskNames: staff.isAdmin ? [] : listRecentDeskNames(staff.tgUser.id),
    };
  }

  function requireStaffResponse(req, res) {
    const staff = resolveUnlockedStaff(req);
    if (!staff) {
      res.status(401).json({ success: false, error: 'STAFF_SESSION_REQUIRED' });
      return null;
    }
    return staff;
  }

  router.get('/staff/status', (req, res) => {
    const tgUser = resolveTelegramUser(req);
    if (!tgUser) {
      return res.status(401).json({ staff: false, unlocked: false, error: 'INVALID_INIT_DATA' });
    }
    const staff = resolveStaffIdentity(req);
    if (!staff) return res.json({ staff: false, unlocked: false });
    return res.json(staffStatus(staff));
  });

  router.post('/staff/unlock', (req, res) => {
    const staff = resolveStaffIdentity(req);
    const code = String(req.body?.code || '').trim();
    if (!staff || !unlockStaffWeb(staff.tgUser.id, code)) {
      return res.status(403).json({ success: false, error: 'ACCESS_DENIED' });
    }
    return res.json({ success: true, ...staffStatus(staff) });
  });

  router.post('/staff/lock', (req, res) => {
    const staff = resolveStaffIdentity(req);
    if (staff) lockStaffWeb(staff.tgUser.id);
    return res.json({ success: true });
  });

  router.post('/staff/desk', (req, res) => {
    const staff = requireStaffResponse(req, res);
    if (!staff) return;
    if (staff.isAdmin) return res.status(400).json({ success: false, error: 'DESK_NOT_REQUIRED' });
    const name = String(req.body?.name || '').trim();
    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({ success: false, error: 'INVALID_DESK_NAME' });
    }
    rememberDeskOperatorName(staff.tgUser.id, name);
    return res.json({ success: true, deskName: name });
  });

  router.get('/staff/dashboard', (req, res) => {
    const staff = requireStaffResponse(req, res);
    if (!staff) return;
    const clients = listEmployeesForUser(staff.tgUser.id, staff.deskName)
      .map(staffClientSummary)
      .sort((a, b) => Number(b.clientId || 0) - Number(a.clientId || 0));
    return res.json({
      profile: staffStatus(staff),
      stats: {
        clients: clients.length,
        pendingKyc: clients.filter(client => client.kycStatus === 'pending').length,
        incomplete: clients.filter(client => !client.profileComplete).length,
        approvedKyc: clients.filter(client => client.kycStatus === 'approved').length,
      },
      clients,
    });
  });

  router.get('/staff/kyc/:clientId/documents/:documentType', (req, res) => {
    const staff = requireStaffResponse(req, res);
    if (!staff) return;
    const documentTypes = new Set(['idCardFront', 'idCardBack', 'selfie']);
    if (!documentTypes.has(req.params.documentType)) {
      return res.status(400).json({ error: 'INVALID_DOCUMENT_TYPE' });
    }
    const employee = findEmployeeByClientId(req.params.clientId);
    if (!employee || !canManageClient(staff.tgUser.id, employee, staff.deskName)) {
      return res.status(404).json({ error: 'CLIENT_NOT_FOUND' });
    }
    const document = employee.kycDocuments?.[req.params.documentType];
    if (!document?.path) return res.status(404).json({ error: 'DOCUMENT_NOT_FOUND' });
    return res.sendFile(attachmentAbsolutePath(document.path), error => {
      if (error && !res.headersSent) {
        res.status(error.statusCode || 404).json({ error: 'DOCUMENT_NOT_FOUND' });
      }
    });
  });

  router.post('/staff/kyc/:clientId/review', async (req, res) => {
    const staff = requireStaffResponse(req, res);
    if (!staff) return;
    const employee = findEmployeeByClientId(req.params.clientId);
    if (!employee || !canManageClient(staff.tgUser.id, employee, staff.deskName)) {
      return res.status(404).json({ success: false, error: 'CLIENT_NOT_FOUND' });
    }
    if (employee.kycStatus !== 'pending') {
      return res.status(409).json({ success: false, error: 'KYC_NOT_PENDING' });
    }
    const decision = req.body?.decision;
    if (decision !== 'approved' && decision !== 'rejected') {
      return res.status(400).json({ success: false, error: 'INVALID_DECISION' });
    }
    const reason = decision === 'rejected' ? String(req.body?.reason || '').trim() : '';
    if (decision === 'rejected' && (reason.length < 3 || reason.length > 300)) {
      return res.status(400).json({ success: false, error: 'INVALID_REJECTION_REASON' });
    }
    try {
      const updated = setKycStatus(employee.phone, decision, staff.actor, reason);
      await notifyClientKycResult(updated, decision === 'approved');
      return res.json({ success: true, client: staffClientSummary(updated) });
    } catch (error) {
      const code = error.message === 'KYC_NOT_PENDING' ? 'KYC_NOT_PENDING' : 'KYC_REVIEW_FAILED';
      return res.status(code === 'KYC_NOT_PENDING' ? 409 : 400).json({ success: false, error: code });
    }
  });

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
