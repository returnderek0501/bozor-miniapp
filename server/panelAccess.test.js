import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPanelSecretConfigured, matchesPanelSecret, unlockPanel, lockPanel, isPanelUnlocked,
  requiresPanelUnlockForCallback,
} from './panelAccess.js';

test('panel secret accepts only 4–32 digits', () => {
  assert.equal(isPanelSecretConfigured('742951'), true);
  assert.equal(isPanelSecretConfigured('123'), false);
  assert.equal(isPanelSecretConfigured('12a4'), false);
  assert.equal(isPanelSecretConfigured(''), false);
});

test('panel secret comparison trims input and rejects mismatches', () => {
  assert.equal(matchesPanelSecret(' 742951 ', '742951'), true);
  assert.equal(matchesPanelSecret('742952', '742951'), false);
  assert.equal(matchesPanelSecret('74295', '742951'), false);
});

test('panel access is scoped to chat and telegram user', () => {
  unlockPanel(100, 200, 1_000);
  assert.equal(isPanelUnlocked(100, 200, 1_001), true);
  assert.equal(isPanelUnlocked(100, 201, 1_001), false);
  assert.equal(isPanelUnlocked(101, 200, 1_001), false);
  lockPanel(100, 200);
  assert.equal(isPanelUnlocked(100, 200, 1_001), false);
});

test('direct KYC moderation remains available to authorized staff', () => {
  assert.equal(requiresPanelUnlockForCallback('kyc_ok:998901234567'), false);
  assert.equal(requiresPanelUnlockForCallback('kyc_rej:998901234567'), false);
  assert.equal(requiresPanelUnlockForCallback('kyc_reason:blur:998901234567'), false);
  assert.equal(requiresPanelUnlockForCallback('kyc_view:998901234567'), true);
  assert.equal(requiresPanelUnlockForCallback('sum_today'), true);
});
