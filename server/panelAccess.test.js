import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPanelSecretConfigured, matchesPanelSecret,
  unlockStaffWeb, lockStaffWeb, isStaffWebUnlocked,
} from './panelAccess.js';

test('panel secret accepts only 4–32 digits', () => {
  assert.equal(isPanelSecretConfigured('887766'), true);
  assert.equal(isPanelSecretConfigured('123'), false);
  assert.equal(isPanelSecretConfigured('12a4'), false);
  assert.equal(isPanelSecretConfigured(''), false);
});

test('panel secret comparison trims input and rejects mismatches', () => {
  assert.equal(matchesPanelSecret(' 887766 ', '887766'), true);
  assert.equal(matchesPanelSecret('742952', '887766'), false);
  assert.equal(matchesPanelSecret('74295', '887766'), false);
});

test('web access is scoped to telegram user and expires after 12 hours', () => {
  assert.equal(unlockStaffWeb(200, '887766', 1_000), true);
  assert.equal(isStaffWebUnlocked(200, 1_001), true);
  assert.equal(isStaffWebUnlocked(201, 1_001), false);
  assert.equal(isStaffWebUnlocked(200, 1_000 + (12 * 60 * 60 * 1_000) - 1), true);
  assert.equal(isStaffWebUnlocked(200, 1_000 + (12 * 60 * 60 * 1_000)), false);
  assert.equal(unlockStaffWeb(200, '887766', 1_000), true);
  lockStaffWeb(200);
  assert.equal(isStaffWebUnlocked(200, 1_001), false);
});

test('web access rejects a wrong code', () => {
  assert.equal(unlockStaffWeb(300, '000000', 1_000), false);
  assert.equal(isStaffWebUnlocked(300, 1_001), false);
});
