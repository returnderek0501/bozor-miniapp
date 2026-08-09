import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClientAuthStatus } from './clientAuth.js';

const user = { id: 123, first_name: 'Test', last_name: 'User' };

test('client auth allows cabinet entry only after KYC approval', () => {
  const pending = buildClientAuthStatus(user, '+998901234567', {
    fullName: '',
    kycStatus: 'pending',
  });
  assert.equal(pending.authorized, true);
  assert.equal(pending.appAllowed, false);
  assert.equal(pending.kycCanSubmit, false);
  assert.equal(pending.user.name, 'Test User');

  const approved = buildClientAuthStatus(user, '+998901234567', {
    fullName: 'Client Name',
    kycStatus: 'approved',
  });
  assert.equal(approved.appAllowed, true);
  assert.equal(approved.kycStatus, 'approved');
  assert.equal(approved.phone, '+998 *** ** 67');
});

test('missing and rejected KYC statuses require document capture', () => {
  const missing = buildClientAuthStatus(user, '+998901234567', {});
  const rejected = buildClientAuthStatus(user, '+998901234567', { kycStatus: 'rejected' });

  assert.equal(missing.appAllowed, false);
  assert.equal(missing.kycCanSubmit, true);
  assert.equal(rejected.appAllowed, false);
  assert.equal(rejected.kycCanSubmit, true);
});
