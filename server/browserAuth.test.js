import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getBrowserAdminPath,
  loginBrowserAdmin,
  signBrowserSession,
  verifyBrowserSession,
  parseCookies,
  browserSessionCookie,
} from './browserAuth.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('browser admin path defaults to secret path and sanitizes env overrides', () => {
  const previous = process.env.BROWSER_ADMIN_PATH;
  try {
    delete process.env.BROWSER_ADMIN_PATH;
    assert.equal(getBrowserAdminPath(), '/ops-uztronix-x7m2');
    process.env.BROWSER_ADMIN_PATH = '/crm-secret-desk';
    assert.equal(getBrowserAdminPath(), '/crm-secret-desk');
    process.env.BROWSER_ADMIN_PATH = 'no-slash';
    assert.equal(getBrowserAdminPath(), '/ops-uztronix-x7m2');
  } finally {
    if (previous === undefined) delete process.env.BROWSER_ADMIN_PATH;
    else process.env.BROWSER_ADMIN_PATH = previous;
  }
});

test('browser session tokens are signed and expire', () => {
  const now = 1_000_000;
  const token = signBrowserSession(8889663205, now);
  assert.deepEqual(verifyBrowserSession(token, now + 10), {
    telegramId: 8889663205,
    expiresAt: now + (12 * 60 * 60 * 1000),
  });
  assert.equal(verifyBrowserSession(token, now + (12 * 60 * 60 * 1000) + 1), null);
  assert.equal(verifyBrowserSession(`${token}x`, now + 10), null);
});

test('browser login accepts only admins with panel secret', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'uztronix-browser-auth-'));
  const previous = process.env.DATA_DIR;
  process.env.DATA_DIR = dataDir;
  try {
    const ok = loginBrowserAdmin(8889663205, '887766', 5_000);
    assert.equal(ok.ok, true);
    assert.ok(ok.token);

    const denied = loginBrowserAdmin(111111, '887766', 5_000);
    assert.equal(denied.ok, false);
    assert.equal(denied.error, 'ADMIN_REQUIRED');

    const wrong = loginBrowserAdmin(8889663205, '000000', 6_000);
    assert.equal(wrong.ok, false);
    assert.equal(wrong.error, 'ACCESS_DENIED');

    const cookie = browserSessionCookie(ok.token, { secure: true });
    assert.match(cookie, /uz_browser_staff=/);
    assert.match(cookie, /Secure/);
    assert.deepEqual(parseCookies(`a=1; ${cookie.split(';')[0]}`).uz_browser_staff, ok.token);
  } finally {
    if (previous === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previous;
    rmSync(dataDir, { recursive: true, force: true });
  }
});
