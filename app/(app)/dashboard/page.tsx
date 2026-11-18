import type { Metadata } from 'next';
import Link from 'next/link';
import { AppHeader } from '@/components/AppHeader';
import { LogoutButton } from '@/components/LogoutButton';
import { requireRole } from '@/lib/auth/session';
import { isDemoEnabled } from '@/lib/demo/config';
import { getLedgerEnv } from '@/lib/env';
import { formatDate } from '@/lib/format';
import { IssueCredentialForm } from './IssueCredentialForm';

export const dynamic = 'force-dynamic';
// Issuing generates a PDF and registers it on the ledger within one request.
export const maxDuration = 60;

export const metadata: Metadata = { title: 'Dashboard | AI Skills Digital Passport' };

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <dt className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{label}</dt>
      <dd className="mt-1 text-3xl font-black text-gray-900">{value}</dd>
    </div>
  );
}

export default async function DashboardPage() {
  const { payload, user } = await requireRole('admin');

  const [students, skills, passports, issuedCount, recent] = await Promise.all([
    payload.find({ collection: 'students', sort: 'lastName', limit: 200, depth: 0, overrideAccess: false, user }),
    payload.find({ collection: 'skills', sort: 'name', limit: 200, depth: 0, overrideAccess: false, user }),
    payload.count({ collection: 'passports', overrideAccess: false, user }),
    payload.count({ collection: 'passport-versions', where: { issuanceStatus: { equals: 'ISSUED' } }, overrideAccess: false, user }),
    payload.find({
      collection: 'passport-versions',
      where: { issuanceStatus: { equals: 'ISSUED' } },
      sort: '-issuedAt',
      limit: 8,
      depth: 1,
      overrideAccess: false,
      user,
    }),
  ]);

  const ledgerMode = getLedgerEnv().mode;
  const demoStudent = students.docs.find((student) => student.studentId.startsWith('DEMO-'));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F5F7] text-gray-900">
      <AppHeader subtitle="Administrator dashboard">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="rounded-lg border border-white/40 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20">
            Open CMS
          </Link>
          <LogoutButton />
        </div>
      </AppHeader>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-6 py-10">
        {isDemoEnabled() ? (
          <p className="rounded-xl border border-pink-200 bg-pink-50 px-4 py-3 text-sm text-pink-900">
            You are using the live demo. Credentials you issue are removed automatically after a while, and the CMS is read-only here.
          </p>
        ) : null}

        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Students" value={students.totalDocs} />
          <Stat label="Passports" value={passports.totalDocs} />
          <Stat label="Versions issued" value={issuedCount.totalDocs} />
          <Stat label="Ledger" value={ledgerMode === 'demo' ? 'Demo' : 'Polygon Amoy'} />
        </dl>

        <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-xl shadow-gray-100 sm:p-8">
          <h1 className="text-xl font-black tracking-tight">Issue a credential</h1>
          <p className="mb-6 mt-1 text-sm text-gray-500">
            Generates the certificate PDF, registers its hash on the ledger and opens the public verification page.
          </p>

          {students.docs.length === 0 || skills.docs.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Add at least one student and one skill before issuing. {isDemoEnabled() ? 'Run npm run seed to load the demo dataset.' : ''}
            </p>
          ) : (
            <IssueCredentialForm
              students={students.docs.map((student) => ({
                id: student.id,
                label: `${student.firstName} ${student.lastName} (${student.studentId})`,
              }))}
              skills={skills.docs.map((skill) => ({ id: skill.id, label: `${skill.name} (${skill.skillCode})` }))}
              defaultDate={today}
              defaultStudentId={demoStudent?.id}
            />
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-500">Recently issued</h2>
          {recent.docs.length === 0 ? (
            <p className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-500">Nothing has been issued yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 bg-white">
              {recent.docs.map((version) => {
                const holder = typeof version.passport === 'object' && version.passport !== null
                  ? `${version.passport.firstName} ${version.passport.lastName}`
                  : 'Unknown holder';
                return (
                  <li key={version.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-bold">{holder} <span className="ml-1 text-sm font-semibold text-[#FE017E]">V{version.version}</span></p>
                      <p className="font-mono text-xs text-gray-500">{version.verificationId}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-500">{formatDate(version.issuedAt)}</span>
                      <Link href={`/verify/${encodeURIComponent(version.verificationId)}`} className="font-bold text-[#FE017E] hover:underline">
                        Verify
                      </Link>
                      <a href={`/api/passports/${encodeURIComponent(version.verificationId)}`} className="font-bold text-gray-700 hover:underline">
                        PDF
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
