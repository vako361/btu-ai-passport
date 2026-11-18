import type { CollectionConfig } from 'payload';
import { canWrite, readOwnStudent } from '../lib/access';

export const Students: CollectionConfig = {
  slug: 'students',
  admin: {
    useAsTitle: 'studentId',
    defaultColumns: ['studentId', 'firstName', 'lastName', 'email'],
  },
  access: {
    create: canWrite,
    delete: canWrite,
    read: readOwnStudent,
    update: canWrite,
  },
  hooks: {
    beforeChange: [({ data, operation, originalDoc }) => {
      if (typeof data.email === 'string') data.email = data.email.trim().toLowerCase();
      if (operation === 'update' && data.studentId !== undefined && data.studentId !== originalDoc?.studentId) {
        throw new Error('Student ID is permanent and cannot be changed.');
      }
      return data;
    }],
  },
  fields: [
    { name: 'studentId', type: 'text', required: true, unique: true, admin: { readOnly: true } },
    { name: 'firstName', type: 'text', required: true },
    { name: 'lastName', type: 'text', required: true },
    { name: 'email', type: 'email', required: true, unique: true },
  ],
};