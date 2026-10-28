import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/server/auth";

export async function POST() {
  const response = NextResponse.json({ success: true, message: "Logged out successfully" });
  const cookie = clearAuthCookie();
  response.cookies.set(cookie.name, cookie.value, {
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
    path: cookie.path,
    maxAge: 0,
  });
  return response;
}
