/**
 * Authentication server actions ("use server"): register and log in.
 * Validation, hashing, and session creation happen only on the server; forms
 * receive already-shaped field errors, never raw exceptions.
 */
"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/server/auth";
import {
  LoginSchema,
  RegisterSchema,
  type AuthFormState,
} from "@/lib/validation/auth";
import { registerUser } from "@/server/services/user-service";

const REDIRECT_AFTER_LOGIN = "/play/new";

export async function registerAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = RegisterSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as AuthFormState["errors"],
    };
  }

  const result = await registerUser(parsed.data);
  if (!result.ok) {
    return {
      errors: { email: ["This email may already be registered."] },
    };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: REDIRECT_AFTER_LOGIN,
    });
  } catch (error) {
    // Auth.js signals "redirect" by throwing; let redirects bubble up but show
    // real failures (wrong password in a race, etc.) as a form message.
    if (error instanceof AuthError) {
      return { message: "Registration succeeded, but sign-in failed. Try logging in." };
    }
    throw error;
  }

  return { message: "Signed in." };
}

export async function loginAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as AuthFormState["errors"],
    };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: REDIRECT_AFTER_LOGIN,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { message: "Email or password is incorrect." };
    }
    throw error;
  }

  return { message: "Signed in." };
}
