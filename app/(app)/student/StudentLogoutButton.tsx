'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation'; // ⚠️ დამატებულია

export function StudentLogoutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter(); // ⚠️ ინიციალიზაცია

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch('/api/student/logout', { method: 'POST' });
      
      // ქუქის წაშლის შემდეგ სწორი ნავიგაცია
      router.push('/student');
      router.refresh(); // ⚠️ დაგეხმარება, რომ სერვერულმა კომპონენტებმა წაშლილი ქუქი დაინახონ
      
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