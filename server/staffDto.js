import { isClientProfileComplete } from './clientFields.js';
import { getSessionByPhone } from './store.js';

export function staffClientSummary(emp) {
  const session = getSessionByPhone(emp.phone);
  const telegramDisplayName = [session?.firstName, session?.lastName].filter(Boolean).join(' ');
  return {
    clientId: String(emp.clientId || ''),
    fullName: emp.fullName || '',
    phone: emp.phone || '',
    operator: emp.operator || emp.createdByName || '',
    age: emp.age ?? '',
    maritalStatus: emp.maritalStatus || '',
    employeeId: emp.employeeId || '',
    advanceBalance: Number(emp.advanceBalance || 0),
    kycStatus: emp.kycStatus || 'none',
    kycSubmittedAt: emp.kycSubmittedAt || null,
    kycReviewedAt: emp.kycReviewedAt || null,
    kycRejectionReason: emp.kycRejectionReason || '',
    tags: (emp.tags || []).map(tag => ({ id: tag.id, label: tag.label })),
    createdAt: emp.createdAt || null,
    updatedAt: emp.updatedAt || emp.createdAt || null,
    profileComplete: isClientProfileComplete(emp),
    telegramId: session?.telegramId || null,
    telegramUsername: session?.username || '',
    telegramDisplayName,
    telegramLinked: Boolean(session?.telegramId),
    telegramLinkedAt: session?.verifiedAt || null,
    telegramLastSeenAt: session?.lastSeenAt || session?.verifiedAt || null,
    komsa4Enabled: Boolean(emp.komsa4Enabled),
    incassationOrder: emp.incassationOrder || null,
  };
}

export function staffClientDetail(emp) {
  return {
    ...staffClientSummary(emp),
    tags: (emp.tags || []).map(tag => ({
      id: tag.id,
      label: tag.label,
      note: tag.note || '',
      assignedAt: tag.assignedAt || null,
      hasPhoto: Boolean(tag.photo?.path || tag.photo?.fileId),
      webPhotoAvailable: Boolean(tag.photo?.path),
    })),
    kycReviewedByName: emp.kycReviewedByName || '',
    hasKycDocuments: Boolean(
      emp.kycDocuments?.idCardFront?.path
      || emp.kycDocuments?.idCardBack?.path
      || emp.kycDocuments?.selfie?.path
    ),
  };
}

/** Map approved/unlinked onboarding KYC into the same shape as staff clients. */
export function staffOnboardingClientSummary(record) {
  const telegramDisplayName = [
    record.telegramFirstName,
    record.telegramLastName,
  ].filter(Boolean).join(' ');
  return {
    clientId: String(record.provisionalId || `tg_${record.telegramId}`),
    fullName: telegramDisplayName,
    phone: '',
    operator: '',
    age: '',
    maritalStatus: '',
    employeeId: '',
    advanceBalance: 0,
    kycStatus: record.kycStatus || 'approved',
    kycSubmittedAt: record.kycSubmittedAt || null,
    kycReviewedAt: record.kycReviewedAt || null,
    kycRejectionReason: record.kycRejectionReason || '',
    tags: [],
    createdAt: record.kycSubmittedAt || record.updatedAt || null,
    updatedAt: record.updatedAt || record.kycReviewedAt || record.kycSubmittedAt || null,
    profileComplete: false,
    telegramId: Number(record.telegramId) || null,
    telegramUsername: record.telegramUsername || '',
    telegramDisplayName,
    telegramLinked: true,
    telegramLinkedAt: record.kycSubmittedAt || null,
    telegramLastSeenAt: record.updatedAt || record.kycSubmittedAt || null,
    provisional: true,
    komsa4Enabled: false,
    incassationOrder: null,
    hasKycDocuments: Boolean(
      record.kycDocuments?.idCardFront?.path
      || record.kycDocuments?.idCardBack?.path
      || record.kycDocuments?.selfie?.path
    ),
  };
}
