import Link from 'next/link';
import Image from 'next/image';
import { cookies } from 'next/headers';
import { getPayload } from 'payload';
import config from '@payload-config';
import { StudentLoginForm } from './StudentLoginForm';
import { StudentLogoutButton } from './StudentLogoutButton';

export const dynamic = 'force-dynamic';

export default async function StudentPortalPage() {
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

  // შესვლის ფორმა (Light Theme - თეთრი და ვარდისფერი სტილით)
  if (!email) {
    return (
      <main className="relative flex min-h-screen w-full items-center justify-center bg-gray-50 px-4 py-12 text-gray-900 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[#e9005c]/10 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-purple-600/5 blur-[120px] pointer-events-none" />

        <section className="relative z-10 w-full max-w-105 rounded-3xl border border-gray-200 bg-white p-8 shadow-xl sm:p-10">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#e9005c] transition-colors hover:text-[#b00045]"
          >
            ← მთავარ გვერდზე
          </Link>

          <div className="mb-8 text-center flex flex-col items-center">
            <div className="relative h-16 w-32 mb-4">
                <Image
                  src="https://btu.edu.ge/wp-content/uploads/2021/06/BTU_Logo_new-1.svg"
                  alt="BTU"
                  fill
                  className="object-contain"
                  priority
                />
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">
              სტუდენტის პორტალი
            </h1>
            <p className="mt-3 text-sm font-medium text-gray-500 leading-relaxed">
              შედით BTU-ის უნივერსიტეტის ელფოსტით თქვენი უახლესი ციფრული პასპორტის სანახავად.
            </p>
          </div>

          <StudentLoginForm />
        </section>
      </main>
    );
  }

  // მონაცემების მოთხოვნა ბაზიდან
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
    <main className="relative flex min-h-screen w-full flex-col bg-gray-50 text-gray-900">
      <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-[#e9005c]/5 blur-[130px] pointer-events-none" />

      {/* ჰედერი - BTU-ს ოფიციალური ვარდისფერი ფერით (#e9005c) */}
      <header className="sticky top-0 z-50 bg-[#e9005c] shadow-md h-20">
        <div className="flex h-full items-center justify-between pr-6">
          <div className="flex items-stretch h-full">
            <div className="bg-[#e5e5e5] px-6 sm:px-12 flex items-center justify-center relative w-35 sm:w-45">
               <Image
                  src="https://btu.edu.ge/wp-content/uploads/2021/06/BTU_Logo_new-1.svg"
                  alt="BTU - ბიზნესისა და ტექნოლოგიების უნივერსიტეტი"
                  fill
                  className="object-contain p-4"
                  priority
                />
            </div>
            
            <div className="flex flex-col justify-center ml-6 sm:ml-8">
              <Link href="/" className="block text-sm sm:text-base font-extrabold tracking-tight text-white hover:text-pink-100 transition-colors">
                AI Digital Passport
              </Link>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-pink-100/80">
                სტუდენტის კაბინეტი
              </span>
            </div>
          </div>
          <StudentLogoutButton />
        </div>
      </header>

      {/* ძირითადი შინაარსი - სუფთა თეთრი ბარათებით */}
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-10 relative z-10">
        {!student || !passport ? (
          <section className="rounded-2xl border-l-4 border-amber-500 bg-white p-6 sm:p-8 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 font-bold">⚠️</div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">პასპორტი ჯერ არ არის ხელმისაწვდომი</h2>
                <p className="mt-1 text-sm text-gray-600">
                  <span className="font-semibold text-gray-900">{email}</span> ელფოსტასთან დაკავშირებული პასპორტი ვერ მოიძებნა. გთხოვთ, მიმართოთ უნივერსიტეტის ადმინისტრატორს.
                </p>
              </div>
            </div>
          </section>
        ) : latestVersion ? (
          <section className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white p-6 sm:p-10 shadow-xl shadow-gray-100">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#e9005c]" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-6">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-100 px-3 py-1 text-xs font-bold text-emerald-600 mb-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  აქტიური პასპორტი
                </span>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">
                  {student.firstName} {student.lastName}
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-1 font-mono">{email}</p>
              </div>

              <div className="self-start sm:self-auto">
                <span className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-bold text-gray-700">
                  ვერსია <span className="ml-1 text-[#e9005c] font-extrabold text-sm">V{latestVersion.version}</span>
                </span>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-4 py-6 sm:grid-cols-2">
              <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-5">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-gray-400">PASSPORT ID</dt>
                <dd className="mt-1 font-mono text-base font-bold text-gray-900">{passport.passportId}</dd>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-5">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-gray-400">ვერსია</dt>
                <dd className="mt-1 font-mono text-base font-bold text-[#e9005c]">V{latestVersion.version}</dd>
              </div>

              <div className="sm:col-span-2 rounded-2xl border border-gray-100 bg-gray-50/50 p-5">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-gray-400">VERIFICATION ID / HASH</dt>
                <dd className="mt-1 break-all font-mono text-xs sm:text-sm font-medium text-gray-600">
                  {latestVersion.verificationId}
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href={`/api/passports/${encodeURIComponent(latestVersion.verificationId)}`}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#e9005c] hover:bg-[#d00052] px-7 text-sm font-bold text-white shadow-lg shadow-pink-500/20 transition-all hover:scale-[1.02]"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                PDF-ის ჩამოტვირთვა
              </a>

              <Link
                href={`/verify?code=${encodeURIComponent(latestVersion.verificationId)}`}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-7 text-sm font-bold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50"
              >
                <svg className="h-4 w-4 text-[#e9005c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                საჯარო ვერიფიკაცია
              </Link>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border-l-4 border-amber-500 bg-white p-6 sm:p-8 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 font-bold">⚠️</div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">პასპორტის ვერსია ჯერ არ გაცემულა</h2>
                <p className="mt-1 text-sm text-gray-600">
                  პასპორტის მონაცემები არსებობს, მაგრამ ოფიციალური ვერსია ჯერ არ არის გამოცემული.
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}