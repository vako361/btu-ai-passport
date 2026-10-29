import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PDFDocument, PDFPage, type PDFImage } from 'pdf-lib';
import { generatePassportPDF } from '../lib/pdfGenerator';
import { readPassportPdf, storePassportPdf } from '../lib/passportStorage';

const VERIFICATION_ID = 'VER-TEST0123456789ABCDEF01';
const EXPECTED_PAGES = 7;

const student = {
  'Student ID': 'S-100',
  'First Name': 'ნინო',
  'Last Name': 'ბერიძე',
  'Passport ID': 'BTU-AI-S-100',
  'First Issued At': '2026-10-26',
  'Passport Version': 1,
  'Issued At': '2026-10-26T12:00:00.000Z',
};

const skills = [
  { 'Skill Code': 'SKL-011', 'Skill Name': 'Auto-Generated Skill SKL-011', 'Date Earned': '2026-10-18', 'Skill Description': 'Automatically created via webhook for code SKL-011.', 'Badge/Stamp': 'BDG-AI-001' },
  { 'Skill Code': 'AI-002', 'Skill Name': 'ხელოვნური ინტელექტის უნარი', 'Date Earned': '2026-10-21', 'Skill Description': 'უნივერსიტეტის მიერ დადასტურებული უნარი.' },
  { 'Skill Code': 'AI-003', 'Skill Name': 'Prompt Engineering', 'Date Earned': '2026-10-22', 'Skill Description': 'Prompting techniques.' },
  ...Array.from({ length: 10 }, (_, index) => ({
    'Skill Code': `AI-${String(index + 4).padStart(3, '0')}`,
    'Skill Name': `Verified AI Skill ${index + 4}`,
    'Date Earned': `2026-10-${String(index + 23).padStart(2, '0')}`,
    'Skill Description': 'A verified AI skill for pagination coverage.',
  })),
];

