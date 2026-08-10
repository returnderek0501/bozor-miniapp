import {
  readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, copyFileSync, unlinkSync,
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function resolveDataDir() {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  if (existsSync('/main')) return '/main';
  return join(__dirname, '..', 'data');
}

export const DATA_DIR = resolveDataDir();

const jsonLocks = new Map();

export function ensureDataDir() {
  const dir = getDataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readJsonFile(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function readJson(file, fallback) {
  ensureDataDir();
  if (!existsSync(file)) {
    const bak = `${file}.bak`;
    if (existsSync(bak)) {
      try {
        return readJsonFile(bak);
      } catch (error) {
        console.error(`Failed to parse backup ${bak}:`, error.message);
      }
    }
    return fallback;
  }
  try {
    return readJsonFile(file);
  } catch (error) {
    console.error(`Failed to parse ${file}:`, error.message);
    const bak = `${file}.bak`;
    if (existsSync(bak)) {
      try {
        console.error(`Restoring ${file} from backup`);
        return readJsonFile(bak);
      } catch (backupError) {
        console.error(`Failed to parse backup ${bak}:`, backupError.message);
      }
    }
    return fallback;
  }
}

export function writeJson(file, data) {
  ensureDataDir();
  const payload = `${JSON.stringify(data, null, 2)}\n`;
  const tempFile = `${file}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tempFile, payload);
  try {
    if (existsSync(file)) {
      try {
        copyFileSync(file, `${file}.bak`);
      } catch (error) {
        console.error(`Failed to backup ${file}:`, error.message);
      }
    }
    renameSync(tempFile, file);
  } catch (error) {
    try {
      writeFileSync(file, payload);
    } finally {
      try {
        if (existsSync(tempFile)) unlinkSync(tempFile);
      } catch {
        // ignore cleanup errors
      }
    }
    if (!existsSync(file)) throw error;
  }
}

/**
 * Serialize read-modify-write updates for a JSON file across async awaits.
 */
export async function updateJson(file, fallback, updater) {
  const previous = jsonLocks.get(file) || Promise.resolve();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const run = previous.catch(() => {}).then(async () => {
    try {
      const current = readJson(file, fallback);
      const next = await updater(current);
      if (next !== undefined) writeJson(file, next);
      return next === undefined ? current : next;
    } finally {
      release();
    }
  });
  jsonLocks.set(file, gate.catch(() => {}));
  return run;
}

export function updateJsonSync(file, fallback, updater) {
  const current = readJson(file, fallback);
  const next = updater(current);
  if (next !== undefined) writeJson(file, next);
  return next === undefined ? current : next;
}

export function getDataDir() {
  return resolveDataDir();
}
