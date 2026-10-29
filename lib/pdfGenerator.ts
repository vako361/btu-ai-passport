import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import type { PassportSkillData, PassportStudentData } from '@/lib/passportTypes';

type DrawSkill = PassportSkillData & {
  'Skill Code'?: string;
  'Stamp Type'?: string;
  Category?: string;
  'Earned Through'?: string;
  'Learning Format'?: string;
  recordId?: string;
  badge?: string;
  badgeId?: string;
  stampType?: string;
  category?: string;
  skillCode?: string;
  earnedThrough?: string;
  learningFormat?: string;
  source?: string;
};

const BADGE_MAPPING: Record<string, string> = {
  'FOCUSED LEARNING': 'badge_focused.png',
  'AI SKILL': 'badge_focused.png',
  'PROMPT ENGINEERING': 'badge_focused.png',
  'AI ETHICS & RESPONSIBLE USE': 'badge_focused.png',
  'SKL-002': 'badge_focused.png',
  'BDG-AI-001': 'badge_focused.png',
  'APPLIED LEARNING': 'badge_applied.png',
  'AI APPLIED SKILL': 'badge_applied.png',
  'AI WORKFLOW AUTOMATION': 'badge_applied.png',
  'AI AGENTS': 'badge_applied.png',
  'BDG-AI-002': 'badge_applied.png',
  'EXTENDED ACADEMIC LEARNING': 'badge_advanced.png',
  'AI ADVANCED SKILL': 'badge_advanced.png',
  'DATA ANALYSIS WITH AI': 'badge_advanced.png',
  'DATE ANALYSIS WITH AI': 'badge_advanced.png',
  'BDG-AI-003': 'badge_advanced.png',
};

const PAGE_HEIGHT = 595.276;
const PX = 0.75; // template coordinates below are measured at 96 dpi from the top-left
const x = (px: number) => px * PX;
const y = (px: number) => PAGE_HEIGHT - px * PX;

const GRID_PER_PAGE = 10;
const TABLE_ROWS_PER_PAGE = 5;
const TEMPLATE_PAGES = { cover: 0, about: 1, grid: 2, table: 3 } as const;

const INK = rgb(0x1e / 255, 0x21 / 255, 0x26 / 255);
const BTU_PINK = rgb(0.996, 0.004, 0.494);
const MUTED = rgb(0.29, 0.29, 0.29);
const WHITE = rgb(1, 1, 1);

// Page 1 positions in PDF points from the bottom-left, measured from the template's printed labels.
const COVER = {
  firstName: { x: 196, y: 322, size: 20, maxWidth: 380 },
  lastName: { x: 246, y: 282, size: 20, maxWidth: 330 },
  date: { x: 650, y: 330, size: 14 },
  passportId: { centerX: 722.5, y: 88, size: 9 },
  verificationId: { rightX: 800, y: 15, size: 7 },
};

// Pages 1/3 have little room right of "PASSPORT ID:", so the value sits beneath the label.
const PASSPORT_ID_BELOW_LABEL = { rightX: 1040, y: 678, size: 8 };
const PASSPORT_ID_AFTER_LABEL = { x: 206, y: 656, size: 9 };

// Page 3: 5 columns x 2 rows of 175x202 px cards.
const GRID = {
  columnLeft: [104, 290, 477, 663, 849],
  rowTop: [185, 400],
  cardWidth: 175,
  badgeCenterY: 88,
  badgeBackdropRadius: 36,
  badgeSize: 52,
  nameBaselineY: 156,
  nameLineHeight: 12.5,
  codeBaselineY: 188,
  textWidth: 148,
};

// Page 4 coordinates are PDF points from the bottom-left.
const TABLE = {
  rowCentersY: [379, 325, 271, 217, 163],
  stampCenterX: 141,
  stampWidth: 85,
  stampHeight: 32,
  skill: { centerX: 252, width: 88 },
  description: { centerX: 373, width: 136 },
  earnedThrough: { centerX: 533, width: 154 },
  date: { centerX: 698, width: 132 },
};

const QR = { about: { x: 340, y: 700 }, table: { x: 560, y: 700 }, sizePt: 38 };
const VERIFICATION_FOOTER = { rightX: 1086, y: 772, size: 7 };

type Fonts = { geoRegular: PDFFont; geoBold: PDFFont; latRegular: PDFFont; latBold: PDFFont };
type Align = 'left' | 'center' | 'right';

const isGeorgian = (char: string) => /[\u10A0-\u10FF\u1C90-\u1CBF\u2D00-\u2D2F]/.test(char);

