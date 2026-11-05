/**
 * Session helpers — the only way application code reads the current user.
 * Every gameplay/scoped query derives ownership from the session, never from
 * request bodies (see docs/ARCHITECTURE.md §Ownership checks).
 */
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";

/** Current user id, guaranteed verified. Redirects to /login when absent. */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  return userId;
}

/** Optional variant: null instead of a redirect (menus, login/logout buttons). */
export async function maybeUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
