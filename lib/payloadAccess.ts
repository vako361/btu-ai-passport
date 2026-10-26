type RequestWithUser = { req: { user: unknown } };

export function isConfiguredPayloadAdmin({ req }: RequestWithUser) {
  const configuredEmail = process.env.PAYLOAD_ADMIN_EMAIL?.trim().toLowerCase();
  if (!configuredEmail || typeof req.user !== 'object' || req.user === null) return false;

  const email = (req.user as { email?: unknown }).email;
  return typeof email === 'string' && email.trim().toLowerCase() === configuredEmail;
}

export function readOwnUser({ req }: RequestWithUser) {
  if (typeof req.user !== 'object' || req.user === null) return false;

  const id = (req.user as { id?: unknown }).id;
  if (typeof id !== 'string' && typeof id !== 'number') return false;
  return { id: { equals: id } };
}