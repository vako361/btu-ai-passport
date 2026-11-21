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
    // Base64 of an encrypted PDF is ~1 MB, above Payload's 40,000-character default. Column stays varchar, so no migration.
    { name: 'encryptedPdf', type: 'text', required: true, maxLength: 10_000_000 },
  ],
};
