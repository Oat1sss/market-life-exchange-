import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/auth-forms";
import { maybeUserId } from "@/server/session";

// Reads the session on every request; keep it a blocking route (allowed by
// authentication-with-cache-components guidance for auth pages).
export const instant = false;

export default async function LoginPage() {
  if (await maybeUserId()) redirect("/play/new");
  return (
    <AuthShell
      eyebrow="Akun demo"
      title="Masuk ke terminal"
      subtitle="Lanjutkan portofolio, posisi futures, dan simulasi kehidupanmu."
      footer={
        <>
          Belum punya akun?{" "}
          <Link
            href="/register"
            className="font-bold text-brand underline-offset-4 hover:underline"
          >
            Daftar sekarang
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
