import type { CollectionConfig } from 'payload';
import { isConfiguredPayloadAdmin } from '../lib/payloadAccess';

function relationId(value: unknown): string | undefined {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value !== 'object' || value === null) return undefined;

  const relation = value as { id?: unknown; value?: unknown };
  const id = relation.id ?? relation.value;
  return typeof id === 'string' || typeof id === 'number' ? String(id) : undefined;
}

export const Passports: CollectionConfig = {
  slug: 'passports',
  admin: {
    useAsTitle: 'passportId',
    defaultColumns: ['passportId', 'student', 'firstIssuedAt', 'latestVersion'],
  },
  access: {
    admin: isConfiguredPayloadAdmin,
    create: isConfiguredPayloadAdmin,
    delete: isConfiguredPayloadAdmin,
    read: isConfiguredPayloadAdmin,
    update: isConfiguredPayloadAdmin,
  },
  hooks: {
    beforeChange: [({ data, operation, originalDoc }) => {
      if (operation !== 'update') return data;

      if (data.passportId !== undefined && originalDoc?.passportId && data.passportId !== originalDoc.passportId) {
        throw new Error('Passport ID is permanent and cannot be changed.');
      }
      if (data.studentId !== undefined && originalDoc?.studentId && data.studentId !== originalDoc.studentId) {
        throw new Error('Student ID is permanent and cannot be changed.');
      }
      if (data.studentRecord !== undefined && originalDoc?.studentRecord && relationId(data.studentRecord) !== relationId(originalDoc.studentRecord)) {
        throw new Error('A passport cannot be reassigned to another student.');
      }
      // ⚠️ უსაფრთხო თარიღის შედარება, რათა განახლება არ ჩაიშალოს
      if (
        data.firstIssuedAt !== undefined &&
        originalDoc?.firstIssuedAt &&
        new Date(data.firstIssuedAt).getTime() !== new Date(originalDoc.firstIssuedAt).getTime()
      ) {
        throw new Error('The first issue date is permanent and cannot be changed.');
      }
      if (data.firstName !== undefined && data.firstName !== originalDoc?.firstName) {
        throw new Error('The passport holder name is permanent and cannot be changed.');
      }
      if (data.lastName !== undefined && data.lastName !== originalDoc?.lastName) {
        throw new Error('The passport holder surname is permanent and cannot be changed.');
      }

      return data;
    }],
  },
  fields: [
    { name: 'studentId', type: 'text', required: true, unique: true, admin: { readOnly: true } },
    { name: 'email', type: 'email', admin: { readOnly: true } },
    { name: 'acquiredSkills', type: 'array', fields: [
      { name: 'skillId', type: 'text', required: true },
      { name: 'skillName', type: 'text', required: true },
      { name: 'dateEarned', type: 'date', required: true },
    ] },
    { name: 'passportId', type: 'text', unique: true, admin: { readOnly: true } },
    { name: 'studentRecord', type: 'relationship', relationTo: 'students', unique: true, admin: { readOnly: true } },
    { name: 'firstName', type: 'text', required: true, admin: { readOnly: true } },
    { name: 'lastName', type: 'text', required: true, admin: { readOnly: true } },
    { name: 'firstIssuedAt', type: 'date', admin: { readOnly: true } },
    { name: 'latestVersion', type: 'relationship', relationTo: 'passport-versions' },
  ],
};