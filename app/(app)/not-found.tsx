import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-xs font-bold uppercase tracking-wider text-[#FE017E]">404</p>
      <h1 className="mt-2 text-2xl font-black text-gray-900">Page not found</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-600">The page may have moved, or the address may be incorrect.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className="inline-flex h-11 items-center justify-center rounded-lg bg-[#FE017E] px-6 text-sm font-bold text-white hover:bg-[#d6006a]">
          Go home
        </Link>
        <Link href="/verify" className="inline-flex h-11 items-center justify-center rounded-lg border border-gray-200 bg-white px-6 text-sm font-bold text-gray-800 hover:bg-gray-50">
          Verify a passport
        </Link>
      </div>
    </main>
  );
}