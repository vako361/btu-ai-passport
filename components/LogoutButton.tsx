'use client';

import { logoutAction } from '@/lib/auth/actions';
import { SubmitButton } from './ui/SubmitButton';

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <SubmitButton
        pendingLabel="Signing out..."
        className="rounded-lg border border-white/40 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
      >
        Sign out
      </SubmitButton>
    </form>
  );
}
