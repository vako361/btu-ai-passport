import type { CollectionConfig } from 'payload';

// Encrypted credential PDFs; only server code touches this table, always with overrideAccess.
export const PassportFiles: CollectionConfig = {
  slug: 'passport-files',
  admin: {
    hidden: true,
  },
  access: {
    create: () => false,
    delete: () => false,
    read: () => false,
    update: () => false,
  },
  fields: [
    { name: 'verificationId', type: 'text', required: true, unique: true },
    { name: 'documentHash', type: 'text', required: true },
    { name: 'encryptedPdf', type: 'text', required: true },
  ],
};
