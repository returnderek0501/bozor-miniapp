import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
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

export function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export function readJson(file, fallback, options = {}) {
  ensureDataDir();
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    console.error(`Failed to read JSON ${file}: ${error.message}`);
    if (options.critical) throw error;
    return fallback;
  }
}

export function writeJson(file, data) {
  ensureDataDir();
  const tmpFile = `${file}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmpFile, JSON.stringify(data, null, 2));
  renameSync(tmpFile, file);
}

export function getDataDir() {
  return DATA_DIR;
}
