/**
 * src/server/middleware/auth.ts
 *
 * Centralized authentication & authorization helpers.
 *
 * Pattern: call requireAuth() or requireRole() at the top of every API handler.
 * They return { session, error } — if error is set, return it directly.
 *
 * Usage:
 *   const { session, error } = requireAuth(req);
 *   if (error) return error;
 *
 *   const { session, error } = requireRole(req, ["ADMIN"]);
 *   if (error) return error;
 */

import { NextResponse, type NextRequest } from "next/server";
import { cookies, headers } from "next/headers";
import { verifyToken, type TokenPayload } from "@/server/auth";

export type Role = "ADMIN" | "VOLUNTEER" | "TEAM";

export interface AuthResult {
  session: TokenPayload | null;
  error: NextResponse | null;
}

// ── Token extraction: checks Authorization: Bearer <token> first, then cookies ─
function extractToken(): string | null {
  try {
    const headerStore = headers();
    const authHeader = headerStore.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const bearerToken = authHeader.substring(7).trim();
      if (bearerToken) return bearerToken;
    }
  } catch {
    // fallback
  }

  try {
    const cookieStore = cookies();
    const cookieToken = cookieStore.get("techhunt_token")?.value;
    if (cookieToken) return cookieToken;
  } catch {
    // fallback
  }

  return null;
}

// ── Core guard: any authenticated principal ────────────────────────────────────
export function requireAuth(): AuthResult {
  const token = extractToken();

  if (!token) {
    return {
      session: null,
      error: NextResponse.json(
        { error: "Authentication required. Please sign in." },
        { status: 401 }
      ),
    };
  }

  const session = verifyToken(token);
  if (!session) {
    return {
      session: null,
      error: NextResponse.json(
        { error: "Session expired or invalid. Please sign in again." },
        { status: 401 }
      ),
    };
  }

  return { session, error: null };
}

// ── Role guard: one or more permitted roles ────────────────────────────────────
export function requireRole(roles: Role[]): AuthResult {
  const { session, error } = requireAuth();
  if (error) return { session: null, error };

  if (!roles.includes(session!.role as Role)) {
    return {
      session: null,
      error: NextResponse.json(
        { error: "Access denied. You do not have permission to perform this action." },
        { status: 403 }
      ),
    };
  }

  return { session, error: null };
}

// ── Team isolation guard ───────────────────────────────────────────────────────
// Verifies that the authenticated team is accessing ONLY its own data.
// Pass the teamId from the URL / body; the function checks it against the JWT.
export function requireTeamSelf(requestedTeamId: string): AuthResult {
  const { session, error } = requireRole(["TEAM"]);
  if (error) return { session: null, error };

  if (session!.sub !== requestedTeamId) {
    return {
      session: null,
      error: NextResponse.json(
        { error: "Access denied. You may only access your own team data." },
        { status: 403 }
      ),
    };
  }

  return { session, error: null };
}

// ── Volunteer scope guard ──────────────────────────────────────────────────────
// Volunteers may access volunteer-or-admin routes. Admins can always substitute.
export function requireVolunteerOrAdmin(): AuthResult {
  return requireRole(["ADMIN", "VOLUNTEER"]);
}

// ── Admin-only guard ───────────────────────────────────────────────────────────
export function requireAdmin(): AuthResult {
  return requireRole(["ADMIN"]);
}
