import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const adminEmail = process.env.PAYLOAD_ADMIN_EMAIL?.trim().toLowerCase();
const emailDomain = (process.env.BTU_EMAIL_DOMAIN || 'btu.edu.ge').trim().replace(/^@/, '').toLowerCase();
const password = process.env.PAYLOAD_ADMIN_PASSWORD;

if (!adminEmail || !adminEmail.endsWith(`@${emailDomain}`)) {
  throw new Error('Set PAYLOAD_ADMIN_EMAIL to the BTU administrator email before bootstrapping.');
}
if (!password || password.length < 12) {
  throw new Error('Set PAYLOAD_ADMIN_PASSWORD to a password of at least 12 characters.');
}

const [{ default: config }, { getPayload }] = await Promise.all([
  import('../payload.config'),
  import('payload'),
]);
const payload = await getPayload({ config });

try {
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: adminEmail } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });

  if (existing.docs.length > 0) {
    console.log('Configured BTU administrator account already exists; no changes made.');
  } else {
    await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: { email: adminEmail, password },
    });
    console.log('Configured BTU administrator account created.');
  }
} finally {
  await payload.destroy();
}