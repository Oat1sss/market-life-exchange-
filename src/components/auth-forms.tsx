/**
 * Client auth forms. Display-only concern: they render one email and one
 * password field, submit to already-validated server actions, and surface
 * field errors or a message returned by those actions.
 */
"use client";

import { useActionState } from "react";
import { loginAction, registerAction } from "@/app/actions/auth";
import type { AuthFormState } from "@/lib/validation/auth";

const initial: AuthFormState = {};

function Field({
  id,
  label,
  type,
  autoComplete,
  errors,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  errors?: string[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required
        className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
      />
      {errors?.map((error) => (
        <p key={error} className="text-xs text-red-700">
          {error}
        </p>
      ))}
    </div>
  );
}

function Submit({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded bg-amber-700 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
    >
      {pending ? "Working…" : label}
    </button>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        errors={state.errors?.email}
      />
      <Field
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        errors={state.errors?.password}
      />
      {state.message && <p className="text-sm text-red-700">{state.message}</p>}
      <Submit pending={pending} label="Create account" />
    </form>
  );
}

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        errors={state.errors?.email}
      />
      <Field
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        errors={state.errors?.password}
      />
      {state.message && <p className="text-sm text-red-700">{state.message}</p>}
      <Submit pending={pending} label="Log in" />
    </form>
  );
}
