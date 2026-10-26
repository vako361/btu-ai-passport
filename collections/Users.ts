import type { CollectionConfig } from 'payload'
import { isConfiguredPayloadAdmin, readOwnUser } from '../lib/payloadAccess';

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: {
    loginWithUsername: false,
    tokenExpiration: 8 * 60 * 60,
  },
  access: {
    admin: isConfiguredPayloadAdmin,
    create: isConfiguredPayloadAdmin,
    delete: isConfiguredPayloadAdmin,
    read: readOwnUser,
    update: isConfiguredPayloadAdmin,
  },
  hooks: {
    beforeLogin: [({ user }) => {
      const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
      const configuredAdminEmail = process.env.PAYLOAD_ADMIN_EMAIL?.trim().toLowerCase();
      if (configuredAdminEmail && email === configuredAdminEmail) return user;

      const domain = (process.env.BTU_EMAIL_DOMAIN || 'btu.edu.ge').trim().replace(/^@/, '').toLowerCase();
      if (!email.endsWith(`@${domain}`)) {
        throw new Error('Use your BTU university email to sign in.');
      }
      return user;
    }],
  },
  fields: [
    // Email added by default
    // Add more fields as needed
  ],
}
