import type { PassportVersion } from '../../payload-types';
import { generatePassportPDF } from '../pdfGenerator';
import type { PassportHolder, SnapshotSkill } from './types';
import { dateOnly } from './utils';

export function skillsFromSnapshot(snapshot: PassportVersion['skillsSnapshot']): SnapshotSkill[] {
  return (snapshot ?? []).map((skill) => ({
    recordId: skill.recordId,
    skillCode: skill.skillCode,
    skillName: skill.skillName,
    badgeId: skill.badgeId,
    earnedAt: dateOnly(skill.earnedAt),
    description: skill.description ?? '',
  }));
}

export interface RenderPassportPdfInput {
  holder: PassportHolder;
  version: number;
  issuedAt: string;
  verificationId: string;
  skills: SnapshotSkill[];
  verifyBaseUrl?: string;
}

// The generator still takes spreadsheet-style keys; this is the only place that knows about them.
export function renderPassportPdf(input: RenderPassportPdfInput): Promise<Buffer> {
  const { holder, skills } = input;
  return generatePassportPDF(
    {
      'Student ID': holder.studentId,
      'First Name': holder.firstName,
      'Last Name': holder.lastName,
      'Passport ID': holder.passportId,
      'First Issued At': dateOnly(holder.firstIssuedAt),
      'Passport Version': input.version,
      'Issued At': input.issuedAt,
    },
    skills.map((skill) => ({
      recordId: skill.recordId,
      skillCode: skill.skillCode,
      skillName: skill.skillName,
      badgeId: skill.badgeId,
      earnedAt: skill.earnedAt,
      description: skill.description,
      'Skill Name': skill.skillName,
      'Date Earned': dateOnly(skill.earnedAt),
      'Skill Description': skill.description,
      'Badge/Stamp': skill.badgeId,
      'Skill Code': skill.skillCode,
      'Record ID': skill.recordId,
    })),
    input.verificationId,
    { verifyBaseUrl: input.verifyBaseUrl },
  );
}
