import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { getDataDir, readJson, updateJsonSync } from './dataPath.js';
import {
  addPhone, applyApprovedKyc, setSession, updateEmployeeFields,
  getSession, isPhoneAllowed,
} from './store.js';

const EMPTY = { records: {}, updatedAt: null };

function filePath() {
  return join(getDataDir(), 'kyc_onboarding.json');
}

function loadData() {
  const data = readJson(filePath(), EMPTY);
  if (!data || typeof data !== 'object') return { ...EMPTY, records: {} };
  if (!data.records || typeof data.records !== 'object' || Array.isArray(data.records)) {
    return { records: {}, updatedAt: data.updatedAt || null };
  }
  return data;
}

function mutate(updater) {
  return updateJsonSync(filePath(), EMPTY, (current) => {
    const data = (!current?.records || typeof current.records !== 'object'
      || Array.isArray(current.records))
      ? { records: {}, updatedAt: null }
      : current;
    updater(data);
    data.updatedAt = new Date().toISOString();
    return data;
  });
}

function key(telegramId) {
  return String(Number(telegramId));
}

function telegramProfile(tgUser = {}) {
  return {
    telegramId: Number(tgUser.id),
    telegramUsername: String(tgUser.username || ''),
    telegramFirstName: String(tgUser.first_name || ''),
    telegramLastName: String(tgUser.last_name || ''),
  };
}

function latestKycFile(files, prefix) {
  const matches = files.filter(name => name.startsWith(prefix));
  if (!matches.length) return null;
  matches.sort((a, b) => {
    const aTime = Number((a.match(/_(\d+)\./) || [])[1] || 0);
    const bTime = Number((b.match(/_(\d+)\./) || [])[1] || 0);
    return aTime - bTime;
  });
  return matches[matches.length - 1];
}

function documentFromFile(clientFolder, filename) {
  if (!filename) return null;
  const ext = filename.includes('.') ? `.${filename.split('.').pop()}` : '.jpg';
  const mimeType = ext === '.png'
    ? 'image/png'
    : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  const absolute = join(getDataDir(), 'attachments', clientFolder, filename);
  let size = 0;
  let savedAt = new Date().toISOString();
  try {
    const stats = statSync(absolute);
    size = stats.size;
    savedAt = stats.mtime.toISOString();
  } catch {
    // ignore missing stats
  }
  return {
    path: `attachments/${clientFolder}/${filename}`,
    mimeType,
    size,
    savedAt,
  };
}

/**
 * Rebuild missing onboarding KYC records from attachment folders.
 * Helps when kyc_onboarding.json was wiped by a race/corrupt write but photos remain.
 */
export function reconcileOnboardingFromAttachments() {
  const attachmentsRoot = join(getDataDir(), 'attachments');
  if (!existsSync(attachmentsRoot)) return { recovered: 0, pending: listPendingOnboardingKyc({ reconcile: false }).length };

  let recovered = 0;
  mutate((data) => {
    const folders = readdirSync(attachmentsRoot).filter(name => /^tg_\d+$/.test(name));
    for (const folder of folders) {
      const telegramId = Number(folder.slice(3));
      if (!Number.isInteger(telegramId) || telegramId <= 0) continue;
      const recordKey = key(telegramId);
      const existing = data.records[recordKey];
      // Never resurrect decided/pending rows — only rebuild truly missing records.
      if (existing) continue;

      let files = [];
      try {
        files = readdirSync(join(attachmentsRoot, folder));
      } catch {
        continue;
      }
      const frontName = latestKycFile(files, 'kyc_id_card_front_');
      const backName = latestKycFile(files, 'kyc_id_card_back_');
      const selfieName = latestKycFile(files, 'kyc_selfie_');
      if (!frontName || !backName || !selfieName) continue;

      const documents = {
        idCardFront: documentFromFile(folder, frontName),
        idCardBack: documentFromFile(folder, backName),
        selfie: documentFromFile(folder, selfieName),
      };
      const submittedAt = [
        documents.idCardFront.savedAt,
        documents.idCardBack.savedAt,
        documents.selfie.savedAt,
      ].sort().at(-1);

      data.records[recordKey] = {
        telegramId,
        telegramUsername: '',
        telegramFirstName: '',
        telegramLastName: '',
        provisionalId: `tg_${telegramId}`,
        kycStatus: 'pending',
        kycDocuments: documents,
        kycSubmittedAt: submittedAt,
        kycReviewedAt: null,
        kycReviewedBy: null,
        kycReviewedByName: '',
        kycRejectionReason: '',
        linkedPhone: '',
        recoveredFromAttachments: true,
        updatedAt: new Date().toISOString(),
      };
      recovered += 1;
    }
  });

  return { recovered, pending: listPendingOnboardingKyc({ reconcile: false }).length };
}

