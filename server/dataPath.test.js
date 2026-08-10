import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeJson, readJson } from './dataPath.js';

test('writeJson uses atomic replace and keeps a backup', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'uztronix-datapath-'));
  const previous = process.env.DATA_DIR;
  process.env.DATA_DIR = dataDir;
  const file = join(dataDir, 'sample.json');

  try {
    writeJson(file, { value: 1 });
    assert.deepEqual(readJson(file, null), { value: 1 });
    writeJson(file, { value: 2 });
    assert.deepEqual(readJson(file, null), { value: 2 });
    assert.equal(existsSync(`${file}.bak`), true);
    assert.deepEqual(JSON.parse(readFileSync(`${file}.bak`, 'utf8')), { value: 1 });
  } finally {
    if (previous === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previous;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('readJson falls back to .bak when primary JSON is corrupt', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'uztronix-datapath-bak-'));
  const previous = process.env.DATA_DIR;
  process.env.DATA_DIR = dataDir;
  const file = join(dataDir, 'broken.json');
  writeFileSync(`${file}.bak`, JSON.stringify({ ok: true }));
  writeFileSync(file, '{not-json');

  try {
    assert.deepEqual(readJson(file, { ok: false }), { ok: true });
  } finally {
    if (previous === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previous;
    rmSync(dataDir, { recursive: true, force: true });
  }
});
