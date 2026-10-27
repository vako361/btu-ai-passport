import Link from 'next/link';
import { cookies } from 'next/headers';
import { getPayload } from 'payload';
import config from '@payload-config';
import { StudentLoginForm } from './StudentLoginForm';
import { StudentLogoutButton } from './StudentLogoutButton';

export const dynamic = 'force-dynamic';

export default async function StudentPortalPage() {
  // 1. ვკითხულობთ ჩვენ მიერ ავტორიზაციისას შექმნილ student_session ქუქის
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('student_session');
  
  let email: string | null = null;
  if (sessionCookie?.value) {
    try {
      const parsed = JSON.parse(sessionCookie.value);
      email = typeof parsed.email === 'string' ? parsed.email.toLowerCase() : null;
    } catch {
      email = null;
    }
  }

  // 2. თუ ქუქი არ არის, გამოჩნდება შესვლის ფორმა
  if (!email) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-1 items-center justify-center px-6 py-12">
        <section className="w-full max-w-xl rounded-xl bg-white p-8 shadow-sm sm:p-12">
          <Link href="/" className="mb-8 inline-block text-sm font-semibold text-[#d6006a]">← მთავარ გვერდზე</Link>
          <h1 className="mb-3 text-3xl font-black text-gray-950">სტუდენტის პასპორტი</h1>
          <p className="mb-8 text-gray-600">შედით BTU-ის უნივერსიტეტის ელფოსტით თქვენი უახლესი პასპორტის სანახავად და ჩამოსატვირთად.</p>
          <StudentLoginForm />
        </section>
      </main>
    );
  }

  // 3. თუ ქუქი არსებობს, მოგვაქვს მონაცემები
  const payload = await getPayload({ config });

  const students = await payload.find({
    collection: 'students',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const student = students.docs[0] || null;

  const passports = student
    ? await payload.find({
        collection: 'passports',
        where: { studentRecord: { equals: student.id } },
        limit: 1,
        depth: 1,
        overrideAccess: true,
      })
    : null;
  const passport = passports?.docs[0] || null;
  const latestVersion = passport?.latestVersion && typeof passport.latestVersion === 'object'
    ? passport.latestVersion
    : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-1 flex-col px-6 py-10">
      <header className="mb-10 flex items-center justify-between border-b border-gray-200 pb-5">
        <div>
          <Link href="/" className="text-sm font-semibold text-[#d6006a]">BTU Digital Passport</Link>
          <h1 className="mt-2 text-2xl font-black text-gray-950">ჩემი პასპორტი</h1>
        </div>
        <StudentLogoutButton />
      </header>

      {!student || !passport ? (
        <section className="border-l-4 border-amber-500 bg-white p-6">
          <h2 className="text-lg font-bold text-gray-900">პასპორტი ჯერ არ არის ხელმისაწვდომი</h2>
          <p className="mt-2 text-sm text-gray-600">ამ BTU ელფოსტასთან დაკავშირებული პასპორტი ვერ მოიძებნა. მიმართეთ უნივერსიტეტის ადმინისტრატორს.</p>
        </section>
      ) : latestVersion ? (
        <section className="max-w-2xl border-t-4 border-[#FE017E] bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold text-gray-500">სტუდენტი</p>
          <h2 className="mt-1 text-xl font-extrabold text-gray-950">{student.firstName} {student.lastName}</h2>
          <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-gray-100 pt-5 sm:grid-cols-2">
            <div><dt className="text-xs font-semibold uppercase text-gray-500">Passport ID</dt><dd className="mt-1 font-bold">{passport.passportId}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-gray-500">ვერსია</dt><dd className="mt-1 font-bold">V{latestVersion.version}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase text-gray-500">Verification ID</dt><dd className="mt-1 break-all font-mono text-sm">{latestVersion.verificationId}</dd></div>
          </dl>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href={`/api/passports/${encodeURIComponent(latestVersion.verificationId)}`} className="inline-flex h-11 items-center justify-center rounded-lg bg-[#FE017E] px-6 font-bold text-white hover:bg-[#d6006a]">PDF-ის ჩამოტვირთვა</a>
            <Link href={`/verify?code=${encodeURIComponent(latestVersion.verificationId)}`} className="inline-flex h-11 items-center justify-center rounded-lg border border-gray-300 px-5 font-semibold text-gray-800 hover:bg-gray-50">საჯარო ვერიფიკაცია</Link>
          </div>
        </section>
      ) : (
        <section className="border-l-4 border-amber-500 bg-white p-6">
          <h2 className="text-lg font-bold text-gray-900">პასპორტის ვერსია ჯერ არ გაცემულა</h2>
          <p className="mt-2 text-sm text-gray-600">პასპორტის მონაცემები არსებობს, მაგრამ ოფიციალური ვერსია ჯერ არ არის გამოცემული.</p>
        </section>
      )}
    </main>
  );
}