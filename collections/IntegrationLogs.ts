import type { CollectionConfig } from 'payload';
import { isConfiguredPayloadAdmin } from '../lib/payloadAccess';

export const IntegrationLogs: CollectionConfig = {
  slug: 'integration-logs',
  admin: {
    useAsTitle: 'requestId',
    defaultColumns: ['requestId', 'recordId', 'stage', 'outcome', 'loggedAt'],
  },
  access: {
    admin: isConfiguredPayloadAdmin,
    create: () => false,
    delete: () => false,
    read: isConfiguredPayloadAdmin,
    update: () => false,
  },
  fields: [
    { name: 'requestId', type: 'text', required: true, unique: true },
    { name: 'source', type: 'select', required: true, options: [{ label: 'Google Sheets', value: 'GOOGLE_SHEETS' }] },
    { name: 'recordId', type: 'text', index: true },
    {
      name: 'stage',
      type: 'select',
      required: true,
      options: [
        { label: 'Authentication', value: 'AUTHENTICATION' },
        { label: 'Validation', value: 'VALIDATION' },
        { label: 'Lookup', value: 'LOOKUP' },
        { label: 'Ingestion', value: 'INGESTION' },
      ],
    },
    {
      name: 'outcome',
      type: 'select',
      required: true,
      options: [
        { label: 'Accepted', value: 'ACCEPTED' },
        { label: 'Duplicate', value: 'DUPLICATE' },
        { label: 'Skipped', value: 'SKIPPED' },
        { label: 'Rejected', value: 'REJECTED' },
        { label: 'Failed', value: 'FAILED' },
      ],
    },
    { name: 'message', type: 'textarea', required: true },
    { name: 'loggedAt', type: 'date', required: true },
  ],
};