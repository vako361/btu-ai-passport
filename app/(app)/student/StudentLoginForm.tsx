'use client';

import { useState, type FormEvent } from 'react';

export function StudentLoginForm() {
  const [email, setEmail] = useState('');
  const [studentId, setStudentId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      // 🚀 გასწორებულია: /api/users/login -> /api/student/login
      const response = await fetch('/api/student/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          studentId: studentId.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'შესვლა ვერ მოხერხდა. შეამოწმეთ ელფოსტა და სტუდენტის ID.');
      }

      window.location.href = '/student';
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'შესვლა ვერ მოხერხდა.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-5">
      <div>
        <label htmlFor="student-email" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700">
          BTU ელფოსტა
        </label>
        <input
          id="student-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="btu-t-0014@student.btu.edu.ge"
          className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 text-sm font-medium text-gray-900 outline-none focus:border-[#FE017E]"
          disabled={submitting}
        />
      </div>

      <div>
        <label htmlFor="student-id" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700">
          სტუდენტის ID (ნომერი)
        </label>
        <input
          id="student-id"
          type="text"
          required
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          placeholder="BTU-T-0014"
          className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 text-sm font-medium text-gray-900 outline-none focus:border-[#FE017E]"
          disabled={submitting}
        />
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-600 border border-red-100">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !email || !studentId}
        className="h-12 w-full rounded-xl bg-[#FE017E] text-sm font-bold text-white transition-all hover:bg-[#d6006a] disabled:opacity-50"
      >
        {submitting ? 'მოწმდება...' : 'პორტალზე შესვლა →'}
      </button>
    </form>
  );
}