/**
 * Route handlers exposing Auth.js v5 over /api/auth/*.
 * Control is delegated entirely to the shared handlers in src/server/auth.ts.
 */
import { handlers } from "@/server/auth";

export const { GET, POST } = handlers;
