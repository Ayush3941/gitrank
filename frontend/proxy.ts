import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const sessionCookieName =
  process.env.AUTH_SESSION_COOKIE_NAME?.trim() || "gitrank_session";

export function proxy(request: NextRequest) {
  if (request.cookies.get(sessionCookieName)) {
    return NextResponse.next();
  }

  const loginURL = new URL("/login", request.url);
  loginURL.searchParams.set(
    "return_to",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return NextResponse.redirect(loginURL);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding/reveal",
    "/onboarding/analyzing",
  ],
};