async function checkOfficialBadges() {
  const badgeGroups = [
    {
      file: 'badge_focused.png',
      code: 'BDG-AI-001',
      names: ['FOCUSED LEARNING', 'AI SKILL', 'PROMPT ENGINEERING', 'AI ETHICS & RESPONSIBLE USE', 'BDG-AI-001'],
    },
    {
      file: 'badge_applied.png',
      code: 'BDG-AI-002',
      names: ['APPLIED LEARNING', 'AI APPLIED SKILL', 'AI WORKFLOW AUTOMATION', 'AI AGENTS', 'BDG-AI-002'],
    },
    {
      file: 'badge_advanced.png',
      code: 'BDG-AI-003',
      names: ['EXTENDED ACADEMIC LEARNING', 'AI ADVANCED SKILL', 'DATA ANALYSIS WITH AI', 'DATE ANALYSIS WITH AI', 'BDG-AI-003'],
    },
  ];
  const originalEmbedPng = PDFDocument.prototype.embedPng;
  const originalDrawImage = PDFPage.prototype.drawImage;
  const originalConsoleError = console.error;
  const originalBaseUrl = process.env.PUBLIC_BASE_URL;
  const embedded: Buffer[] = [];
  const drawn: PDFImage[] = [];
  const missingOfficialCodes: string[] = [];
  PDFDocument.prototype.embedPng = function (image) {
    if (typeof image !== 'string') embedded.push(Buffer.from(image instanceof ArrayBuffer ? new Uint8Array(image) : image));
    return originalEmbedPng.call(this, image);
  };
  PDFPage.prototype.drawImage = function (image, options) {
    drawn.push(image);
    return originalDrawImage.call(this, image, options);
  };
  console.error = (...args) => {
    if (args[0] === 'BADGE MAPPING NOT FOUND:' && typeof args[1] === 'object' && args[1] !== null) {
      const badgeId = (args[1] as { badgeId?: unknown }).badgeId;
      if (typeof badgeId === 'string' && /^\s*BDG-AI-00[1-3]\s*$/i.test(badgeId)) missingOfficialCodes.push(badgeId);
    }
    originalConsoleError(...args);
  };
  delete process.env.PUBLIC_BASE_URL;

  try {
    for (const group of badgeGroups) {
      embedded.length = 0;
      drawn.length = 0;
      const expected = await readFile(path.join(process.cwd(), 'assets', group.file));
      const badgeSkills = [
        ...group.names.map((name) => ({ 'Skill Name': name.toLowerCase() })),
        { 'Skill Name': 'Unmapped name', category: group.names[0] },
        { 'Skill Name': 'Unmapped name', skillCode: group.names[1] },
        { 'Skill Name': 'Unmapped name', badgeId: `  ${group.code.toLowerCase()}  ` },
        { 'Skill Name': 'Unmapped name', badge: group.file },
        ...(group.file === 'badge_focused.png' ? [{
          'Skill Name': 'Auto-Generated Skill SKL-002',
          'Skill Code': 'SKL-002',
          'Badge/Stamp': 'BDG-SKL-002',
        }] : []),
      ];
      await generatePassportPDF(student, badgeSkills, VERIFICATION_ID);
      if (missingOfficialCodes.length) return false;
      if (embedded.length !== 1 || !embedded[0].equals(expected)) return false;
      if (drawn.length !== badgeSkills.length * 2 || new Set(drawn).size !== 1) return false;
    }

    embedded.length = 0;
    drawn.length = 0;
    await generatePassportPDF(student, [
      { 'Skill Name': 'Unmapped skill', 'Badge/Stamp': '1_1@3x.png' },
      { 'Skill Name': 'Unmapped skill', badge: 'default_badge.png' },
    ], VERIFICATION_ID);
    return embedded.length === 0 && drawn.length === 0;
  } finally {
    PDFDocument.prototype.embedPng = originalEmbedPng;
    PDFPage.prototype.drawImage = originalDrawImage;
    console.error = originalConsoleError;
    if (originalBaseUrl === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = originalBaseUrl;
  }
}

async function checkSystemTempStorage(pdf: Buffer) {
  const previousDir = process.env.PASSPORT_STORAGE_DIR;
  const previousKey = process.env.PASSPORT_STORAGE_KEY;
  const verificationId = 'VER-TMPDIRCHECK00000000001';
  const storedFile = path.join(os.tmpdir(), 'passports', `${verificationId}.pdf.enc`);
  process.env.PASSPORT_STORAGE_DIR = os.tmpdir();
  process.env.PASSPORT_STORAGE_KEY = 'ab'.repeat(32);
  try {
    const hash = `0x${createHash('sha256').update(pdf).digest('hex')}`;
    await storePassportPdf(verificationId, pdf, hash);
    return (await readPassportPdf(verificationId, hash)).equals(pdf) && (await readFile(storedFile)).length > 0;
  } finally {
    await rm(storedFile, { force: true });
    if (previousDir === undefined) delete process.env.PASSPORT_STORAGE_DIR;
    else process.env.PASSPORT_STORAGE_DIR = previousDir;
    if (previousKey === undefined) delete process.env.PASSPORT_STORAGE_KEY;
    else process.env.PASSPORT_STORAGE_KEY = previousKey;
  }
}

async function main() {
  const first = await generatePassportPDF(student, skills, VERIFICATION_ID);
  const second = await generatePassportPDF(student, skills, VERIFICATION_ID);

  const samplePath = path.join(os.tmpdir(), 'passport-sample.pdf');
  await writeFile(samplePath, first);

  const document = await PDFDocument.load(first);
  const secondDocument = await PDFDocument.load(second);
  const subject = document.getSubject();
  const pageCount = document.getPageCount();
  const creationDate = document.getCreationDate();
  const secondCreationDate = secondDocument.getCreationDate();
  const previousStorageDir = process.env.PASSPORT_STORAGE_DIR;
  const previousStorageKey = process.env.PASSPORT_STORAGE_KEY;
  const storageDir = await mkdtemp(path.join(os.tmpdir(), 'passport-pdf-test-'));
  process.env.PASSPORT_STORAGE_DIR = storageDir;
  process.env.PASSPORT_STORAGE_KEY = 'ab'.repeat(32);
  let storedBytesMatch = false;
  try {
    const hash = `0x${createHash('sha256').update(first).digest('hex')}`;
    await storePassportPdf(VERIFICATION_ID, first, hash);
    storedBytesMatch = (await readPassportPdf(VERIFICATION_ID, hash)).equals(first);
  } finally {
    await rm(storageDir, { recursive: true, force: true });
    if (previousStorageDir === undefined) delete process.env.PASSPORT_STORAGE_DIR;
    else process.env.PASSPORT_STORAGE_DIR = previousStorageDir;
    if (previousStorageKey === undefined) delete process.env.PASSPORT_STORAGE_KEY;
    else process.env.PASSPORT_STORAGE_KEY = previousStorageKey;
  }

  const checks = [
    { name: 'subject equals Verification ID', ok: subject === VERIFICATION_ID, detail: `subject=${subject}` },
    { name: `page count is ${EXPECTED_PAGES} for 13 skills`, ok: pageCount === EXPECTED_PAGES, detail: `pages=${pageCount}` },
    {
      name: 'creation date stable across renders',
      ok: creationDate?.getTime() === secondCreationDate?.getTime() && creationDate?.toISOString() === student['Issued At'],
      detail: `first=${creationDate?.toISOString()} second=${secondCreationDate?.toISOString()}`,
    },
    { name: 'stored PDF bytes match issued bytes', ok: storedBytesMatch, detail: `bytes=${first.length}` },
    { name: 'storage works when PASSPORT_STORAGE_DIR is the system temp dir', ok: await checkSystemTempStorage(first), detail: 'tmpdir/passports' },
    { name: 'official badges only, with cached aliases', ok: await checkOfficialBadges(), detail: '3 official PNGs' },
  ];

  for (const check of checks) console.log(`${check.ok ? 'PASS' : 'FAIL'}  ${check.name}  (${check.detail})`);
  console.log(`Sample written to ${samplePath}`);

  if (checks.some((check) => !check.ok)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
