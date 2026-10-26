'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export function StudentLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/users/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) throw new Error('შესვლა ვერ მოხერხდა. შეამოწმეთ მონაცემები ან მიმართეთ BTU ადმინისტრატორს.');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'შესვლა ვერ მოხერხდა.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
      <div>
        <label htmlFor="student-email" className="mb-2 block text-sm font-semibold text-gray-600">BTU ელფოსტა</label>
        <input
          id="student-email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@btu.edu.ge"
          className="h-12 w-full rounded-lg border border-gray-300 bg-white px-4 text-base outline-none focus:border-[#FE017E] focus:ring-1 focus:ring-[#FE017E]"
          disabled={submitting}
        />
      </div>
      <div>
        <label htmlFor="student-password" className="mb-2 block text-sm font-semibold text-gray-600">პაროლი</label>
        <input
          id="student-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-12 w-full rounded-lg border border-gray-300 bg-white px-4 text-base outline-none focus:border-[#FE017E] focus:ring-1 focus:ring-[#FE017E]"
          disabled={submitting}
        />
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={submitting || !email || !password}
        className="h-12 w-full rounded-lg bg-[#FE017E] px-5 font-bold text-white transition-colors hover:bg-[#d6006a] disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {submitting ? 'მოწმდება...' : 'შესვლა'}
      </button>
    </form>
  );
}