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
    assert.throws(
      () => store.updateEmployeeFields(phone, { balance: Number.POSITIVE_INFINITY }),
      /butun raqam/,
    );
    assert.throws(
      () => store.updateEmployeeFields(phone, { age: 30.5 }),
      /butun raqam/,
    );
    assert.throws(
      () => store.updateEmployeeFields(phone, { name: { nested: true } }),
      /строкой/,
    );
    assert.throws(
      () => store.updateEmployeeFields(phone, { name: 'x'.repeat(121) }),
      /слишком длинное/,
    );
    assert.throws(
      () => store.updateEmployeeFields(phone, { balance: [] }),
      /butun raqam/,
    );

    const clearedAge = store.updateEmployeeFields(phone, { age: '' });
    assert.equal(clearedAge.age, '');

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

    const discoveredTag = store.addClientTagByDefinition(
      phone,
      'operator_custom_tag',
      'Кастомный тег оператора',
      { id: 7, name: 'Admin' },
    );
    assert.equal(discoveredTag.tags.some(tag => (
      tag.id === 'operator_custom_tag' && tag.label === 'Кастомный тег оператора'
    )), true);

    store.addClientTagByDefinition(phone, 'removed_later', 'Снять позднее', { id: 7, name: 'Admin' });
    const removedLater = store.mergeClientTagState(phone, [], [{
      id: 'removed_later',
      label: 'Снять позднее',
      action: 'remove',
      at: '2099-01-01T00:00:00.000Z',
      by: 8,
      byName: 'Onboarding admin',
    }]);
    assert.equal(removedLater.tags.some(tag => tag.id === 'removed_later'), false);

    store.addClientTagByDefinition(phone, 'added_later', 'Вернуть позднее', { id: 7, name: 'Admin' });
    store.removeClientTag(phone, 'added_later', { id: 7, name: 'Admin' });
    const addedLater = store.mergeClientTagState(phone, [{
      id: 'added_later',
      label: 'Вернуть позднее',
      assignedAt: '2099-01-02T00:00:00.000Z',
      assignedBy: 8,
      assignedByName: 'Onboarding admin',
    }], [{
      id: 'added_later',
      label: 'Вернуть позднее',
      action: 'add',
      at: '2099-01-02T00:00:00.000Z',
      by: 8,
      byName: 'Onboarding admin',
    }]);
    assert.equal(addedLater.tags.some(tag => tag.id === 'added_later'), true);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});
