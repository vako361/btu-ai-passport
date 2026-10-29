export interface PassportStudentData {
  "Student ID": string;
  "First Name": string;
  "Last Name"?: string;
  "Passport ID (Existing)"?: string;
  "Passport ID"?: string;
  "First Issued At"?: string;
  "Passport Version"?: number;
  "Issued At"?: string;
}

export interface PassportSkillData {
  "Skill Name": string;
  "Date Earned"?: string;
  "Skill Description"?: string;
  "Badge/Stamp"?: string;
  "Skill Code"?: string;
  "Record ID"?: string;
}

export const VERIFIED_SKILL_STATUSES = ['CONFIRMED', 'PENDING', 'REJECTED'] as const;

export type VerifiedSkillStatus = (typeof VERIFIED_SKILL_STATUSES)[number];

export type VerifiedSkillProcessingStatus = 'QUEUED' | 'SKIPPED' | 'PROCESSING' | 'PROCESSED' | 'FAILED';

export interface SheetsVerifiedSkillEvent {
  recordId: string;
  studentId: string;
  skillCode: string;
  earnedAt: string;
  status: VerifiedSkillStatus;
  badgeId?: string | null;
  // ⚠️ დაემატა ეს ველები, რომ გზაში არ დაიკარგოს:
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  skillName?: string | null;
}

export type PassportInput = PassportStudentData & PassportSkillData & {
  "Record ID": string;
  status: VerifiedSkillStatus;
};

export interface PassportRegistration {
  passportId: string;
  verificationId: string;
  docHashHex: string;
  version: number;
  prevVerificationId: string;
}

export function isPassportInput(value: unknown): value is PassportInput {
  if (typeof value !== "object" || value === null) return false;

  const record = value as Record<string, unknown>;

  return (
    typeof record["Record ID"] === "string" &&
    record["Record ID"].trim().length > 0 &&
    typeof record["Student ID"] === "string" &&
    typeof record["First Name"] === "string" &&
    typeof record["Skill Name"] === "string" &&
    isVerifiedSkillStatus(record.status)
  );
}

export function isVerifiedSkillStatus(value: unknown): value is VerifiedSkillStatus {
  return VERIFIED_SKILL_STATUSES.some((status) => status === value);
}

export function isPassportEligibleStatus(value: unknown): value is 'CONFIRMED' {
  return value === 'CONFIRMED';
}

export function parseSheetsVerifiedSkillEvent(value: unknown): SheetsVerifiedSkillEvent | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const recordId = stringValue(record.recordId);
  const studentId = stringValue(record.studentId);
  const skillCode = stringValue(record.skillCode);
  const earnedAt = stringValue(record.earnedAt);
  const status = stringValue(record.status)?.toUpperCase();

  // ⚠️ ამოვიღოთ სახელი, გვარი და იმეილიც შემოსული JSON-იდან:
  const firstName = stringValue(record.firstName);
  const lastName = stringValue(record.lastName);
  const email = stringValue(record.email);
  const skillName = stringValue(record.skillName);
  const badgeId = stringValue(record.badgeId);

  if (!recordId || !studentId || !skillCode || !isDateOnly(earnedAt) || !isVerifiedSkillStatus(status)) {
    return null;
  }

  return { recordId, studentId, skillCode, earnedAt, status, badgeId, firstName, lastName, email, skillName };
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isDateOnly(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}