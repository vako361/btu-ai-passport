import type { Metadata } from 'next';
import Link from 'next/link';
import { AppHeader } from '@/components/AppHeader';
import { LogoutButton } from '@/components/LogoutButton';
import { linkedStudentId } from '@/lib/access';
import { requireRole } from '@/lib/auth/session';
import { formatDate } from '@/lib/format';
import { passportDownloadPath } from '@/lib/issuance/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'My passport | AI Skills Digital Passport' };

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border-l-4 border-amber-500 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      <p className="mt-1 text-sm text-gray-600">{children}</p>
    </section>
  );
}

export default async function StudentPortalPage() {
  const { payload, user } = await requireRole('student');

  // Every read below runs with the student's own access rules, not as an administrator.
  const studentId = linkedStudentId(user);
  const students = studentId === null
    ? null
    : await payload.find({ collection: 'students', limit: 1, depth: 0, overrideAccess: false, user });
  const student = students?.docs[0] ?? null;

  const passports = student
    ? await payload.find({ collection: 'passports', limit: 1, depth: 1, overrideAccess: false, user })
    : null;
  const passport = passports?.docs[0] ?? null;
  const latestVersion = passport && typeof passport.latestVersion === 'object' ? passport.latestVersion : null;

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F5F7] text-gray-900">
      <AppHeader subtitle="Student portal">
        <LogoutButton />
      </AppHeader>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        {!student ? (
          <Notice title="Your account is not linked to a student record">
            Ask an administrator to link {user.email} to your student profile.
          </Notice>
        ) : !passport || !latestVersion ? (
          <Notice title="No passport has been issued yet">
            Hello {student.firstName}. Your passport appears here as soon as your first verified skill is issued.
          </Notice>
        ) : (
          <section className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white p-6 shadow-xl shadow-gray-100 sm:p-10">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-[#FE017E]" />

            <div className="flex flex-col justify-between gap-4 border-b border-gray-100 pb-6 sm:flex-row sm:items-center">
              <div>
                <span className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Active passport
                </span>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                  {student.firstName} {student.lastName}
                </h1>
                <p className="mt-1 font-mono text-xs text-gray-500 sm:text-sm">{student.email}</p>
              </div>
              <span className="self-start rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-bold text-gray-700 sm:self-auto">
                Version <span className="ml-1 text-sm font-extrabold text-[#FE017E]">V{latestVersion.version}</span>
              </span>
            </div>

            <dl className="grid grid-cols-1 gap-4 py-6 sm:grid-cols-3">
              <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-5">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Passport ID</dt>
                <dd className="mt-1 break-all font-mono text-sm font-bold">{passport.passportId}</dd>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-5">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Last issued</dt>
                <dd className="mt-1 text-sm font-bold">{formatDate(latestVersion.issuedAt)}</dd>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-5">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Verification ID</dt>
                <dd className="mt-1 break-all font-mono text-xs font-medium text-gray-600">{latestVersion.verificationId}</dd>
              </div>
            </dl>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href={`${passportDownloadPath(latestVersion.verificationId)}?download=1`}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-[#FE017E] px-7 text-sm font-bold text-white shadow-lg shadow-pink-500/20 transition-all hover:bg-[#d6006a]"
              >
                Download PDF
              </a>
              <Link
                href={`/verify/${encodeURIComponent(latestVersion.verificationId)}`}
                className="inline-flex h-12 items-center justify-center rounded-xl border-2 border-gray-200 bg-white px-7 text-sm font-bold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50"
              >
                Public verification page
              </Link>
            </div>

            <h2 className="mb-3 mt-10 text-sm font-bold uppercase tracking-wider text-gray-500">Verified skills</h2>
            <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
              {(latestVersion.skillsSnapshot ?? []).map((skill) => (
                <li key={skill.recordId} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold">{skill.skillName}</p>
                    {skill.description ? <p className="text-sm text-gray-500">{skill.description}</p> : null}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="rounded-md bg-gray-100 px-2 py-1 font-mono">{skill.skillCode}</span>
                    <span>{formatDate(skill.earnedAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
