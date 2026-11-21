import type { ReactNode } from 'react';
import { AppHeader } from './AppHeader';

/**
 * Loading shell for an app route. It renders the same header as the page so the chrome stays in place
 * while the route's data loads.
 */
export function AppRouteSkeleton({
  label,
  subtitle,
  size = 'wide',
  children,
}: {
  label: string;
  subtitle: string;
  size?: 'narrow' | 'wide';
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F4F5F7] text-gray-900">
      <AppHeader subtitle={subtitle} />
      <main
        aria-busy="true"
        aria-live="polite"
        className={`mx-auto w-full flex-1 space-y-8 px-6 py-10 ${size === 'narrow' ? 'max-w-3xl' : 'max-w-6xl'}`}
      >
        <span className="sr-only">{label}</span>
        <div className="animate-pulse space-y-8" aria-hidden="true">
          {children}
        </div>
      </main>
    </div>
  );
}
