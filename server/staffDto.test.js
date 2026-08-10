import test from 'node:test';
import assert from 'node:assert/strict';
import { staffClientSummary } from './staffDto.js';

test('staff client summary exposes the latest activity timestamp', () => {
  const summary = staffClientSummary({
    clientId: '42',
    phone: '+998901234567',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-04T12:30:00.000Z',
    tags: [{ id: 'pasport', label: 'Паспорт получен' }],
  });

  assert.equal(summary.updatedAt, '2026-08-04T12:30:00.000Z');
  assert.deepEqual(summary.tags, [{ id: 'pasport', label: 'Паспорт получен' }]);
  assert.equal(summary.telegramLinked, false);
  assert.equal(summary.telegramId, null);
});

test('staff client summary falls back to creation time for legacy clients', () => {
  const summary = staffClientSummary({
    clientId: '43',
    phone: '+998901234568',
    createdAt: '2026-08-01T08:00:00.000Z',
  });

  assert.equal(summary.updatedAt, '2026-08-01T08:00:00.000Z');
});

test('onboarding KYC maps into staff client shape without phone', async () => {
  const { staffOnboardingClientSummary } = await import('./staffDto.js');
  const summary = staffOnboardingClientSummary({
    telegramId: 555,
    telegramUsername: 'lead_user',
    telegramFirstName: 'Ali',
    telegramLastName: 'Karimov',
    provisionalId: 'tg_555',
    kycStatus: 'approved',
    kycSubmittedAt: '2026-08-10T08:00:00.000Z',
    kycReviewedAt: '2026-08-10T09:00:00.000Z',
    kycDocuments: {
      idCardFront: { path: 'attachments/tg_555/front.jpg' },
      idCardBack: { path: 'attachments/tg_555/back.jpg' },
      selfie: { path: 'attachments/tg_555/selfie.jpg' },
    },
  });

  assert.equal(summary.clientId, 'tg_555');
  assert.equal(summary.phone, '');
  assert.equal(summary.provisional, true);
  assert.equal(summary.kycStatus, 'approved');
  assert.equal(summary.fullName, 'Ali Karimov');
  assert.equal(summary.telegramLinked, true);
  assert.equal(summary.telegramId, 555);
  assert.equal(summary.hasKycDocuments, true);
});
