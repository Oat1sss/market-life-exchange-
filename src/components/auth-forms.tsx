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
  hint,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  errors?: string[];
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-muted"
      >
        <span>{label}</span>
        {hint ? <span className="font-semibold normal-case tracking-normal text-[#5e6673]">{hint}</span> : null}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required
        className="h-11 rounded-lg border border-line bg-elevated px-3 text-sm text-white outline-none transition placeholder:text-[#5e6673] focus:border-brand/60 focus:ring-2 focus:ring-brand/10"
      />
      {errors?.map((error) => (
        <p key={error} className="text-[11px] text-down">
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
      className="h-11 w-full rounded-lg bg-brand px-3 text-sm font-black text-[#04120e] transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Memproses…" : label}
    </button>
  );
}

function Message({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="rounded-lg border border-down/30 bg-down/10 p-2.5 text-[11px] leading-5 text-down">
      {message}
    </p>
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
        hint="Minimal 8 karakter"
      />
      <Message message={state.message} />
      <Submit pending={pending} label="Buat akun demo" />
      <p className="text-center text-[10px] leading-4 text-[#5e6673]">
        Dengan mendaftar, kamu memahami bahwa seluruh saldo dan transaksi adalah
        simulasi.
      </p>
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
      <Message message={state.message} />
      <Submit pending={pending} label="Masuk ke terminal" />
    </form>
  );
}
