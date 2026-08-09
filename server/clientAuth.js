function maskPhone(phone) {
  if (!phone || phone.length < 8) return phone;
  return `${phone.slice(0, 4)} *** ** ${phone.slice(-2)}`;
}

export function buildClientAuthStatus(tgUser, phone, employee) {
  const kycStatus = employee.kycStatus || 'none';
  return {
    authorized: true,
    appAllowed: kycStatus === 'approved',
    kycStatus,
    kycCanSubmit: kycStatus === 'none' || kycStatus === 'rejected',
    phone: maskPhone(phone),
    user: {
      id: tgUser.id,
      name: employee.fullName || `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim(),
    },
  };
}
