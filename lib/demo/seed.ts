import type { Payload } from 'payload';
import type { Skill, Student } from '../../payload-types';
import { issueCredential } from '../issuance/issueCredential';
import { IssuanceError } from '../issuance/types';
import type { LedgerProvider } from '../ledger';
import { ensureDemoAccounts, DEMO_STUDENT_PROFILE } from './accounts';
import type { DemoEnabled } from './config';
import { SEED_CREDENTIALS, SEED_SKILLS, SEED_STUDENTS, type SeedSkill, type SeedStudent } from './seedData';

export interface SeedOptions {
  payload: Payload;
  ledger: LedgerProvider;
  verifyBaseUrl: string;
  /** When set, the demo admin and student accounts are provisioned too. */
  demo?: DemoEnabled;
  log?: (message: string) => void;
}

export interface SeedSummary {
  skills: { created: number; existing: number };
  students: { created: number; existing: number };
  credentials: { issued: number; existing: number };
  /** Verification IDs of every seeded credential, newest version last per student. */
  verificationIds: Array<{ holder: string; version: number; verificationId: string }>;
}

async function ensureSkill(payload: Payload, seed: SeedSkill): Promise<{ skill: Skill; created: boolean }> {
  const found = await payload.find({
    collection: 'skills',
    where: { skillCode: { equals: seed.skillCode } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  if (found.docs[0]) return { skill: found.docs[0], created: false };

  return { skill: await payload.create({ collection: 'skills', overrideAccess: true, data: seed }), created: true };
}

async function ensureStudent(payload: Payload, seed: SeedStudent): Promise<{ student: Student; created: boolean }> {
  const found = await payload.find({
    collection: 'students',
    where: { studentId: { equals: seed.studentId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  if (found.docs[0]) return { student: found.docs[0], created: false };

  return { student: await payload.create({ collection: 'students', overrideAccess: true, data: seed }), created: true };
}

/** Loads a synthetic, reproducible dataset. Safe to run repeatedly. */
export async function seedDemoData(options: SeedOptions): Promise<SeedSummary> {
  const { payload, ledger, verifyBaseUrl } = options;
  const log = options.log ?? (() => undefined);

  const summary: SeedSummary = {
    skills: { created: 0, existing: 0 },
    students: { created: 0, existing: 0 },
    credentials: { issued: 0, existing: 0 },
    verificationIds: [],
  };

  const studentsByBusinessId = new Map<string, Student>();
  if (options.demo) {
    const { student } = await ensureDemoAccounts(payload, options.demo);
    studentsByBusinessId.set(student.studentId, student);
    log(`Demo accounts ready (${options.demo.admin.email}, ${options.demo.student.email}).`);
  }

  const skillsByCode = new Map<string, Skill>();
  for (const seed of SEED_SKILLS) {
    const { skill, created } = await ensureSkill(payload, seed);
    skillsByCode.set(skill.skillCode, skill);
    summary.skills[created ? 'created' : 'existing'] += 1;
  }

  for (const seed of SEED_STUDENTS) {
    const { student, created } = await ensureStudent(payload, seed);
    studentsByBusinessId.set(student.studentId, student);
    summary.students[created ? 'created' : 'existing'] += 1;
  }

  // The demo student is not part of the summary counts; it exists whether or not demo accounts are provisioned.
  if (!studentsByBusinessId.has(DEMO_STUDENT_PROFILE.studentId)) {
    const { student } = await ensureStudent(payload, {
      ...DEMO_STUDENT_PROFILE,
      email: 'amelia.hart@example.com',
    });
    studentsByBusinessId.set(student.studentId, student);
  }

  // Credentials are issued in order so each student's versions build on one another.
  const ordered = [...SEED_CREDENTIALS].sort((a, b) => a.earnedAt.localeCompare(b.earnedAt));
  for (const credential of ordered) {
    const student = studentsByBusinessId.get(credential.studentId);
    const skill = skillsByCode.get(credential.skillCode);
    if (!student || !skill) throw new Error(`Seed credential ${credential.recordId} references unknown data.`);

    try {
      const issued = await issueCredential({
        payload,
        ledger,
        verifyBaseUrl,
        input: {
          studentId: student.id,
          skillId: skill.id,
          earnedAt: credential.earnedAt,
          recordId: credential.recordId,
          issuedAt: `${credential.earnedAt}T10:00:00.000Z`,
        },
      });
      summary.credentials.issued += 1;
      summary.verificationIds.push({
        holder: issued.holderName,
        version: issued.version,
        verificationId: issued.verificationId,
      });
      log(`Issued ${credential.recordId}: ${issued.holderName} V${issued.version} (${issued.verificationId}).`);
    } catch (error) {
      if (!(error instanceof IssuanceError) || error.code !== 'CONFLICT') throw error;
      summary.credentials.existing += 1;
    }
  }

  return summary;
}
