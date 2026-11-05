/**
 * Auth.js v5 configuration — the server's single authentication authority.
 *
 * Session strategy is JWT (stateless): the cookie carries only a signed, opaque
 * token; user existence is re-checked server-side where gameplay reads happen.
 * A credentials provider verifies an Argon2id hash against the `users` table.
 */
import NextAuth, { type User } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { LoginSchema } from "@/lib/validation/auth";
import { DUMMY_HASH, verifyPassword } from "@/server/password";
import { prisma } from "@/server/db";

interface AuthorizedArgs {
  email: string;
  password: string;
}

export async function verifyCredentials({
  email,
  password,
}: AuthorizedArgs): Promise<User | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await verifyPassword(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) return null;
  return { id: user.id, email: user.email, name: user.displayName };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: (credentials) => {
        const parsed = LoginSchema.parse(credentials ?? {});
        return verifyCredentials(parsed);
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