export function getOnboardingKyc(telegramId) {
  return loadData().records[key(telegramId)] || null;
}

export function onboardingKycStatus(telegramId) {
  const record = getOnboardingKyc(telegramId);
  return {
    kycStatus: record?.kycStatus || 'none',
    kycCanSubmit: !record || record.kycStatus === 'none' || record.kycStatus === 'rejected',
    kycRejectionReason: record?.kycRejectionReason || '',
    submittedAt: record?.kycSubmittedAt || null,
  };
}

export function submitOnboardingKyc(tgUser, documents) {
  let record = null;
  mutate((data) => {
    const recordKey = key(tgUser.id);
    const current = data.records[recordKey];
    if (current?.kycStatus === 'pending') throw new Error('KYC_PENDING');
    if (current?.kycStatus === 'approved') throw new Error('KYC_ALREADY_APPROVED');
    if (!documents?.idCardFront?.path || !documents?.idCardBack?.path || !documents?.selfie?.path) {
      throw new Error('KYC_DOCUMENTS_REQUIRED');
    }
    const now = new Date().toISOString();
    record = {
      ...(current || {}),
      ...telegramProfile(tgUser),
      provisionalId: `tg_${Number(tgUser.id)}`,
      kycStatus: 'pending',
      kycDocuments: documents,
      kycSubmittedAt: now,
      kycReviewedAt: null,
      kycReviewedBy: null,
      kycReviewedByName: '',
      kycRejectionReason: '',
      // Always start a new review cycle without a stale phone link.
      linkedPhone: '',
      recoveredFromAttachments: false,
      updatedAt: now,
    };
    data.records[recordKey] = record;
  });
  return record;
}

export function listPendingOnboardingKyc({ reconcile = true } = {}) {
  if (reconcile) {
    try {
      reconcileOnboardingFromAttachments();
    } catch (error) {
      console.error('Onboarding KYC reconcile failed:', error.message);
    }
  }
  return Object.values(loadData().records)
    .filter(record => record.kycStatus === 'pending')
    .sort((a, b) => String(a.kycSubmittedAt).localeCompare(String(b.kycSubmittedAt)));
}

/** Approved KYC waiting for a phone — shown in the clients panel. */
export function listApprovedUnlinkedOnboardingKyc() {
  return Object.values(loadData().records)
    .filter(record => record.kycStatus === 'approved' && !record.linkedPhone)
    .sort((a, b) => String(b.kycReviewedAt || b.kycSubmittedAt || '')
      .localeCompare(String(a.kycReviewedAt || a.kycSubmittedAt || '')));
}

export function onboardingKycStats() {
  const records = Object.values(loadData().records);
  return {
    total: records.length,
    pending: records.filter(record => record.kycStatus === 'pending').length,
    approved: records.filter(record => record.kycStatus === 'approved').length,
    rejected: records.filter(record => record.kycStatus === 'rejected').length,
    dataFile: filePath(),
  };
}

