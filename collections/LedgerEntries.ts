import type { CollectionConfig } from 'payload';
import { isAdmin } from '../lib/access';

export const LedgerEntries: CollectionConfig = {
  slug: 'ledger-entries',
  labels: { singular: 'Ledger Entry', plural: 'Ledger Entries' },
  admin: {
    useAsTitle: 'verificationId',
    defaultColumns: ['verificationId', 'passportId', 'version', 'isLatest', 'registeredAt'],
    description: 'Signed, hash-chained credential registrations used when LEDGER_MODE=demo.',
  },
  access: {
    read: isAdmin,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  indexes: [{ fields: ['passportId', 'version'], unique: true }],
  fields: [
    { name: 'verificationId', type: 'text', required: true, unique: true, index: true },
    { name: 'passportId', type: 'text', required: true, index: true },
    { name: 'documentHash', type: 'text', required: true },
    { name: 'version', type: 'number', required: true, min: 1 },
    { name: 'previousVerificationId', type: 'text' },
    { name: 'previousEntryHash', type: 'text', required: true },
    { name: 'registeredAt', type: 'date', required: true },
    { name: 'entryHash', type: 'text', required: true, unique: true },
    { name: 'signature', type: 'text', required: true },
    { name: 'issuerAddress', type: 'text', required: true },
    { name: 'isLatest', type: 'checkbox', defaultValue: true },
  ],
};
