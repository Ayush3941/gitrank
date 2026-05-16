import { proxyAuth } from "@/lib/api/auth-server";

export const dynamic = "force-dynamic";

type OAuthCompletionResponse = {
  redirect_url?: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = new URLSearchParams(url.searchParams);
  params.set("response_mode", "json");

  const upstream = await proxyAuth(request, `/oauth/github/callback?${params.toString()}`);
  if (!upstream.ok) {
    return upstream;
  }

  let payload: OAuthCompletionResponse;
  try {
    payload = (await upstream.json()) as OAuthCompletionResponse;
  } catch {
    return new Response(
      JSON.stringify({
        error: {
          code: "invalid_oauth_callback_response",
          message: "OAuth callback response was not valid JSON.",
        },
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const redirectURL = payload.redirect_url?.trim() || "/dashboard";

  const headers = new Headers();
  headers.set("Location", redirectURL);
  for (const value of readSetCookieHeaders(upstream.headers)) {
    headers.append("Set-Cookie", value);
  }
  return new Response(null, { status: 302, headers });
}

function readSetCookieHeaders(headers: Headers): string[] {
  const cookieHeaders = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof cookieHeaders.getSetCookie === "function") {
    return cookieHeaders.getSetCookie();
  }

  const fallback = headers.get("set-cookie");
  return fallback ? [fallback] : [];
}