function cleanText(value: string | undefined | null) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

// The Georgian font has no Latin glyphs, so mixed strings are split into per-script runs.
function runs(text: string, fonts: Fonts, bold: boolean) {
  const result: { text: string; font: PDFFont }[] = [];
  let georgian = false;
  for (const char of text) {
    if (!/\s/.test(char)) georgian = isGeorgian(char);
    const font = georgian
      ? (bold ? fonts.geoBold : fonts.geoRegular)
      : (bold ? fonts.latBold : fonts.latRegular);
    const last = result[result.length - 1];
    if (last && last.font === font) last.text += char;
    else result.push({ text: char, font });
  }
  return result;
}

function measure(text: string, size: number, fonts: Fonts, bold: boolean) {
  return runs(text, fonts, bold).reduce((total, run) => total + run.font.widthOfTextAtSize(run.text, size), 0);
}

function drawLine(
  page: PDFPage,
  text: string,
  options: { x: number; y: number; size: number; fonts: Fonts; bold?: boolean; align?: Align; color?: ReturnType<typeof rgb> },
) {
  const bold = options.bold ?? false;
  const content = cleanText(text);
  if (!content) return;

  const width = measure(content, options.size, options.fonts, bold);
  let cursor = options.align === 'center' ? options.x - width / 2 : options.align === 'right' ? options.x - width : options.x;

  for (const run of runs(content, options.fonts, bold)) {
    page.drawText(run.text, { x: cursor, y: options.y, size: options.size, font: run.font, color: options.color ?? INK });
    cursor += run.font.widthOfTextAtSize(run.text, options.size);
  }
}

function wrap(text: string, size: number, fonts: Fonts, bold: boolean, maxWidth: number, maxLines: number) {
  const lines: string[] = [];
  let current = '';

  for (const word of cleanText(text).split(' ').filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate, size, fonts, bold) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);

    // A single over-long word is split by characters.
    let piece = '';
    for (const char of word) {
      if (piece && measure(piece + char, size, fonts, bold) > maxWidth) {
        lines.push(piece);
        piece = char;
      } else {
        piece += char;
      }
    }
    current = piece;
  }
  if (current) lines.push(current);

  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && measure(`${last}…`, size, fonts, bold) > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

