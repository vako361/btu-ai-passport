import type { Payload } from 'payload';
import type { Student } from '../../payload-types';
import type { DemoCredentials } from '../env';
import type { DemoEnabled } from './config';

export const DEMO_STUDENT_PROFILE = {
  studentId: 'DEMO-2026-0001',
  firstName: 'Amelia',
  lastName: 'Hart',
} as const;

async function ensureDemoStudentRecord(payload: Payload, email: string): Promise<Student> {
  const byEmail = await payload.find({
    collection: 'students',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  if (byEmail.docs[0]) return byEmail.docs[0];

  const byStudentId = await payload.find({
    collection: 'students',
    where: { studentId: { equals: DEMO_STUDENT_PROFILE.studentId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  if (byStudentId.docs[0]) return byStudentId.docs[0];

  return payload.create({
    collection: 'students',
    overrideAccess: true,
    data: { ...DEMO_STUDENT_PROFILE, email },
  });
}

async function upsertDemoUser(
  payload: Payload,
  credentials: DemoCredentials,
  profile: { role: 'admin' | 'student'; student: number | null },
): Promise<void> {
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: credentials.email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });

  const data = { email: credentials.email, password: credentials.password, isDemo: true, ...profile };
  const current = existing.docs[0];

  if (!current) {
    await payload.create({ collection: 'users', overrideAccess: true, data });
    return;
  }

  // Never take over a real account that happens to share a configured demo address.
  if (!current.isDemo) {
    throw new Error(`Refusing to reuse ${credentials.email} as a demo account because it is not marked as one.`);
  }

  await payload.update({ collection: 'users', id: current.id, overrideAccess: true, data });
  // Visitors can lock a demo account by failing logins; the generated type also lists a password it does not use.
  await payload.unlock({
    collection: 'users',
    data: { email: credentials.email, password: credentials.password },
    overrideAccess: true,
  });
}

/** Creates or repairs the demo users and the student record behind the demo student. Idempotent. */
export async function ensureDemoAccounts(payload: Payload, demo: DemoEnabled): Promise<{ student: Student }> {
  const student = await ensureDemoStudentRecord(payload, demo.student.email);

  await upsertDemoUser(payload, demo.admin, { role: 'admin', student: null });
  await upsertDemoUser(payload, demo.student, { role: 'student', student: student.id });

  return { student };
}
