'use client';

import { useRouter } from 'next/navigation';
import { logoutAction } from '@/lib/auth/actions';
import { SubmitButton } from './ui/SubmitButton';

export function LogoutButton() {
  const router = useRouter();

  async function signOut() {
    await logoutAction();
    router.replace('/login');
  }

  return (
    <form action={signOut}>
      <SubmitButton
        pendingLabel="Signing out..."
        className="rounded-lg border border-white/40 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
      >
        Sign out
      </SubmitButton>
    </form>
  );
}
