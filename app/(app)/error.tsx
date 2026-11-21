'use client';

import { useEffect } from 'react';

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error('Application route failed:', error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center bg-[#F4F5F7] px-6 py-16 text-center">
      <p className="text-xs font-bold uppercase tracking-wider text-[#FE017E]">Something went wrong</p>
      <h1 className="mt-2 text-2xl font-black text-gray-900">This page could not be loaded.</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-600">Try again. If the problem continues, return to the home page and retry from there.</p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-[#FE017E] px-6 text-sm font-bold text-white hover:bg-[#d6006a]"
      >
        Try again
      </button>
    </main>
  );
}