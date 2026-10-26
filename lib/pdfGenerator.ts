import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { PassportSkillData, PassportStudentData } from '@/lib/passportTypes';

const BRAND = rgb(0.996, 0.004, 0.494);
const INK = rgb(0.12, 0.13, 0.15);
const MUTED = rgb(0.38, 0.4, 0.43);
const PALE = rgb(0.985, 0.96, 0.972);
const BORDER = rgb(0.9, 0.87, 0.89);
const SKILLS_PER_PAGE = 6;

type DrawSkill = PassportSkillData & { 'Skill Code'?: string };
type FontWeight = 'regular' | 'bold';
type FontSet = {
  georgianRegular: PDFFont;
  georgianBold: PDFFont;
  latinRegular: PDFFont;
  latinBold: PDFFont;
};

function isGeorgian(character: string) {
  const codePoint = character.codePointAt(0) ?? 0;
  return (codePoint >= 0x10a0 && codePoint <= 0x10ff) ||
    (codePoint >= 0x1c90 && codePoint <= 0x1cbf) ||
    (codePoint >= 0x2d00 && codePoint <= 0x2d2f);
}

function fontFor(character: string, fonts: FontSet, weight: FontWeight) {
  if (isGeorgian(character)) return weight === 'bold' ? fonts.georgianBold : fonts.georgianRegular;
  return weight === 'bold' ? fonts.latinBold : fonts.latinRegular;
}

function textWidth(text: string, size: number, fonts: FontSet, weight: FontWeight) {
  return Array.from(text).reduce((width, character) => width + fontFor(character, fonts, weight).widthOfTextAtSize(character, size), 0);
}

function drawMixedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  fonts: FontSet,
  weight: FontWeight,
  color: ReturnType<typeof rgb>,
) {
  const segments: { text: string; font: PDFFont }[] = [];
  for (const character of Array.from(text)) {
    const font = fontFor(character, fonts, weight);
    const previous = segments[segments.length - 1];
    if (previous?.font === font) previous.text += character;
    else segments.push({ text: character, font });
  }

  let cursorX = x;
  for (const segment of segments) {
    page.drawText(segment.text, { x: cursorX, y, size, font: segment.font, color });
    cursorX += segment.font.widthOfTextAtSize(segment.text, size);
  }
}

function wrapText(text: string, fonts: FontSet, weight: FontWeight, size: number, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (textWidth(candidate, size, fonts, weight) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = word;
    }
    if (line) lines.push(line);
  }
  return lines;
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fonts: FontSet,
  weight: FontWeight,
  size: number,
  color = INK,
  maxLines = 3,
) {
  const lines = wrapText(text, fonts, weight, size, maxWidth);
  const visibleLines = lines.slice(0, maxLines);
  if (lines.length > maxLines && visibleLines.length > 0) {
    let lastLine = visibleLines[maxLines - 1];
    while (lastLine && textWidth(`${lastLine}...`, size, fonts, weight) > maxWidth) {
      lastLine = lastLine.slice(0, -1).trimEnd();
    }
    visibleLines[maxLines - 1] = `${lastLine}...`;
  }

  visibleLines.forEach((line, index) => {
    drawMixedText(page, line, x, y - index * (size + 4), size, fonts, weight, color);
  });
  return visibleLines.length;
}

function drawFooter(page: PDFPage, verificationId: string, pageNumber: number, pageCount: number, fonts: FontSet) {
  const { width } = page.getSize();
  page.drawLine({ start: { x: 48, y: 54 }, end: { x: width - 48, y: 54 }, thickness: 0.7, color: BORDER });
  drawMixedText(page, `Verification ID: ${verificationId}`, 48, 35, 8, fonts, 'regular', MUTED);
  drawMixedText(page, `${pageNumber} / ${pageCount}`, width - 84, 35, 8, fonts, 'regular', MUTED);
}

function drawBrandHeader(page: PDFPage, title: string, subtitle: string, fonts: FontSet) {
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: height - 92, width, height: 92, color: BRAND });
  drawMixedText(page, 'BTU  |  AI SKILLS DIGITAL PASSPORT', 48, height - 39, 10, fonts, 'bold', rgb(1, 1, 1));
  drawMixedText(page, title, 48, height - 66, 17, fonts, 'bold', rgb(1, 1, 1));
  drawMixedText(
    page,
    subtitle,
    width - Math.min(280, textWidth(subtitle, 8, fonts, 'regular')) - 48,
    height - 64,
    8,
    fonts,
    'regular',
    rgb(1, 1, 1),
  );
}

