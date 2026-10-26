'use client';

import { useRouter } from 'next/navigation';

export function StudentLogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch('/api/users/logout', { method: 'POST', credentials: 'include' });
    router.refresh();
  }

  return (
    <button onClick={logout} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
      გამოსვლა
    </button>
  );
}