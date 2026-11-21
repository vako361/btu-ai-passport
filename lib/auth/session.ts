import { cache } from 'react';
import { headers as nextHeaders } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Payload } from 'payload';
import { sessionUser, type Role, type SessionUser } from '../access';
import { getRequestPayload } from '../payloadClient';

export const AUTH_COOKIE_NAME = 'payload-token';

export function homePathFor(role: Role): string {
  return role === 'admin' ? '/dashboard' : '/student';
}

/** Cached per request, so `requireRole` and the page body share one auth lookup. */
export const getSession = cache(async (): Promise<{ payload: Payload; user: SessionUser | null }> => {
  const payload = await getRequestPayload();
  const { user } = await payload.auth({ headers: await nextHeaders() });
  return { payload, user: sessionUser({ user }) };
});

/** Server Component guard: sends visitors to the login page, and users of another role to their own home. */
export async function requireRole(role: Role): Promise<{ payload: Payload; user: SessionUser }> {
  const { payload, user } = await getSession();
  if (!user) redirect('/login');
  if (user.role !== role) redirect(homePathFor(user.role));
  return { payload, user };
}
