import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { getSession, homePathFor } from '@/lib/auth/session';
import { isDemoEnabled } from '@/lib/demo/config';
import { DemoLogin } from './DemoLogin';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Sign in | AI Skills Digital Passport' };

export default async function LoginPage() {
  const { user } = await getSession();
  if (user) redirect(homePathFor(user.role));

  const demoEnabled = isDemoEnabled();

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F5F7] text-black">
      <AppHeader />

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <section className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-xl sm:p-10">
          <h1 className="text-2xl font-black tracking-tight text-gray-900">Sign in</h1>
          <p className="mt-2 text-sm font-medium leading-relaxed text-gray-500">
            Administrators issue credentials. Students view and share their verified skills passport.
          </p>

          {demoEnabled ? (
            <div className="mt-8">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#FE017E]">Try the live demo</p>
              <DemoLogin />
              <p className="mt-3 text-xs text-gray-500">
                No wallet or tokens needed. Demo data is synthetic and resets automatically.
              </p>
              <div className="my-8 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                <span className="h-px flex-1 bg-gray-200" />
                or sign in with your account
                <span className="h-px flex-1 bg-gray-200" />
              </div>
            </div>
          ) : (
            <div className="mt-8" />
          )}

          <LoginForm />

          <p className="mt-8 text-center text-sm text-gray-500">
            Looking to check a credential?{' '}
            <Link href="/verify" className="font-bold text-[#FE017E] hover:underline">
              Verify a passport
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
