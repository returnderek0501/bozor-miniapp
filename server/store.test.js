import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('updateEmployeeFields validates all values before writing', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'uztronix-store-test-'));
  process.env.DATA_DIR = dataDir;
  const store = await import('./store.js');

  try {
    const phone = store.addPhone('+998901234567');
    store.setSession(123456, phone, {
      username: 'test_client',
      first_name: 'Test',
      last_name: 'Client',
    });
    const linkedSession = store.getSessionByPhone(phone);
    assert.equal(linkedSession.telegramId, 123456);
    assert.equal(linkedSession.username, 'test_client');
    assert.equal(linkedSession.firstName, 'Test');

    store.updateEmployeeFields(phone, {
      name: 'Original Name',
      age: 30,
      balance: 1000,
    });

    assert.throws(() => store.updateEmployeeFields(phone, {
      name: 'Should Not Persist',
      age: 0,
    }), /1–120/);

    const employee = store.getEmployee(phone);
    assert.equal(employee.fullName, 'Original Name');
    assert.equal(employee.age, 30);
    assert.equal(employee.advanceBalance, 1000);
    assert.throws(
      () => store.updateEmployeeFields(phone, { balance: -1 }),
      /отрицательным/,
    );

    const beforeTagChange = employee.updatedAt;
    await new Promise(resolve => setTimeout(resolve, 5));
    const tagged = store.addClientTag(phone, 'pasport', { id: 7, name: 'Admin' });
    assert.equal(tagged.tags.some(tag => tag.id === 'pasport'), true);
    assert.equal(tagged.updatedAt > beforeTagChange, true);

    const beforeTagRemoval = tagged.updatedAt;
    await new Promise(resolve => setTimeout(resolve, 5));
    const untagged = store.removeClientTag(phone, 'pasport', { id: 7, name: 'Admin' });
    assert.equal(untagged.tags.some(tag => tag.id === 'pasport'), false);
    assert.equal(untagged.updatedAt > beforeTagRemoval, true);
    assert.deepEqual(
      untagged.tagHistory.slice(-2).map(entry => entry.action),
      ['add', 'remove'],
    );
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});
