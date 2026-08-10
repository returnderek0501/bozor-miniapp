import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const documents = {
  idCardFront: { path: 'attachments/tg_123/front.jpg' },
  idCardBack: { path: 'attachments/tg_123/back.jpg' },
  selfie: { path: 'attachments/tg_123/selfie.jpg' },
};

test('onboarding KYC must be approved before it can be linked to a phone', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'uztronix-onboarding-test-'));
  const previous = process.env.DATA_DIR;
  process.env.DATA_DIR = dataDir;

  try {
    const onboarding = await import('./onboardingKyc.js');
    const store = await import('./store.js');
    const tgUser = {
      id: 123,
      username: 'test_user',
      first_name: 'Test',
      last_name: 'User',
    };

    assert.equal(onboarding.onboardingKycStatus(tgUser.id).kycStatus, 'none');
    const pending = onboarding.submitOnboardingKyc(tgUser, documents);
    assert.equal(pending.kycStatus, 'pending');
    assert.equal(onboarding.listPendingOnboardingKyc({ reconcile: false }).length, 1);
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
    if (previous === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previous;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('approved onboarding KYC can be assigned a phone from staff panel', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'uztronix-onboarding-assign-'));
  const previous = process.env.DATA_DIR;
  process.env.DATA_DIR = dataDir;

  try {
    const onboarding = await import('./onboardingKyc.js');
    const store = await import('./store.js');
    const tgUser = {
      id: 777,
      username: 'new_lead',
      first_name: 'Dilshod',
      last_name: 'Aliyev',
    };
    onboarding.submitOnboardingKyc(tgUser, {
      idCardFront: { path: 'attachments/tg_777/front.jpg' },
      idCardBack: { path: 'attachments/tg_777/back.jpg' },
      selfie: { path: 'attachments/tg_777/selfie.jpg' },
    });
    onboarding.reviewOnboardingKyc(tgUser.id, 'approved', { id: 1, name: 'Admin' });
    assert.equal(onboarding.listApprovedUnlinkedOnboardingKyc().length, 1);

    const result = onboarding.assignOnboardingPhone(
      tgUser.id,
      '901112233',
      { id: 1, name: 'Admin', deskOperatorName: 'Admin' },
    );
    assert.equal(result.phone, '+998901112233');
    assert.equal(result.employee.kycStatus, 'approved');
    assert.equal(result.employee.fullName, 'Dilshod Aliyev');
    assert.equal(result.record.linkedPhone, '+998901112233');
    assert.equal(onboarding.listApprovedUnlinkedOnboardingKyc().length, 0);
    assert.equal(store.getSession(tgUser.id)?.phone, '+998901112233');
    assert.equal(store.isPhoneAllowed('+998901112233'), true);
  } finally {
    if (previous === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previous;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('onboarding KYC review is idempotent and clears stale phone links on resubmit', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'uztronix-onboarding-idempotent-'));
  const previous = process.env.DATA_DIR;
  process.env.DATA_DIR = dataDir;

  try {
    const onboarding = await import('./onboardingKyc.js');
    const tgUser = {
      id: 888,
      username: 'retry_lead',
      first_name: 'Retry',
      last_name: 'Lead',
    };
    const docs = {
      idCardFront: { path: 'attachments/tg_888/front.jpg' },
      idCardBack: { path: 'attachments/tg_888/back.jpg' },
      selfie: { path: 'attachments/tg_888/selfie.jpg' },
    };
    onboarding.submitOnboardingKyc(tgUser, docs);
    const first = onboarding.reviewOnboardingKyc(tgUser.id, 'approved', { id: 1, name: 'Admin' });
    assert.equal(first.kycStatus, 'approved');
    const second = onboarding.reviewOnboardingKyc(tgUser.id, 'approved', { id: 1, name: 'Admin' });
    assert.equal(second.kycStatus, 'approved');

    const rejected = onboarding.reviewOnboardingKyc(
      tgUser.id,
      'rejected',
      { id: 1, name: 'Admin' },
      'Фото размыто или нечитаемо',
    );
    assert.equal(rejected.kycStatus, 'rejected');

    onboarding.submitOnboardingKyc(tgUser, {
      idCardFront: { path: 'attachments/tg_888/front2.jpg' },
      idCardBack: { path: 'attachments/tg_888/back2.jpg' },
      selfie: { path: 'attachments/tg_888/selfie2.jpg' },
    });
    assert.equal(onboarding.getOnboardingKyc(tgUser.id).linkedPhone, '');
    assert.equal(onboarding.getOnboardingKyc(tgUser.id).kycStatus, 'pending');
    const linkSafe = onboarding.tryLinkApprovedOnboardingToSession(tgUser.id);
    assert.equal(linkSafe.linked, false);
  } finally {
    if (previous === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previous;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('onboarding KYC recovers pending records from attachment folders', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'uztronix-onboarding-recover-'));
  const previous = process.env.DATA_DIR;
  process.env.DATA_DIR = dataDir;
  const folder = join(dataDir, 'attachments', 'tg_555001');
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, 'kyc_id_card_front_100.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  writeFileSync(join(folder, 'kyc_id_card_back_101.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  writeFileSync(join(folder, 'kyc_selfie_102.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

  try {
    const onboarding = await import('./onboardingKyc.js');
    assert.equal(onboarding.getOnboardingKyc(555001), null);
    const result = onboarding.reconcileOnboardingFromAttachments();
    assert.ok(result.recovered >= 1);
    const pending = onboarding.listPendingOnboardingKyc({ reconcile: false })
      .filter(record => record.telegramId === 555001);
    assert.equal(pending.length, 1);
    assert.equal(pending[0].kycStatus, 'pending');
    assert.match(pending[0].kycDocuments.idCardFront.path, /kyc_id_card_front_100/);
  } finally {
    if (previous === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previous;
    rmSync(dataDir, { recursive: true, force: true });
  }
});
