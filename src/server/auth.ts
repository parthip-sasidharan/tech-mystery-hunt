import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

const TOKEN_COOKIE_NAME = "techhunt_token";

const INSECURE_JWT_PLACEHOLDERS = [
  "fallback-secret-for-dev-only-change-in-prod",
  "your-super-secret-jwt-key-change-in-production",
  "your-jwt-secret-here",
  "change-me",
  "secret",
];

export function getValidatedJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    if (
      !secret ||
      INSECURE_JWT_PLACEHOLDERS.includes(secret.trim().toLowerCase()) ||
      secret.trim().length < 32
    ) {
      throw new Error(
        "FATAL SECURITY MISCONFIGURATION: In production mode (NODE_ENV=production), JWT_SECRET must be set to a cryptographically strong, unpredictable secret with at least 32 characters. Placeholder and default secrets are strictly prohibited."
      );
    }
  }

  return secret || "fallback-secret-for-dev-only-change-in-prod";
}

export interface TokenPayload {
  sub: string; // User or Team id
  role: "ADMIN" | "VOLUNTEER" | "TEAM";
  usernameOrTeamId: string;
  name: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: TokenPayload): string {
  const secret = getValidatedJwtSecret();
  return jwt.sign(payload, secret, { expiresIn: "12h" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const secret = getValidatedJwtSecret();
    return jwt.verify(token, secret) as TokenPayload;
  } catch {
    return null;
  }
}

export function getSessionFromCookies(): TokenPayload | null {
  const cookieStore = cookies();
  const token = cookieStore.get(TOKEN_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function createAuthCookie(token: string) {
  return {
    name: TOKEN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE === "true",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 12, // 12 hours
  };
}

export function clearAuthCookie() {
  return {
    name: TOKEN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE === "true",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}
