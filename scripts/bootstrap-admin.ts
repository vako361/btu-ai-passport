import dotenv from 'dotenv';
import { getAdminBootstrapEnv } from '../lib/env';

dotenv.config({ path: ['.env.local', '.env'] });

const env = getAdminBootstrapEnv();
const adminEmail = env.PAYLOAD_ADMIN_EMAIL.toLowerCase();

// Loaded after dotenv because the Payload config reads the environment on import.
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

  const current = existing.docs[0];
  if (!current) {
    await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: { email: adminEmail, password: env.PAYLOAD_ADMIN_PASSWORD, role: 'admin' },
    });
    console.log('Administrator account created.');
  } else if (current.role !== 'admin') {
    await payload.update({
      collection: 'users',
      id: current.id,
      overrideAccess: true,
      data: { role: 'admin' },
    });
    console.log('Existing account promoted to administrator. Password unchanged.');
  } else {
    console.log('Administrator account already exists; no changes made.');
  }
} finally {
  await payload.destroy();
}
