'use client';

import { useActionState } from 'react';
import { loginAction, type LoginState } from '@/lib/auth/actions';
import { SubmitButton } from '@/components/ui/SubmitButton';

const initialState: LoginState = {};

const inputClass =
  'h-12 w-full rounded-lg border bg-white px-4 text-[15px] font-medium outline-none transition-all focus:border-[#FE017E] focus:ring-1 focus:ring-[#FE017E]';

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState);
  const emailError = state.fieldErrors?.email;
  const passwordError = state.fieldErrors?.password;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {state.error}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-gray-500">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email ?? ''}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? 'email-error' : undefined}
          className={`${inputClass} ${emailError ? 'border-red-400' : 'border-gray-200'}`}
        />
        {emailError ? <p id="email-error" className="text-sm text-red-600">{emailError}</p> : null}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-gray-500">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={passwordError ? 'password-error' : undefined}
          className={`${inputClass} ${passwordError ? 'border-red-400' : 'border-gray-200'}`}
        />
        {passwordError ? <p id="password-error" className="text-sm text-red-600">{passwordError}</p> : null}
      </div>

      <SubmitButton
        pendingLabel="Signing in..."
        className="h-12 rounded-lg bg-[#FE017E] px-6 text-white shadow-sm hover:bg-[#d6006a]"
      >
        Sign in
      </SubmitButton>
    </form>
  );
}