function drawField(page: PDFPage, label: string, value: string, x: number, y: number, width: number, fonts: FontSet) {
  drawMixedText(page, label, x, y, 8, fonts, 'regular', MUTED);
  drawWrappedText(page, value || '-', x, y - 21, width, fonts, 'bold', 11, INK, 2);
}

async function embedBadge(pdfDoc: PDFDocument, badgeId: string | undefined): Promise<PDFImage | undefined> {
  if (!badgeId || !/^[\w-]+(?:\.png)?$/i.test(badgeId)) return undefined;
  const fileName = badgeId.toLowerCase().endsWith('.png') ? badgeId : `${badgeId}.png`;
  const badgePath = path.join(process.cwd(), 'public', 'images', fileName);
  try {
    return await pdfDoc.embedPng(await fs.readFile(badgePath));
  } catch {
    return undefined;
  }
}

function drawSkillCard(
  page: PDFPage,
  skill: DrawSkill,
  index: number,
  x: number,
  y: number,
  width: number,
  height: number,
  fonts: FontSet,
  badge?: PDFImage,
) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: rgb(1, 1, 1),
    borderColor: BORDER,
    borderWidth: 1,
  });
  page.drawRectangle({ x, y: y + height - 5, width, height: 5, color: BRAND });

  const badgeX = x + 15;
  const badgeY = y + height - 61;
  if (badge) {
    page.drawImage(badge, { x: badgeX, y: badgeY, width: 40, height: 40 });
  } else {
    page.drawCircle({ x: badgeX + 20, y: badgeY + 20, size: 20, color: PALE, borderColor: BRAND, borderWidth: 1.5 });
    const badgeLabel = (skill['Badge/Stamp'] || `S${index + 1}`).slice(0, 8);
    const badgeSize = 7;
    drawMixedText(
      page,
      badgeLabel,
      badgeX + Math.max(3, (40 - textWidth(badgeLabel, badgeSize, fonts, 'bold')) / 2),
      badgeY + 17,
      badgeSize,
      fonts,
      'bold',
      BRAND,
    );
  }

  const textX = x + 67;
  const cardTextWidth = width - 82;
  drawWrappedText(page, skill['Skill Name'] || 'AI Skill', textX, y + height - 28, cardTextWidth, fonts, 'bold', 11, INK, 2);
  drawMixedText(page, `Badge: ${skill['Badge/Stamp'] || 'BTU'}`, textX, y + height - 69, 8, fonts, 'regular', BRAND);

  const code = skill['Skill Code'] || skill['Record ID'] || '-';
  drawMixedText(page, `Code: ${code}`, x + 15, y + 73, 8, fonts, 'regular', MUTED);
  drawMixedText(page, `Date earned: ${skill['Date Earned'] || '-'}`, x + 15, y + 56, 8, fonts, 'regular', MUTED);
  drawWrappedText(page, skill['Skill Description'] || 'BTU-confirmed AI skill.', x + 15, y + 36, width - 30, fonts, 'regular', 8, INK, 2);
}

