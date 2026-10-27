'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function StudentLoginForm() {
  const [email, setEmail] = useState('');
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/student/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, studentId }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'ავტორიზაცია ვერ მოხერხდა.');
      }

      router.refresh();
      
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('მოულოდნელი შეცდომა სისტემაში.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-gray-500">
          BTU ელფოსტა
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="example@student.btu.edu.ge"
          className="w-full rounded-xl border-2 border-gray-100 bg-gray-50 px-4 py-3.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#e9005c] focus:bg-white focus:outline-none focus:ring-4 focus:ring-pink-500/10 transition-all"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="studentId" className="text-xs font-bold uppercase tracking-wider text-gray-500">
          სტუდენტის ID (ნომერი)
        </label>
        <input
          id="studentId"
          type="text"
          required
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          placeholder="BTU-T-example"
          className="w-full rounded-xl border-2 border-gray-100 bg-gray-50 px-4 py-3.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#e9005c] focus:bg-white focus:outline-none focus:ring-4 focus:ring-pink-500/10 transition-all"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-4 w-full rounded-xl bg-[#e9005c] px-4 py-4 text-sm font-bold text-white shadow-lg shadow-pink-500/25 transition-all hover:bg-[#d00052] hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            მუშავდება...
          </>
        ) : (
          'სისტემაში შესვლა'
        )}
      </button>
    </form>
  );
}