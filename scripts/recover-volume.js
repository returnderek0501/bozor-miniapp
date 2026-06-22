#!/usr/bin/env node
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'fs';
import { dirname, extname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const JSON_FILES = [
  'phones.json',
  'employees.json',
  'sessions.json',
  'tags.json',
  'client_counter.json',
  'operators.json',
  'admins.json',
  'desk_sessions.json',
  'broadcasts.json',
];

const KYC_TYPES = new Set(['idCardFront', 'idCardBack', 'selfie']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function argValue(name) {
  const prefix = `${name}=`;
  const found = process.argv.find(arg => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function resolveDataDir() {
  const fromArg = argValue('--data-dir');
  if (fromArg) return fromArg;
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  if (existsSync('/main')) return '/main';
  return join(repoRoot, 'data');
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = units.shift();
  while (value >= 1024 && units.length) {
    value /= 1024;
    unit = units.shift();
  }
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${unit}`;
}

function safeStat(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

function readJsonFile(path) {
  if (!existsSync(path)) return { ok: false, missing: true, data: null, error: null };
  try {
    return { ok: true, missing: false, data: JSON.parse(readFileSync(path, 'utf8')), error: null };
  } catch (error) {
    return { ok: false, missing: false, data: null, error };
  }
}

function writeJsonAtomic(path, data) {
  const tmpPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  renameSync(tmpPath, path);
}

function scanJsonFiles(dataDir) {
  return JSON_FILES.map(name => {
    const path = join(dataDir, name);
    const stat = safeStat(path);
    const parsed = readJsonFile(path);
    return {
      name,
      path,
      exists: !!stat,
      size: stat?.size || 0,
      mtime: stat?.mtime?.toISOString() || '',
      ok: parsed.ok,
      error: parsed.error?.message || '',
      data: parsed.data,
    };
  });
}

function walkFiles(root) {
  const stat = safeStat(root);
  if (!stat) return [];
  if (stat.isFile()) return [{ path: root, stat }];

  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(path));
    else if (entry.isFile()) files.push({ path, stat: statSync(path) });
  }
  return files;
}

function parseAttachment(dataDir, filePath, stat) {
  const rel = relative(dataDir, filePath).replace(/\\/g, '/');
  const parts = rel.split('/');
  const clientId = parts[0] === 'attachments' ? parts[1] : '';
  const filename = parts.at(-1) || '';
  const ext = extname(filename).toLowerCase();
  const savedAt = stat.mtime.toISOString();
  const mimeType = ext === '.png' ? 'image/png' : ext === '.pdf' ? 'application/pdf' : 'image/jpeg';

  const kycMatch = filename.match(/^kyc_([A-Za-z0-9]+)_(\d+)\.[^.]+$/);
  if (kycMatch && KYC_TYPES.has(kycMatch[1])) {
    return {
      kind: 'kyc',
      docType: kycMatch[1],
      timestamp: Number(kycMatch[2]),
      clientId,
      filename,
      path: rel,
      size: stat.size,
      savedAt,
      mimeType,
    };
  }

  const tagMatch = filename.match(/^(.+)_(\d+)\.[^.]+$/);
  if (tagMatch && IMAGE_EXTENSIONS.has(ext)) {
    return {
      kind: 'tag',
      tagId: tagMatch[1],
      timestamp: Number(tagMatch[2]),
      clientId,
      filename,
      path: rel,
      size: stat.size,
      savedAt,
      mimeType,
    };
  }

  return {
    kind: 'other',
    clientId,
    filename,
    path: rel,
    size: stat.size,
    savedAt,
    mimeType,
  };
}

function scanAttachments(dataDir) {
  const root = join(dataDir, 'attachments');
  return walkFiles(root).map(({ path, stat }) => parseAttachment(dataDir, path, stat));
}

function normalizePhones(raw) {
  if (Array.isArray(raw?.phones)) return raw.phones;
  if (Array.isArray(raw)) return raw;
  return [];
}

function employeesArray(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  return Object.entries(data).map(([phone, emp]) => ({ phone, emp: emp || {} }));
}

function attachmentSummary(attachments) {
  const byClient = new Map();
  let totalBytes = 0;
  for (const item of attachments) {
    totalBytes += item.size;
    const key = item.clientId || 'unknown';
    const current = byClient.get(key) || { clientId: key, total: 0, bytes: 0, kyc: 0, tag: 0, other: 0 };
    current.total += 1;
    current.bytes += item.size;
    current[item.kind] += 1;
    byClient.set(key, current);
  }
  return {
    total: attachments.length,
    totalBytes,
    byClient: [...byClient.values()].sort((a, b) => Number(a.clientId) - Number(b.clientId)),
  };
}

function defaultEmployee(phone, clientId) {
  return {
    phone,
    clientId: String(clientId || ''),
    fullName: '',
    position: 'Agent',
    age: '',
    maritalStatus: '',
    employeeId: '',
    advanceBalance: 0,
    operator: '',
    operatorId: '',
    tags: [],
    tagHistory: [],
    allowedCards: [],
    createdAt: null,
    createdBy: null,
    createdByName: '',
    kycStatus: 'none',
    kycSubmittedAt: null,
    kycReviewedAt: null,
    kycReviewedBy: null,
    kycReviewedByName: '',
    kycRejectionReason: '',
    kycDocuments: { idCardFront: null, idCardBack: null, selfie: null },
    updatedAt: new Date().toISOString(),
  };
}

function latestBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    const current = map.get(key);
    if (!current || (item.timestamp || 0) > (current.timestamp || 0)) map.set(key, item);
  }
  return map;
}

function mergeAttachmentsIntoEmployee(emp, attachments) {
  const now = new Date().toISOString();
  const byDoc = latestBy(attachments.filter(item => item.kind === 'kyc'), item => item.docType);
  const docs = { ...(emp.kycDocuments || {}) };
  let addedKyc = 0;
  for (const docType of KYC_TYPES) {
    if (!docs[docType]?.path && byDoc.has(docType)) {
      const item = byDoc.get(docType);
      docs[docType] = { path: item.path, mimeType: item.mimeType, savedAt: item.savedAt };
      addedKyc += 1;
    }
  }
  emp.kycDocuments = {
    idCardFront: docs.idCardFront || null,
    idCardBack: docs.idCardBack || null,
    selfie: docs.selfie || null,
  };
  if (addedKyc && (!emp.kycStatus || emp.kycStatus === 'none')) {
    emp.kycStatus = addedKyc === 3 ? 'pending' : 'none';
    emp.kycSubmittedAt = emp.kycSubmittedAt || now;
  }

  const tagPhotos = latestBy(attachments.filter(item => item.kind === 'tag'), item => item.tagId);
  emp.tags = Array.isArray(emp.tags) ? emp.tags : [];
  emp.tagHistory = Array.isArray(emp.tagHistory) ? emp.tagHistory : [];
  let addedTags = 0;
  for (const item of tagPhotos.values()) {
    let tag = emp.tags.find(t => t.id === item.tagId);
    if (!tag) {
      tag = {
        id: item.tagId,
        label: item.tagId,
        assignedAt: item.savedAt,
        assignedBy: null,
        assignedByName: 'volume recovery',
        note: '',
      };
      emp.tags.push(tag);
      addedTags += 1;
    }
    if (!tag.photo?.path) {
      tag.photo = { path: item.path, mimeType: item.mimeType, savedAt: item.savedAt };
    }
    emp.tagHistory.push({
      id: item.tagId,
      label: tag.label || item.tagId,
      action: 'photo',
      at: item.savedAt,
      by: null,
      byName: 'volume recovery',
      photo: tag.photo,
    });
  }

  if (addedKyc || addedTags) emp.updatedAt = now;
  return { addedKyc, addedTags };
}

function buildRecoveredEmployees({ phones, employees, attachments, allowSequentialGuess }) {
  const all = {};
  const existing = employeesArray(employees);
  const byPhone = new Map(existing.map(({ phone, emp }) => [phone, emp]));
  const byClient = new Map();
  for (const item of attachments) {
    if (!item.clientId) continue;
    const list = byClient.get(String(item.clientId)) || [];
    list.push(item);
    byClient.set(String(item.clientId), list);
  }

  let guessed = 0;
  let mergedKyc = 0;
  let mergedTags = 0;
  const warnings = [];

  phones.forEach((phone, index) => {
    const current = byPhone.get(phone) || defaultEmployee(phone, '');
    if (!current.phone) current.phone = phone;
    if (!current.clientId && allowSequentialGuess) {
      current.clientId = String(index + 1);
      guessed += 1;
    }
    const clientAttachments = current.clientId ? byClient.get(String(current.clientId)) || [] : [];
    if (clientAttachments.length) {
      const merged = mergeAttachmentsIntoEmployee(current, clientAttachments);
      mergedKyc += merged.addedKyc;
      mergedTags += merged.addedTags;
    } else if (!current.clientId) {
      warnings.push(`${phone}: no clientId, cannot map attachments safely`);
    }
    all[phone] = current;
  });

  if (guessed) {
    warnings.push(`Guessed ${guessed} clientId values from phones.json order. Verify before applying.`);
  }

  const referencedClientIds = new Set(Object.values(all).map(emp => String(emp.clientId || '')).filter(Boolean));
  const orphanClientIds = [...byClient.keys()].filter(clientId => !referencedClientIds.has(clientId));
  if (orphanClientIds.length) {
    warnings.push(`Attachments for clientId(s) without matching employee: ${orphanClientIds.slice(0, 20).join(', ')}${orphanClientIds.length > 20 ? '...' : ''}`);
  }

  return { employees: all, mergedKyc, mergedTags, warnings };
}

function printJsonStatus(rows) {
  console.log('\nJSON files:');
  for (const row of rows) {
    if (!row.exists) {
      console.log(`- ${row.name}: missing`);
      continue;
    }
    const status = row.ok ? 'ok' : `BROKEN (${row.error})`;
    console.log(`- ${row.name}: ${status}, ${formatBytes(row.size)}, ${row.mtime}`);
  }
}

function printAttachmentStatus(summary) {
  console.log('\nAttachments:');
  console.log(`- files: ${summary.total}`);
  console.log(`- size: ${formatBytes(summary.totalBytes)}`);
  console.log(`- client folders: ${summary.byClient.length}`);
  for (const row of summary.byClient.slice(0, 15)) {
    console.log(`  #${row.clientId}: ${row.total} files (${row.kyc} kyc, ${row.tag} tag, ${row.other} other), ${formatBytes(row.bytes)}`);
  }
  if (summary.byClient.length > 15) console.log(`  ... ${summary.byClient.length - 15} more`);
}

function usage() {
  console.log(`
Usage:
  npm run recover:volume -- [options]

Options:
  --data-dir=/main                 Data directory to inspect
  --write-recovered-employees      Write employees.recovered.json
  --apply                          Backup employees.json and replace it with recovered file
  --allow-sequential-client-id-guess
                                   Guess clientId by phones.json order when missing

Safe first command:
  npm run recover:volume -- --data-dir=/main

Recovery draft:
  npm run recover:volume -- --data-dir=/main --write-recovered-employees
`);
}

function main() {
  if (hasFlag('--help') || hasFlag('-h')) {
    usage();
    return;
  }

  const dataDir = resolveDataDir();
  console.log(`Data directory: ${dataDir}`);
  if (!existsSync(dataDir)) {
    console.error(`Data directory does not exist: ${dataDir}`);
    process.exitCode = 1;
    return;
  }

  const jsonRows = scanJsonFiles(dataDir);
  printJsonStatus(jsonRows);

  const phonesRow = jsonRows.find(row => row.name === 'phones.json');
  const employeesRow = jsonRows.find(row => row.name === 'employees.json');
  const phones = normalizePhones(phonesRow?.data);
  const employees = employeesRow?.ok ? employeesRow.data : {};
  const employeeCount = employeesArray(employees).length;

  const attachments = scanAttachments(dataDir);
  const summary = attachmentSummary(attachments);
  printAttachmentStatus(summary);

  console.log('\nData shape:');
  console.log(`- phones: ${phones.length}`);
  console.log(`- employees: ${employeeCount}`);
  console.log(`- KYC files: ${attachments.filter(item => item.kind === 'kyc').length}`);
  console.log(`- tag photo files: ${attachments.filter(item => item.kind === 'tag').length}`);

  if (phones.length && !employeeCount && summary.total) {
    console.log('\nDiagnosis: phones exist and attachments exist, but employees are empty/broken. Metadata recovery is needed.');
  } else if (phones.length && employeeCount && summary.total) {
    console.log('\nDiagnosis: employees and attachments exist. If UI is empty, compare clientId values and JSON parse status above.');
  }

  if (!hasFlag('--write-recovered-employees') && !hasFlag('--apply')) return;

  const recovered = buildRecoveredEmployees({
    phones,
    employees,
    attachments,
    allowSequentialGuess: hasFlag('--allow-sequential-client-id-guess'),
  });

  const recoveredPath = join(dataDir, 'employees.recovered.json');
  writeJsonAtomic(recoveredPath, recovered.employees);
  console.log(`\nWrote recovery draft: ${recoveredPath}`);
  console.log(`- merged KYC document references: ${recovered.mergedKyc}`);
  console.log(`- merged tag photo references: ${recovered.mergedTags}`);
  for (const warning of recovered.warnings) console.log(`WARNING: ${warning}`);

  if (hasFlag('--apply')) {
    const target = join(dataDir, 'employees.json');
    const backup = join(dataDir, `employees.before-recovery-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    if (existsSync(target)) copyFileSync(target, backup);
    writeJsonAtomic(target, recovered.employees);
    console.log(`Applied recovery to ${target}`);
    if (existsSync(backup)) console.log(`Backup saved: ${backup}`);
  } else {
    console.log('\nReview employees.recovered.json first. Re-run with --apply only after verifying mapping.');
  }
}

main();
