import type { CollectionConfig } from 'payload';
import { canWrite, isAuthenticated } from '../lib/access';

export const Skills: CollectionConfig = {
  slug: 'skills',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['skillCode', 'name', 'category', 'badgeId'],
  },
  access: {
    create: canWrite,
    delete: canWrite,
    read: isAuthenticated,
    update: canWrite,
  },
  fields: [
    { name: 'skillCode', type: 'text', required: true, unique: true },
    { name: 'name', type: 'text', required: true },
    { name: 'category', type: 'text' },
    { name: 'description', type: 'textarea' },
    { name: 'badgeId', type: 'text', required: true },
  ],
};