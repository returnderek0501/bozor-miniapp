import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';

test('staff tag routes support approved clients that do not have a phone yet', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'uztronix-routes-test-'));
  const previousDataDir = process.env.DATA_DIR;
  const previousDemoAuth = process.env.ALLOW_DEMO_AUTH;
  const previousAdminIds = process.env.ADMIN_IDS;
  process.env.DATA_DIR = dataDir;
  process.env.ALLOW_DEMO_AUTH = 'true';
  process.env.ADMIN_IDS = '999001';

  let server;
  try {
    const [{ createApiRouter }, onboarding, operators, panelAccess, store] = await Promise.all([
      import('./routes.js'),
      import('./onboardingKyc.js'),
      import('./operators.js'),
      import('./panelAccess.js'),
      import('./store.js'),
    ]);
    const telegramId = 555002;
    onboarding.submitOnboardingKyc({
      id: telegramId,
      username: 'taggable_lead',
      first_name: 'Taggable',
      last_name: 'Lead',
    }, {
      idCardFront: { path: 'attachments/tg_555002/front.jpg' },
      idCardBack: { path: 'attachments/tg_555002/back.jpg' },
      selfie: { path: 'attachments/tg_555002/selfie.jpg' },
    });
    onboarding.reviewOnboardingKyc(telegramId, 'approved', { id: 999001, name: 'Admin' });
    const operatorId = 999002;
    operators.addOperator('Restricted operator', operatorId);
    panelAccess.markStaffWebUnlocked(999001);
    panelAccess.markStaffWebUnlocked(operatorId);

    const app = express();
    app.use(express.json());
    app.use('/api', createApiRouter(''));
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}/api/staff/clients/tg_${telegramId}`;

    const operatorDashboardResponse = await fetch(
      `http://127.0.0.1:${address.port}/api/staff/dashboard?demoId=${operatorId}`,
    );
    assert.equal(operatorDashboardResponse.status, 200);
    const operatorDashboard = await operatorDashboardResponse.json();
    assert.equal(
      operatorDashboard.clients.some(client => client.clientId === `tg_${telegramId}`),
      false,
    );

    const deniedResponse = await fetch(`${baseUrl}/tags?demoId=${operatorId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagId: 'v_rabote' }),
    });
    assert.equal(deniedResponse.status, 404);
    assert.deepEqual(onboarding.getOnboardingKyc(telegramId).tags, []);

    const invalidTagResponse = await fetch(`${baseUrl}/tags?demoId=999001`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: { unexpected: true } }),
    });
    assert.equal(invalidTagResponse.status, 400);
    assert.deepEqual(onboarding.getOnboardingKyc(telegramId).tags, []);

    const jpeg = Buffer.alloc(512);
    jpeg.set([0xff, 0xd8, 0xff]);
    const assignedResponse = await fetch(`${baseUrl}/tags?demoId=999001`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tagId: 'v_rabote',
        photo: `data:image/jpeg;base64,${jpeg.toString('base64')}`,
      }),
    });
    assert.equal(assignedResponse.status, 200);
    const assigned = await assignedResponse.json();
    assert.equal(assigned.client.provisional, true);
    assert.deepEqual(assigned.client.tags, [{ id: 'v_rabote', label: 'В работе' }]);
    assert.equal(onboarding.getOnboardingKyc(telegramId).tags[0].id, 'v_rabote');

    const photoResponse = await fetch(`${baseUrl}/tags/v_rabote/photo?demoId=999001`);
    assert.equal(photoResponse.status, 200);
    assert.match(photoResponse.headers.get('content-type') || '', /^image\/jpeg/);
    assert.deepEqual(Buffer.from(await photoResponse.arrayBuffer()), jpeg);

    const removedResponse = await fetch(
      `${baseUrl}/tags/v_rabote?demoId=999001`,
      { method: 'DELETE' },
    );
    assert.equal(removedResponse.status, 200);
    const removed = await removedResponse.json();
    assert.deepEqual(removed.client.tags, []);
    assert.deepEqual(
      onboarding.getOnboardingKyc(telegramId).tagHistory.map(entry => entry.action),
      ['photo', 'remove'],
    );

    const reassignedResponse = await fetch(`${baseUrl}/tags?demoId=999001`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagId: 'v_rabote' }),
    });
    assert.equal(reassignedResponse.status, 200);

    const phone = '+998901112233';
    store.addPhone(phone, { id: 999001, name: 'Admin' });
    const authResponse = await fetch(
      `http://127.0.0.1:${address.port}/api/auth/verify?demoId=${telegramId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      },
    );
    assert.equal(authResponse.status, 200);
    assert.deepEqual(
      store.getEmployee(phone).tags.map(tag => ({ id: tag.id, label: tag.label })),
      [{ id: 'v_rabote', label: 'В работе' }],
    );
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (previousDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previousDataDir;
    if (previousDemoAuth === undefined) delete process.env.ALLOW_DEMO_AUTH;
    else process.env.ALLOW_DEMO_AUTH = previousDemoAuth;
    if (previousAdminIds === undefined) delete process.env.ADMIN_IDS;
    else process.env.ADMIN_IDS = previousAdminIds;
    rmSync(dataDir, { recursive: true, force: true });
  }
});
