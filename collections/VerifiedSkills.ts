import type { CollectionConfig } from 'payload';
import { isConfiguredPayloadAdmin } from '../lib/payloadAccess';

export const VerifiedSkills: CollectionConfig = {
  slug: 'verified-skills',
  admin: {
    useAsTitle: 'recordId',
    defaultColumns: ['recordId', 'student', 'skill', 'status', 'earnedAt'],
  },
  access: {
    admin: isConfiguredPayloadAdmin,
    create: isConfiguredPayloadAdmin,
    delete: isConfiguredPayloadAdmin,
    read: isConfiguredPayloadAdmin,
    update: isConfiguredPayloadAdmin,
  },
  fields: [
    { name: 'recordId', type: 'text', required: true, unique: true },
    { name: 'student', type: 'relationship', relationTo: 'students', required: true, index: true },
    { name: 'skill', type: 'relationship', relationTo: 'skills', required: true },
    { name: 'earnedAt', type: 'date', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'PENDING',
      options: [
        { label: 'Confirmed', value: 'CONFIRMED' },
        { label: 'Pending', value: 'PENDING' },
        { label: 'Rejected', value: 'REJECTED' },
      ],
    },
    {
      name: 'processingStatus',
      type: 'select',
      required: true,
      options: [
        { label: 'Queued', value: 'QUEUED' },
        { label: 'Skipped', value: 'SKIPPED' },
        { label: 'Processing', value: 'PROCESSING' },
        { label: 'Processed', value: 'PROCESSED' },
        { label: 'Failed', value: 'FAILED' },
      ],
    },
    { name: 'processingError', type: 'textarea' },
    { name: 'processingStartedAt', type: 'date' },
    { name: 'processedAt', type: 'date' },
  ],
};