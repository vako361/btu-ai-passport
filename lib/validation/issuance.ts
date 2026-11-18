import { z } from 'zod';
import type { FieldErrors } from './auth';

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export const issueCredentialSchema = z.object({
  studentId: z.coerce.number({ message: 'Select a student.' }).int().positive('Select a student.'),
  skillId: z.coerce.number({ message: 'Select a skill.' }).int().positive('Select a skill.'),
  earnedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date.')
    .refine((value) => new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value, 'Enter a valid date.')
    .refine((value) => value <= todayUtc(), 'The date cannot be in the future.'),
});

export type IssueCredentialFields = z.infer<typeof issueCredentialSchema>;
export type IssueCredentialFieldErrors = FieldErrors<keyof IssueCredentialFields>;
