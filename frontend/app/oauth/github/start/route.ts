import { proxyAuth } from "@/lib/api/auth-server";
import { readSetCookieHeaders } from "@/lib/api/server-proxy";

export const dynamic = "force-dynamic";

type AuthStartResponse = {
  authorize_url?: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = sanitizeReturnTo(url.searchParams.get("return_to"));
  const upstream = await proxyAuth(
    request,
    `/oauth/github/start?response_mode=json&return_to=${encodeURIComponent(returnTo)}`,
  );

  if (!upstream.ok) {
    return upstream;
  }

  let payload: AuthStartResponse;
  try {
    payload = (await upstream.json()) as AuthStartResponse;
  } catch {
    return new Response(
      JSON.stringify({
        error: {
          code: "invalid_auth_start_response",
          message: "Auth start response was not valid JSON.",
        },
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const authorizeURL = payload.authorize_url?.trim();
  if (!authorizeURL) {
    return new Response(
      JSON.stringify({
        error: {
          code: "missing_authorize_url",
          message: "Auth start response did not include authorize_url.",
        },
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const headers = new Headers();
  headers.set("Location", authorizeURL);
  for (const value of readSetCookieHeaders(upstream.headers)) {
    headers.append("Set-Cookie", value);
  }
  return new Response(null, { status: 302, headers });
}

function sanitizeReturnTo(value: string | null): string {
  if (!value || value.trim() === "") {
    return "/dashboard";
  }
  if (!value.startsWith("/")) {
    return "/dashboard";
  }
  return value;
}
