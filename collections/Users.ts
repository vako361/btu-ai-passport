import type { CollectionConfig } from 'payload';
import { canOpenAdminPanel, canWrite, canWriteField, readSelf } from '../lib/access';

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'User', plural: 'Users' },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'role', 'student', 'isDemo'],
  },
  auth: {
    loginWithUsername: false,
    tokenExpiration: 8 * 60 * 60,
  },
  access: {
    admin: canOpenAdminPanel,
    create: canWrite,
    delete: canWrite,
    read: readSelf,
    update: canWrite,
  },
  hooks: {
    beforeValidate: [async ({ data, operation, req }) => {
      if (operation !== 'create' || !data) return data;

      // The first account created through the admin panel must be able to administer the system.
      const { totalDocs } = await req.payload.count({ collection: 'users', overrideAccess: true, req });
      return totalDocs === 0 ? { ...data, role: 'admin' } : data;
    }],
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'student',
      options: [
        { label: 'Administrator', value: 'admin' },
        { label: 'Student', value: 'student' },
      ],
      access: { create: canWriteField, update: canWriteField },
    },
    {
      name: 'student',
      type: 'relationship',
      relationTo: 'students',
      admin: {
        description: 'Student record this account belongs to.',
        condition: (data) => data?.role === 'student',
      },
      validate: (value: unknown, { siblingData }: { siblingData: unknown }) => {
        const role = (siblingData as { role?: unknown } | undefined)?.role;
        return role === 'student' && !value ? 'A student account must be linked to a student record.' : true;
      },
      access: { create: canWriteField, update: canWriteField },
    },
    {
      name: 'isDemo',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Demo accounts are read-only in the CMS and their data resets automatically.',
      },
      access: { create: canWriteField, update: canWriteField },
    },
  ],
};
