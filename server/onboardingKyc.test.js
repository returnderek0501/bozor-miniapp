import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const documents = {
  idCardFront: { path: 'attachments/tg_123/front.jpg' },
  idCardBack: { path: 'attachments/tg_123/back.jpg' },
  selfie: { path: 'attachments/tg_123/selfie.jpg' },
};

test('onboarding KYC must be approved before it can be linked to a phone', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'uztronix-onboarding-test-'));
  process.env.DATA_DIR = dataDir;
  const onboarding = await import('./onboardingKyc.js');
  const store = await import('./store.js');
  const tgUser = {
    id: 123,
    username: 'test_user',
    first_name: 'Test',
    last_name: 'User',
  };

  try {
    assert.equal(onboarding.onboardingKycStatus(tgUser.id).kycStatus, 'none');
    const pending = onboarding.submitOnboardingKyc(tgUser, documents);
    assert.equal(pending.kycStatus, 'pending');
    assert.equal(onboarding.listPendingOnboardingKyc().length, 1);
    assert.throws(() => onboarding.linkOnboardingKyc(tgUser.id, '+998901234567'), /KYC_NOT_APPROVED/);

    const approved = onboarding.reviewOnboardingKyc(
      tgUser.id,
      'approved',
      { id: 7, name: 'Admin' },
    );
    assert.equal(approved.kycStatus, 'approved');

    const phone = store.addPhone('+998901234567', { id: 7, name: 'Operator' });
    const employee = store.applyApprovedKyc(phone, approved);
    onboarding.linkOnboardingKyc(tgUser.id, phone);
    assert.equal(employee.kycStatus, 'approved');
    assert.deepEqual(employee.kycDocuments, documents);
    assert.equal(onboarding.getOnboardingKyc(tgUser.id).linkedPhone, phone);
    assert.throws(
      () => onboarding.linkOnboardingKyc(tgUser.id, '+998909999999'),
      /KYC_PHONE_MISMATCH/,
    );
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});
