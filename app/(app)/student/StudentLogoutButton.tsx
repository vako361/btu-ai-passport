'use client';

import { useState } from 'react';

export function StudentLogoutButton() {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch('/api/student/logout', { method: 'POST' });
      // ქუქის წაშლის შემდეგ გვერდის გადატვირთვა
      window.location.href = '/student';
    } catch (error) {
      console.error('Logout error:', error);
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-300 transition-colors hover:border-gray-500 hover:text-white disabled:opacity-50"
    >
      {loading ? 'გამოდის...' : 'გამოსვლა'}
    </button>
  );
}