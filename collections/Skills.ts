import type { CollectionConfig } from 'payload';
import { isConfiguredPayloadAdmin } from '../lib/payloadAccess';

export const Skills: CollectionConfig = {
  slug: 'skills',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['skillCode', 'name', 'category', 'badgeId'],
  },
  access: {
    admin: isConfiguredPayloadAdmin,
    create: isConfiguredPayloadAdmin,
    delete: isConfiguredPayloadAdmin,
    read: isConfiguredPayloadAdmin,
    update: isConfiguredPayloadAdmin,
  },
  fields: [
    { name: 'skillCode', type: 'text', required: true, unique: true },
    { name: 'name', type: 'text', required: true },
    { name: 'category', type: 'text' },
    { name: 'description', type: 'textarea' },
    { name: 'badgeId', type: 'text', required: true },
  ],
};