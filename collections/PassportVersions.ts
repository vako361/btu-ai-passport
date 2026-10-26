import type { CollectionConfig } from 'payload';
import { isConfiguredPayloadAdmin } from '../lib/payloadAccess';

export const PassportVersions: CollectionConfig = {
  slug: 'passport-versions',
  admin: {
    useAsTitle: 'verificationId',
    defaultColumns: ['passport', 'version', 'verificationId', 'issuedAt'],
  },
  access: {
    admin: isConfiguredPayloadAdmin,
    create: isConfiguredPayloadAdmin,
    delete: () => false,
    read: isConfiguredPayloadAdmin,
    update: () => false,
  },
  indexes: [{ fields: ['passport', 'version'], unique: true }],
  fields: [
    { name: 'passport', type: 'relationship', relationTo: 'passports', required: true, index: true },
    { name: 'version', type: 'number', required: true, min: 1 },
    { name: 'sourceRecordId', type: 'text', required: true, unique: true },
    { name: 'verificationId', type: 'text', required: true, unique: true },
    { name: 'documentHash', type: 'text', required: true },
    {
      name: 'issuanceStatus',
      type: 'select',
      required: true,
      options: [
        { label: 'Prepared', value: 'PREPARED' },
        { label: 'Failed', value: 'FAILED' },
        { label: 'Issued', value: 'ISSUED' },
      ],
    },
    {
      name: 'skillsSnapshot',
      type: 'array',
      fields: [
        { name: 'recordId', type: 'text', required: true },
        { name: 'skillCode', type: 'text', required: true },
        { name: 'skillName', type: 'text', required: true },
        { name: 'badgeId', type: 'text', required: true },
        { name: 'earnedAt', type: 'date', required: true },
        { name: 'description', type: 'textarea' },
      ],
    },
    { name: 'issuerAddress', type: 'text', required: true },
    { name: 'transactionHash', type: 'text' },
    { name: 'issuedAt', type: 'date', required: true },
  ],
};