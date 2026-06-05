import "server-only";

import {
  copyHeaderIfPresent,
  readOriginWithFallback,
  readSetCookieHeaders,
} from "@/lib/api/server-proxy";

const authBaseURL = readOriginWithFallback(
  ["GITRANK_AUTH_BASE_URL", "AUTH_SERVICE_BASE_URL"],
  "http://localhost:8081",
);

export async function proxyAuth(request: Request, path: string): Promise<Response> {
  const target = new URL(path, `${authBaseURL.replace(/\/$/, "")}/`);
  const outboundHeaders = new Headers();

  copyHeaderIfPresent(outboundHeaders, "Accept", request.headers.get("accept"));
  copyHeaderIfPresent(outboundHeaders, "Content-Type", request.headers.get("content-type"));
  copyHeaderIfPresent(outboundHeaders, "Cookie", request.headers.get("cookie"));
  copyHeaderIfPresent(outboundHeaders, "X-CSRF-Token", request.headers.get("x-csrf-token"));
  copyHeaderIfPresent(outboundHeaders, "X-Request-ID", request.headers.get("x-request-id"));
  copyHeaderIfPresent(outboundHeaders, "User-Agent", request.headers.get("user-agent"));

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.text();

  const response = await fetch(target.toString(), {
    method: request.method,
    headers: outboundHeaders,
    body,
    cache: "no-store",
    redirect: "manual",
  });

  const payload = await response.text();
  const headers = new Headers();
  copyHeaderIfPresent(headers, "Content-Type", response.headers.get("content-type"));
  copyHeaderIfPresent(headers, "Cache-Control", response.headers.get("cache-control"));
  copyHeaderIfPresent(headers, "Retry-After", response.headers.get("retry-after"));
  copyHeaderIfPresent(headers, "X-Request-ID", response.headers.get("x-request-id"));
  for (const value of readSetCookieHeaders(response.headers)) {
    headers.append("Set-Cookie", value);
  }

  return new Response(payload, {
    status: response.status,
    headers,
  });
}
