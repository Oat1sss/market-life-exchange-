import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "@/components/auth-forms";
import { maybeUserId } from "@/server/session";

// Reads the session on every request; keep it a blocking route (allowed by
// authentication-with-cache-components guidance for auth pages).
export const instant = false;

export default async function RegisterPage() {
  if (await maybeUserId()) redirect("/play/new");
  return (
    <AuthShell
      eyebrow="Buka akun"
      title="Mulai simulasi trading"
      subtitle="Satu akun untuk pasar spot, futures, dompet demo, dan akademi."
      footer={
        <>
          Sudah punya akun?{" "}
          <Link
            href="/login"
            className="font-bold text-brand underline-offset-4 hover:underline"
          >
            Masuk
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
