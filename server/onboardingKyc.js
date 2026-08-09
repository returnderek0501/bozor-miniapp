import { join } from 'path';
import { DATA_DIR, readJson, writeJson } from './dataPath.js';

const FILE = join(DATA_DIR, 'kyc_onboarding.json');

function loadData() {
  return readJson(FILE, { records: {}, updatedAt: null });
}

function saveData(data) {
  data.updatedAt = new Date().toISOString();
  writeJson(FILE, data);
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
  const data = loadData();
  const recordKey = key(tgUser.id);
  const current = data.records[recordKey];
  if (current?.kycStatus === 'pending') throw new Error('KYC_PENDING');
  if (current?.kycStatus === 'approved') throw new Error('KYC_ALREADY_APPROVED');
  if (!documents?.idCardFront?.path || !documents?.idCardBack?.path || !documents?.selfie?.path) {
    throw new Error('KYC_DOCUMENTS_REQUIRED');
  }
  const now = new Date().toISOString();
  const record = {
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
    linkedPhone: current?.linkedPhone || '',
    updatedAt: now,
  };
  data.records[recordKey] = record;
  saveData(data);
  return record;
}

export function listPendingOnboardingKyc() {
  return Object.values(loadData().records)
    .filter(record => record.kycStatus === 'pending')
    .sort((a, b) => String(a.kycSubmittedAt).localeCompare(String(b.kycSubmittedAt)));
}

export function reviewOnboardingKyc(telegramId, decision, reviewer = null, reason = '') {
  if (decision !== 'approved' && decision !== 'rejected') throw new Error('INVALID_KYC_STATUS');
  const data = loadData();
  const recordKey = key(telegramId);
  const record = data.records[recordKey];
  if (!record || record.kycStatus !== 'pending') throw new Error('KYC_NOT_PENDING');
  const now = new Date().toISOString();
  record.kycStatus = decision;
  record.kycReviewedAt = now;
  record.kycReviewedBy = reviewer?.id ?? null;
  record.kycReviewedByName = reviewer?.deskOperatorName || reviewer?.name || reviewer?.operatorName || '';
  record.kycRejectionReason = decision === 'rejected' ? String(reason || '').trim() : '';
  record.updatedAt = now;
  saveData(data);
  return record;
}

export function linkOnboardingKyc(telegramId, phone) {
  const data = loadData();
  const record = data.records[key(telegramId)];
  if (!record || record.kycStatus !== 'approved') throw new Error('KYC_NOT_APPROVED');
  if (record.linkedPhone && record.linkedPhone !== String(phone || '')) {
    throw new Error('KYC_PHONE_MISMATCH');
  }
  record.linkedPhone = String(phone || '');
  record.updatedAt = new Date().toISOString();
  saveData(data);
  return record;
}
