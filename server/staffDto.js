import { isClientProfileComplete } from './clientFields.js';

export function staffClientSummary(emp) {
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
