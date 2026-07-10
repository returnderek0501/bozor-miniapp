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
    profileComplete: isClientProfileComplete(emp),
  };
}