function wrapText(text: string, maxCharsPerLine: number) {
  const maxChars = Math.max(1, Math.floor(maxCharsPerLine));
  const lines: string[] = [];
  let current = '';

  for (const word of cleanText(text).split(' ').filter(Boolean)) {
    if (word.length > maxChars) {
      if (current) lines.push(current);
      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      current = '';
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function formatTableDate(value: string | undefined, fallback: string) {
  for (const candidate of [cleanText(value), cleanText(fallback)]) {
    if (!candidate) continue;
    const dateOnly = candidate.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    const date = dateOnly ? new Date(`${dateOnly}T00:00:00.000Z`) : new Date(candidate);
    if (!Number.isNaN(date.getTime())) {
      const formatted = date.toISOString().slice(0, 10);
      if (!dateOnly || formatted === dateOnly) return formatted;
    }
  }
  return '1970-01-01';
}

function fitSize(text: string, size: number, maxWidth: number, fonts: Fonts, bold: boolean) {
  let fitted = size;
  while (fitted > 8 && measure(text, fitted, fonts, bold) > maxWidth) fitted -= 0.5;
  return fitted;
}

function chunk<T>(items: T[], size: number): T[][] {
  if (!items.length) return [[]];
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

const fontBytes = (fileName: string) => fs.readFile(path.join(process.cwd(), 'assets', 'fonts', fileName));

async function loadBadge(doc: PDFDocument, cache: Map<string, PDFImage>, skill: DrawSkill) {
  const badgeInputs = {
    skillCode: skill.skillCode ?? skill['Skill Code'],
    badgeId: skill.badgeId ?? skill.badge ?? skill['Badge/Stamp'],
    stampType: skill.stampType ?? skill['Stamp Type'] ?? skill.category ?? skill.Category,
  };
  console.log("Rendering skill badge:", badgeInputs);

  const normalizedBadgeId = cleanText(skill.badgeId ?? skill.badge ?? skill['Badge/Stamp']).toUpperCase();
  const mappedBadgeIdFile = BADGE_MAPPING[normalizedBadgeId];
  const identifiers = [
    skill.badge,
    skill.badgeId,
    skill['Badge/Stamp'],
    skill.stampType,
    skill['Stamp Type'],
    skill.category,
    skill.Category,
    skill.skillCode,
    skill['Skill Code'],
    skill['Skill Name'],
  ].map((value) => cleanText(value).toUpperCase()).filter(Boolean);
  const officialFiles = Object.values(BADGE_MAPPING);
  const fileName = mappedBadgeIdFile ?? identifiers.map((identifier) => {
    if (Object.prototype.hasOwnProperty.call(BADGE_MAPPING, identifier)) return BADGE_MAPPING[identifier];
    return officialFiles.find((file) => file.toUpperCase() === identifier);
  }).find((file): file is string => file !== undefined);
  console.log("Resolved badge image file:", fileName ?? null);
  if (!fileName) {
    console.error('BADGE MAPPING NOT FOUND:', badgeInputs);
    return null;
  }

  const filePath = path.join(process.cwd(), 'assets', fileName);
  if (!existsSync(filePath)) {
    console.error('BADGE FILE MISSING:', filePath);
    throw new Error(`Mapped badge file does not exist: ${filePath}`);
  }

  const cached = cache.get(fileName);
  if (cached) return cached;
  const imageBytes = await fs.readFile(filePath);
  const image = await doc.embedPng(imageBytes);
  cache.set(fileName, image);
  return image;
}

function drawImageWithLogging(
  page: PDFPage,
  pageIndex: number,
  image: PDFImage,
  coordinates: { x: number; y: number; width: number; height: number },
) {
  console.log("Drawing image on page", pageIndex, "at", coordinates);
  page.drawImage(image, coordinates);
}

function drawBadge(
  page: PDFPage,
  pageIndex: number,
  image: PDFImage,
  center: { x: number; y: number },
  size: number,
) {
  const scale = Math.min(size / image.width, size / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  drawImageWithLogging(page, pageIndex, image, {
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
  });
}

function drawPassportIdBelowLabel(page: PDFPage, passportId: string, fonts: Fonts) {
  drawLine(page, passportId, {
    x: x(PASSPORT_ID_BELOW_LABEL.rightX), y: y(PASSPORT_ID_BELOW_LABEL.y),
    size: PASSPORT_ID_BELOW_LABEL.size, fonts, bold: true, align: 'right',
  });
}

function drawPassportIdAfterLabel(page: PDFPage, passportId: string, fonts: Fonts) {
  drawLine(page, passportId, {
    x: x(PASSPORT_ID_AFTER_LABEL.x), y: y(PASSPORT_ID_AFTER_LABEL.y),
    size: PASSPORT_ID_AFTER_LABEL.size, fonts, bold: true,
  });
}

function drawTableFooter(page: PDFPage, passportId: string, fonts: Fonts) {
  page.drawRectangle({ x: 69, y: 98, width: 84, height: 20, color: WHITE });
  drawLine(page, `PASSPORT ID: ${passportId}`, { x: 60, y: 80, size: 8, fonts });
}

function drawCover(
  page: PDFPage,
  student: PassportStudentData,
  passportId: string,
  issueDate: string,
  verificationId: string,
  fonts: Fonts,
) {
  const firstName = cleanText(student['First Name']).toUpperCase();
  const lastName = cleanText(student['Last Name']).toUpperCase();

  drawLine(page, firstName, {
    x: COVER.firstName.x, y: COVER.firstName.y, fonts, bold: true,
    size: fitSize(firstName, COVER.firstName.size, COVER.firstName.maxWidth, fonts, true),
  });
  drawLine(page, lastName, {
    x: COVER.lastName.x, y: COVER.lastName.y, fonts, bold: true,
    size: fitSize(lastName, COVER.lastName.size, COVER.lastName.maxWidth, fonts, true),
  });
  drawLine(page, issueDate, { x: COVER.date.x, y: COVER.date.y, size: COVER.date.size, fonts, bold: true });
  drawLine(page, passportId, {
    x: COVER.passportId.centerX, y: COVER.passportId.y, size: COVER.passportId.size, fonts, bold: true, align: 'center',
  });
  drawLine(page, `VERIFICATION ID: ${verificationId}`, {
    x: COVER.verificationId.rightX, y: COVER.verificationId.y, size: COVER.verificationId.size, fonts,
    align: 'right', color: WHITE,
  });
}

async function drawGrid(
  doc: PDFDocument,
  page: PDFPage,
  pageIndex: number,
  skills: DrawSkill[],
  passportId: string,
  fonts: Fonts,
  badges: Map<string, PDFImage>,
) {
  drawPassportIdBelowLabel(page, passportId, fonts);

  for (const [index, skill] of skills.entries()) {
    const left = GRID.columnLeft[index % 5];
    const top = GRID.rowTop[Math.floor(index / 5)];
    const centerX = x(left + GRID.cardWidth / 2);
    const badgeCenter = { x: centerX, y: y(top + GRID.badgeCenterY) };

    // Opaque backing hides the template's grey placeholder asterisk behind the badge.
    page.drawCircle({ x: badgeCenter.x, y: badgeCenter.y, size: GRID.badgeBackdropRadius, color: WHITE });
    const badge = await loadBadge(doc, badges, skill);
    if (badge) drawBadge(page, pageIndex, badge, badgeCenter, GRID.badgeSize);

    const nameLines = wrap(skill['Skill Name'] || skill['Skill Code'] || 'AI Skill', 8, fonts, true, GRID.textWidth * PX, 2);
    nameLines.forEach((line, lineIndex) => {
      drawLine(page, line, {
        x: centerX, y: y(top + GRID.nameBaselineY + lineIndex * GRID.nameLineHeight),
        size: 8, fonts, bold: true, align: 'center',
      });
    });
    drawLine(page, skill['Skill Code'] || '', {
      x: centerX, y: y(top + GRID.codeBaselineY), size: 7, fonts, bold: true, align: 'center', color: BTU_PINK,
    });
  }
}

async function drawTable(
  doc: PDFDocument,
  page: PDFPage,
  pageIndex: number,
  skills: DrawSkill[],
  passportId: string,
  fallbackDate: string,
  fonts: Fonts,
  badges: Map<string, PDFImage>,
) {
  const drawCell = (
    lines: string[], column: { centerX: number; width: number }, rowCenterY: number,
    size: number, lineHeight: number, bold: boolean, color = INK,
  ) => {
    const firstBaseline = rowCenterY + ((lines.length - 1) * lineHeight) / 2 - size * 0.35;
    lines.forEach((line, lineIndex) => {
      drawLine(page, line, { x: column.centerX, y: firstBaseline - lineIndex * lineHeight, size, fonts, bold, align: 'center', color });
    });
  };

  const fitCellLines = (
    text: string, maxChars: number, maxWidth: number, size: number, bold: boolean, maxLines: number,
  ) => {
    const lines = wrapText(text, maxChars)
      .flatMap((line) => wrap(line, size, fonts, bold, maxWidth, 10));
    if (lines.length <= maxLines) return lines;
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length > 1 && measure(`${last}…`, size, fonts, bold) > maxWidth) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last}…`;
    return kept;
  };

  drawTableFooter(page, passportId, fonts);

  for (const [index, skill] of skills.entries()) {
    const rowCenterY = TABLE.rowCentersY[index];
    if (rowCenterY === undefined) continue;

    const badge = await loadBadge(doc, badges, skill);
    if (badge) {
      const scale = Math.min(TABLE.stampWidth / badge.width, TABLE.stampHeight / badge.height);
      const width = badge.width * scale;
      const height = badge.height * scale;
      drawImageWithLogging(page, pageIndex, badge, {
        x: TABLE.stampCenterX - width / 2,
        y: rowCenterY - height / 2,
        width,
        height,
      });
    }

    const skillName = cleanText(skill['Skill Name'] || skill.skillCode || skill['Skill Code'] || 'AI Skill').toUpperCase();
    const descriptionText = cleanText(skill['Skill Description'] || 'Verified BTU AI Skill').toUpperCase();
    const earnedText = cleanText(
      skill.earnedThrough || skill['Earned Through'] || skill.learningFormat || skill['Learning Format'] || skill.source || 'BTU Practical Workshop',
    ).toUpperCase();

    drawCell(
      fitCellLines(skillName, 18, TABLE.skill.width, 7.5, true, 3),
      TABLE.skill, rowCenterY, 7.5, 9, true,
    );
    drawCell(
      fitCellLines(descriptionText, 44, TABLE.description.width, 7.2, false, 5),
      TABLE.description, rowCenterY, 7.2, 8.8, false, MUTED,
    );
    drawCell(
      fitCellLines(earnedText, 40, TABLE.earnedThrough.width, 7.2, false, 3),
      TABLE.earnedThrough, rowCenterY, 7.2, 8.8, false,
    );
    drawCell(
      [formatTableDate(skill['Date Earned'], fallbackDate)],
      TABLE.date, rowCenterY, 7.5, 9, false,
    );
  }
}

export async function generatePassportPDF(
  studentData: PassportStudentData,
  allSkills: DrawSkill[],
  verificationId: string,
): Promise<Buffer> {
  const template = await PDFDocument.load(await fs.readFile(path.join(process.cwd(), 'assets', 'Passport_Blank.pdf')));
  if (template.getPageCount() < 4) throw new Error('Passport_Blank.pdf must contain 4 pages.');

  const gridPages = chunk(allSkills, GRID_PER_PAGE);
  const tablePages = chunk(allSkills, TABLE_ROWS_PER_PAGE);

  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.registerFontkit(fontkit);

  const [geoRegular, geoBold, latRegular, latBold] = await Promise.all([
    fontBytes('NotoSansGeorgian-Regular.ttf'),
    fontBytes('NotoSansGeorgian-Bold.ttf'),
    fontBytes('NotoSans-Latin-Regular.ttf'),
    fontBytes('NotoSans-Latin-Bold.ttf'),
  ]);
  const fonts: Fonts = {
    geoRegular: await doc.embedFont(geoRegular, { subset: true }),
    geoBold: await doc.embedFont(geoBold, { subset: true }),
    latRegular: await doc.embedFont(latRegular, { subset: true }),
    latBold: await doc.embedFont(latBold, { subset: true }),
  };

  // The template's grid and table pages are repeated once per batch of skills.
  const copied = await doc.copyPages(template, [
    TEMPLATE_PAGES.cover,
    TEMPLATE_PAGES.about,
    ...gridPages.map(() => TEMPLATE_PAGES.grid),
    ...tablePages.map(() => TEMPLATE_PAGES.table),
  ]);
  copied.forEach((page) => doc.addPage(page));

  const issuedAt = studentData['Issued At'] || studentData['First Issued At'] || '1970-01-01T00:00:00.000Z';
  const parsedIssuedAt = new Date(issuedAt);
  const metadataDate = Number.isNaN(parsedIssuedAt.getTime()) ? new Date(0) : parsedIssuedAt;
  const issueDate = issuedAt.split('T')[0];
  const rawId = studentData['Passport ID'] || studentData['Student ID'] || '001';
  const passportId = rawId.startsWith('BTU-AI-') ? rawId : `BTU-AI-${rawId}`;

  const baseUrl = process.env.PUBLIC_BASE_URL?.replace(/\/$/, '');
  const qrImage = baseUrl
    ? await doc.embedPng(await QRCode.toBuffer(`${baseUrl}/verify?code=${encodeURIComponent(verificationId)}`, { margin: 1, width: 240 }))
    : null;
  const drawQr = (page: PDFPage, pageIndex: number, at: { x: number; y: number }) => {
    if (qrImage) drawImageWithLogging(page, pageIndex, qrImage, { x: x(at.x), y: y(at.y), width: QR.sizePt, height: QR.sizePt });
  };

  const pages = doc.getPages();
  const badges = new Map<string, PDFImage>();

  drawCover(pages[0], studentData, passportId, issueDate, verificationId, fonts);
  drawPassportIdAfterLabel(pages[1], passportId, fonts);
  drawQr(pages[1], 2, QR.about);

  for (const [index, skills] of gridPages.entries()) {
    await drawGrid(doc, pages[2 + index], 3 + index, skills, passportId, fonts, badges);
  }
  for (const [index, skills] of tablePages.entries()) {
    const page = pages[2 + gridPages.length + index];
    const pageIndex = 3 + gridPages.length + index;
    await drawTable(doc, page, pageIndex, skills, passportId, issueDate, fonts, badges);
    if (index === tablePages.length - 1) drawQr(page, pageIndex, QR.table);
  }

  for (const page of pages.slice(1)) {
    drawLine(page, `VERIFICATION ID: ${verificationId}`, {
      x: x(VERIFICATION_FOOTER.rightX), y: y(VERIFICATION_FOOTER.y),
      size: VERIFICATION_FOOTER.size, fonts, align: 'right', color: WHITE,
    });
  }

  doc.setTitle(`AI PASSPORT - ${passportId}`);
  doc.setAuthor('BTU');
  doc.setSubject(verificationId);
  doc.setProducer('BTU AI Passport');
  doc.setCreator('BTU AI Passport');
  doc.setCreationDate(metadataDate);
  doc.setModificationDate(metadataDate);

  return Buffer.from(await doc.save({ useObjectStreams: false }));
}
