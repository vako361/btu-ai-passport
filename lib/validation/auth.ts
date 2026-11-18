import { z } from 'zod';

export const credentialsSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email address.').email('Enter a valid email address.').transform((value) => value.toLowerCase()),
  password: z.string().min(1, 'Enter your password.'),
});

export const demoRoleSchema = z.enum(['admin', 'student']);

export type DemoRole = z.infer<typeof demoRoleSchema>;

export type FieldErrors<Field extends string> = Partial<Record<Field, string>>;

/** Collapses Zod issues into the first message per field, ready to render under each input. */
export function fieldErrorsFrom<Field extends string>(error: z.ZodError): FieldErrors<Field> {
  const errors: FieldErrors<Field> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !(field in errors)) errors[field as Field] = issue.message;
  }
  return errors;
}
