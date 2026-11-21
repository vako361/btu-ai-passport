'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { demoLoginAction, type LoginState } from '@/lib/auth/actions';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from 'sonner';

const initialState: LoginState = {};

interface DemoButtonProps {
  role: 'admin' | 'student';
  label: string;
  description: string;
  tone: 'primary' | 'secondary';
}

function DemoButton({ role, label, description, tone }: DemoButtonProps) {
  const { pending, data } = useFormStatus();
  const active = pending && data?.get('role') === role;
  const colors = tone === 'primary'
    ? 'bg-[#FE017E] text-white hover:bg-[#d6006a]'
    : 'border-2 border-gray-200 bg-white text-gray-800 hover:border-[#FE017E]';

  return (
    <button
      type="submit"
      name="role"
      value={role}
      disabled={pending}
      className={`flex w-full flex-col items-start gap-0.5 rounded-xl px-5 py-3.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-70 ${colors}`}
    >
      <span className="flex items-center gap-2 text-[15px] font-bold">
        {active ? <Spinner /> : null}
        {active ? 'Signing in...' : label}
      </span>
      <span className={`text-xs ${tone === 'primary' ? 'text-pink-100' : 'text-gray-500'}`}>{description}</span>
    </button>
  );
}

export function DemoLogin() {
  const [state, formAction] = useActionState(demoLoginAction, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state.error]);

  // The action returns the destination instead of redirecting, so this is a normal client navigation that shows the target's loading UI.
  useEffect(() => {
    if (state.destination) router.replace(state.destination);
  }, [router, state.destination]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <DemoButton
        role="admin"
        tone="primary"
        label="Login as Demo Admin"
        description="Issue a credential and verify it in seconds."
      />
      <DemoButton
        role="student"
        tone="secondary"
        label="Login as Demo Student"
        description="See a student's passport, skills and PDF."
      />
    </form>
  );
}
