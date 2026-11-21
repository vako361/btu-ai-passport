import Link from 'next/link';
import { AppHeader } from '@/components/AppHeader';
import { LinkPending } from '@/components/LinkPending';

/** Rendered by notFound() for malformed or unregistered Verification IDs, so the response carries a 404 status. */
export default function CredentialNotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F4F5F7] text-gray-900">
      <AppHeader subtitle="Credential verification" />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <div role="status" className="flex items-start gap-4 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900 sm:p-6">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500 text-lg font-black text-white">
            ✕
          </span>
          <div>
            <h1 className="text-xl font-extrabold">No credential found</h1>
            <p className="mt-1 text-sm leading-relaxed">
              No credential is registered under this Verification ID. Check the code and try again.
            </p>
          </div>
        </div>

        <Link href="/verify" className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-[#FE017E] px-6 text-sm font-bold text-white hover:bg-[#d6006a]">
          Try another code
          <LinkPending className="h-4 w-4" />
        </Link>
      </main>
    </div>
  );
}