export async function generatePassportPDF(
  studentData: PassportStudentData,
  allSkills: DrawSkill[],
  verificationId: string,
): Promise<Buffer> {
  const templatePath = path.join(process.cwd(), 'assets', 'passport-template.pdf');
  const pdfDoc = await PDFDocument.load(await fs.readFile(templatePath));
  pdfDoc.registerFontkit(fontkit);

  const fontsDirectory = path.join(process.cwd(), 'assets', 'fonts');
  const [georgianRegularBytes, georgianBoldBytes, latinRegularBytes, latinBoldBytes] = await Promise.all([
    fs.readFile(path.join(fontsDirectory, 'NotoSansGeorgian-Regular.ttf')),
    fs.readFile(path.join(fontsDirectory, 'NotoSansGeorgian-Bold.ttf')),
    fs.readFile(path.join(fontsDirectory, 'NotoSans-Latin-Regular.ttf')),
    fs.readFile(path.join(fontsDirectory, 'NotoSans-Latin-Bold.ttf')),
  ]);
  const [georgianRegular, georgianBold, latinRegular, latinBold] = await Promise.all([
    pdfDoc.embedFont(georgianRegularBytes, { subset: false }),
    pdfDoc.embedFont(georgianBoldBytes, { subset: false }),
    pdfDoc.embedFont(latinRegularBytes, { subset: false }),
    pdfDoc.embedFont(latinBoldBytes, { subset: false }),
  ]);
  const fonts: FontSet = { georgianRegular, georgianBold, latinRegular, latinBold };

  const cover = pdfDoc.getPages()[0];
  if (!cover) throw new Error('Passport template must contain at least one page.');
  const { width, height } = cover.getSize();
  while (pdfDoc.getPageCount() > 1) pdfDoc.removePage(pdfDoc.getPageCount() - 1);

  const version = studentData['Passport Version'] ?? 1;
  const issuedAt = studentData['Issued At'] || new Date().toISOString();
  const coverTitle = 'AI SKILLS DIGITAL PASSPORT';
  drawBrandHeader(cover, coverTitle, 'ციფრული პასპორტი', fonts);

  drawWrappedText(
    cover,
    `${studentData['First Name']} ${studentData['Last Name'] || ''}`.trim(),
    60,
    height - 190,
    width - 120,
    fonts,
    'bold',
    25,
    INK,
    2,
  );
  drawMixedText(cover, 'ბიზნესისა და ტექნოლოგიების უნივერსიტეტი', 60, height - 250, 11, fonts, 'regular', MUTED);

  const infoX = 60;
  const infoY = 205;
  const infoWidth = width - 120;
  const infoHeight = 205;
  cover.drawRectangle({ x: infoX, y: infoY, width: infoWidth, height: infoHeight, color: PALE });
  drawField(cover, 'სტუდენტის ID', studentData['Student ID'], infoX + 20, infoY + 170, 215, fonts);
  drawField(cover, 'Passport ID', studentData['Passport ID'] || '-', infoX + 265, infoY + 170, 215, fonts);
  drawField(cover, 'პირველი გაცემის თარიღი', studentData['First Issued At'] || '-', infoX + 20, infoY + 104, 215, fonts);
  drawField(cover, 'ვერსია', `V${version}`, infoX + 265, infoY + 104, 215, fonts);
  drawField(cover, 'Verification Code', verificationId, infoX + 20, infoY + 38, infoWidth - 40, fonts);
  drawFooter(cover, verificationId, 1, 1 + Math.max(1, Math.ceil(allSkills.length / SKILLS_PER_PAGE)), fonts);

  const skillPageCount = Math.max(1, Math.ceil(allSkills.length / SKILLS_PER_PAGE));
  const skillPages: PDFPage[] = [];
  for (let pageIndex = 0; pageIndex < skillPageCount; pageIndex += 1) {
    skillPages.push(pdfDoc.addPage([width, height]));
  }

  const badgeCache = new Map<string, PDFImage | undefined>();
  const margin = 48;
  const gapX = 16;
  const gapY = 14;
  const cardWidth = (width - margin * 2 - gapX) / 2;
  const cardHeight = 174;
  const firstRowY = height - 92 - 38 - cardHeight;

  for (const [pageIndex, page] of skillPages.entries()) {
    const subtitle = `${studentData['Passport ID'] || '-'}  |  V${version}`;
    drawBrandHeader(page, 'დადასტურებული AI უნარები', subtitle, fonts);

    const pageSkills = allSkills.slice(pageIndex * SKILLS_PER_PAGE, (pageIndex + 1) * SKILLS_PER_PAGE);
    if (pageSkills.length === 0) {
      drawMixedText(page, 'უნარების ჩანაწერი ჯერ არ არის დამატებული.', margin, height - 170, 12, fonts, 'regular', MUTED);
    }

    for (const [cardIndex, skill] of pageSkills.entries()) {
      const column = cardIndex % 2;
      const row = Math.floor(cardIndex / 2);
      const x = margin + column * (cardWidth + gapX);
      const y = firstRowY - row * (cardHeight + gapY);
      const badgeId = skill['Badge/Stamp'];
      if (badgeId && !badgeCache.has(badgeId)) {
        badgeCache.set(badgeId, await embedBadge(pdfDoc, badgeId));
      }
      drawSkillCard(
        page,
        skill,
        pageIndex * SKILLS_PER_PAGE + cardIndex,
        x,
        y,
        cardWidth,
        cardHeight,
        fonts,
        badgeId ? badgeCache.get(badgeId) : undefined,
      );
    }

    drawFooter(page, verificationId, pageIndex + 2, skillPageCount + 1, fonts);
  }

  const issuedDate = new Date(issuedAt);
  pdfDoc.setTitle(`${coverTitle} - ${studentData['Passport ID'] || studentData['Student ID']}`);
  pdfDoc.setAuthor('Business and Technology University');
  pdfDoc.setSubject(verificationId);
  pdfDoc.setKeywords(['BTU', 'AI Skills Passport', verificationId, studentData['Passport ID'] || '']);
  pdfDoc.setCreationDate(issuedDate);
  pdfDoc.setModificationDate(issuedDate);

  const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
  return Buffer.from(pdfBytes);
}