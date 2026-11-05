import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth-forms";
import { maybeUserId } from "@/server/session";

// Reads the session on every request; keep it a blocking route (allowed by
// authentication-with-cache-components guidance for auth pages).
export const instant = false;

export default async function RegisterPage() {
  if (await maybeUserId()) redirect("/play/new");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-semibold">Create account</h1>
      <p className="mb-6 text-sm text-neutral-600">
        One lifetime. Thirty-ish choices a year, one decision at a time.
      </p>
      <RegisterForm />
      <p className="mt-6 text-sm text-neutral-600">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
