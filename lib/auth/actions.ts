'use server';

import { login, logout } from '@payloadcms/next/auth';
import { redirect } from 'next/navigation';
import { AuthenticationError, getPayload, LockedAuth } from 'payload';
import config from '@payload-config';
import { ensureDemoAccounts } from '../demo/accounts';
import { tryCleanupVisitorData } from '../demo/cleanup';
import { getDemoEnv, EnvConfigError, type DemoCredentials } from '../env';
import { credentialsSchema, demoRoleSchema, fieldErrorsFrom, type FieldErrors } from '../validation/auth';
import { homePathFor } from './session';

export interface LoginState {
  error?: string;
  fieldErrors?: FieldErrors<'email' | 'password'>;
  /** Echoed back so the email survives a failed attempt. */
  email?: string;
}

const GENERIC_ERROR = 'Something went wrong. Please try again.';

function authFailureMessage(error: unknown): string | null {
  if (error instanceof LockedAuth) return 'Too many failed attempts. This account is locked for a few minutes.';
  if (error instanceof AuthenticationError) return 'Invalid email or password.';
  return null;
}

async function signIn(credentials: DemoCredentials) {
  const result = await login({ collection: 'users', config, email: credentials.email, password: credentials.password });
  if (!result.user) throw new Error('Login did not return a user.');
  return result.user;
}

export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const rawEmail = formData.get('email');
  const parsed = credentialsSchema.safeParse({
    email: typeof rawEmail === 'string' ? rawEmail : '',
    password: formData.get('password') ?? '',
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error), email: typeof rawEmail === 'string' ? rawEmail : '' };
  }

  let destination: string;
  try {
    const user = await signIn(parsed.data);
    destination = homePathFor(user.role);
  } catch (error) {
    const message = authFailureMessage(error);
    if (!message) console.error('Sign-in failed unexpectedly', error);
    return { error: message ?? GENERIC_ERROR, email: parsed.data.email };
  }

  redirect(destination);
}

export async function demoLoginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const role = demoRoleSchema.safeParse(formData.get('role'));
  if (!role.success) return { error: 'Choose a demo account.' };

  let destination: string;
  try {
    const demo = getDemoEnv();
    if (!demo.enabled) return { error: 'Demo mode is not enabled on this deployment.' };

    const credentials = role.data === 'admin' ? demo.admin : demo.student;
    let user;
    try {
      user = await signIn(credentials);
    } catch (error) {
      if (!authFailureMessage(error)) throw error;
      // First use, a rotated demo password, or a lockout caused by visitors: repair the accounts and retry once.
      await ensureDemoAccounts(await getPayload({ config }), demo);
      user = await signIn(credentials);
    }

    if (!user.isDemo || user.role !== role.data) throw new Error('Demo account is not configured correctly.');
    destination = homePathFor(user.role);

    // Expired visitor credentials are removed here as well, so the cron job is not the only safeguard.
    await tryCleanupVisitorData(await getPayload({ config }), demo.resetAfterMs);
  } catch (error) {
    if (error instanceof EnvConfigError) console.error('Demo mode is misconfigured.', error);
    else console.error('Demo sign-in failed', error);
    return { error: 'The demo is temporarily unavailable. Please try again shortly.' };
  }

  redirect(destination);
}

export async function logoutAction(): Promise<void> {
  await logout({ config });
  redirect('/login');
}
