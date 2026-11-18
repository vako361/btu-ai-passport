import type { Access, FieldAccess, PayloadRequest, Where } from 'payload';
import type { User } from '../payload-types';

export type Role = User['role'];

export type SessionUser = User & { collection: 'users' };

export function sessionUser(req: Pick<PayloadRequest, 'user'>): SessionUser | null {
  const user = req.user;
  return user && user.collection === 'users' ? user : null;
}

export function linkedStudentId(user: Pick<User, 'student'>): number | null {
  const { student } = user;
  if (typeof student === 'number') return student;
  if (student && typeof student === 'object') return student.id;
  return null;
}

export const isAdmin: Access = ({ req }) => sessionUser(req)?.role === 'admin';

/** Gate for the Payload admin panel, whose access signature must return a plain boolean. */
export const canOpenAdminPanel = ({ req }: { req: PayloadRequest }): boolean => sessionUser(req)?.role === 'admin';

function isWritableAdmin(req: Pick<PayloadRequest, 'user'>): boolean {
  const user = sessionUser(req);
  return user?.role === 'admin' && !user.isDemo;
}

/** Demo administrators can browse everything but never mutate data through the CMS. */
export const canWrite: Access = ({ req }) => isWritableAdmin(req);

export const canWriteField: FieldAccess = ({ req }) => isWritableAdmin(req);

export const isAuthenticated: Access = ({ req }) => sessionUser(req) !== null;

export const denyAll: Access = () => false;

type StudentScope = (studentId: number, req: PayloadRequest) => Where | false | Promise<Where | false>;

// Admins read everything; students read only what the scope allows for their linked student record.
function readScopedToStudent(scope: StudentScope): Access {
  return async ({ req }) => {
    const user = sessionUser(req);
    if (!user) return false;
    if (user.role === 'admin') return true;

    const studentId = linkedStudentId(user);
    return studentId === null ? false : scope(studentId, req);
  };
}

export const readSelf: Access = ({ req }) => {
  const user = sessionUser(req);
  if (!user) return false;
  return user.role === 'admin' ? true : { id: { equals: user.id } };
};

export const readOwnStudent = readScopedToStudent((studentId) => ({ id: { equals: studentId } }));

export const readOwnPassport = readScopedToStudent((studentId) => ({ studentRecord: { equals: studentId } }));

export const readOwnVerifiedSkill = readScopedToStudent((studentId) => ({ student: { equals: studentId } }));

export const readOwnIssuedVersion = readScopedToStudent(async (studentId, req) => {
  const passports = await req.payload.find({
    collection: 'passports',
    where: { studentRecord: { equals: studentId } },
    limit: 1,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  });
  const passport = passports.docs[0];
  if (!passport) return false;

  const where: Where = { and: [{ passport: { equals: passport.id } }, { issuanceStatus: { equals: 'ISSUED' } }] };
  return where;
});
