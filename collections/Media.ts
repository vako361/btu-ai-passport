import type { CollectionConfig } from 'payload'
import { canWrite } from '../lib/access'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    create: canWrite,
    delete: canWrite,
    read: () => true,
    update: canWrite,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  upload: true,
}
