/**
 * Shared Zod schemas at the authentication boundary. The same schema validates
 * client form submissions and every server-side parse route/action, so the
 * client cannot send a shape the server would reject differently.
 */
import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .pipe(z.email({ error: "Enter a valid email address." }))
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, { error: "Be at least 8 characters long." })
  .max(200, { error: "Be at most 200 characters long." })
  .regex(/[a-zA-Z]/, { error: "Contain at least one letter." })
  .regex(/[0-9]/, { error: "Contain at least one number." });

export const LoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: "Enter your password." }),
});

export const RegisterSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const LoginCredentialsSchema = RegisterSchema.pick({ email: true });

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;

/** Flat field errors + message, safe to pass to client forms. */
export interface AuthFormState {
  errors?: { email?: string[]; password?: string[] };
  message?: string;
}
