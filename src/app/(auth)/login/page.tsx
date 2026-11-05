import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { maybeUserId } from "@/server/session";

// Reads the session on every request; keep it a blocking route (allowed by
// authentication-with-cache-components guidance for auth pages).
export const instant = false;

export default async function LoginPage() {
  if (await maybeUserId()) redirect("/play/new");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-semibold">Log in</h1>
      <p className="mb-6 text-sm text-neutral-600">
        Welcome back. Your saved life is waiting.
      </p>
      <LoginForm />
      <p className="mt-6 text-sm text-neutral-600">
        No account yet?{" "}
        <Link href="/register" className="underline">
          Create one
        </Link>
      </p>
    </main>
  );
}
