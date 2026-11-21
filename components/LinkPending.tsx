'use client';

import { useLinkStatus } from 'next/link';
import { Spinner } from './ui/Spinner';

/** Place inside a `Link` to show a spinner while that navigation is in flight. */
export function LinkPending({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  const { pending } = useLinkStatus();
  return pending ? <Spinner className={className} /> : null;
}