export function reviewOnboardingKyc(telegramId, decision, reviewer = null, reason = '') {
  if (decision !== 'approved' && decision !== 'rejected') throw new Error('INVALID_KYC_STATUS');
  let record = null;
  mutate((data) => {
    const recordKey = key(telegramId);
    record = data.records[recordKey];
    if (!record) throw new Error('KYC_NOT_FOUND');
    // Idempotent: repeated approve/reject after a partial UI failure must succeed.
    if (record.kycStatus === decision) {
      if (decision === 'rejected') {
        const nextReason = String(reason || '').trim();
        if (nextReason && nextReason !== record.kycRejectionReason) {
          record.kycRejectionReason = nextReason;
          record.updatedAt = new Date().toISOString();
          data.records[recordKey] = record;
        }
      }
      return;
    }
    const canRestate = !record.linkedPhone
      && (record.kycStatus === 'pending'
        || record.kycStatus === 'approved'
        || record.kycStatus === 'rejected');
    if (!canRestate) throw new Error('KYC_NOT_PENDING');
    const now = new Date().toISOString();
    record.kycStatus = decision;
    record.kycReviewedAt = now;
    record.kycReviewedBy = reviewer?.id ?? null;
    record.kycReviewedByName = reviewer?.deskOperatorName || reviewer?.name || reviewer?.operatorName || '';
    record.kycRejectionReason = decision === 'rejected' ? String(reason || '').trim() : '';
    if (decision === 'rejected') record.linkedPhone = '';
    record.updatedAt = now;
    data.records[recordKey] = record;
  });
  return record;
}

export function linkOnboardingKyc(telegramId, phone) {
  let record = null;
  mutate((data) => {
    record = data.records[key(telegramId)];
    if (!record || record.kycStatus !== 'approved') throw new Error('KYC_NOT_APPROVED');
    if (record.linkedPhone && record.linkedPhone !== String(phone || '')) {
      throw new Error('KYC_PHONE_MISMATCH');
    }
    record.linkedPhone = String(phone || '');
    record.updatedAt = new Date().toISOString();
    data.records[key(telegramId)] = record;
  });
  return record;
}

/** Best-effort phone bind after approval; never throws away the KYC decision. */
export function tryLinkApprovedOnboardingToSession(telegramId) {
  const record = getOnboardingKyc(telegramId);
  if (!record || record.kycStatus !== 'approved') {
    return { linked: false, record, error: 'KYC_NOT_APPROVED' };
  }
  if (record.linkedPhone) {
    return { linked: true, record, phone: record.linkedPhone };
  }
  const session = getSession(telegramId);
  if (!session?.phone || !isPhoneAllowed(session.phone)) {
    return { linked: false, record };
  }
  try {
    applyApprovedKyc(session.phone, record);
    const linked = linkOnboardingKyc(telegramId, session.phone);
    return { linked: true, record: linked, phone: session.phone };
  } catch (error) {
    console.error(
      `Onboarding KYC post-approve link failed for ${telegramId}:`,
      error.message,
    );
    return { linked: false, record: getOnboardingKyc(telegramId), error: error.message };
  }
}

/**
 * Create/whitelist a phone for an approved onboarding KYC and bind Telegram.
 */
export function assignOnboardingPhone(telegramId, rawPhone, actor = null) {
  const record = getOnboardingKyc(telegramId);
  if (!record) throw new Error('KYC_NOT_FOUND');
  if (record.kycStatus !== 'approved') throw new Error('KYC_NOT_APPROVED');
  if (record.linkedPhone) throw new Error('KYC_ALREADY_LINKED');

  const phone = addPhone(rawPhone, actor);
  let employee = applyApprovedKyc(phone, record);
  const displayName = [
    record.telegramFirstName,
    record.telegramLastName,
  ].filter(Boolean).join(' ').trim();
  if (displayName && !String(employee.fullName || '').trim()) {
    employee = updateEmployeeFields(phone, { name: displayName });
  }
  linkOnboardingKyc(telegramId, phone);
  setSession(telegramId, phone, {
    id: Number(telegramId),
    username: record.telegramUsername || '',
    first_name: record.telegramFirstName || '',
    last_name: record.telegramLastName || '',
  });
  return { phone, employee, record: getOnboardingKyc(telegramId) };
}
