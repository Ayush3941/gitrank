import "server-only";

import {
  copyHeaderIfPresent,
  readOriginWithFallback,
  readSetCookieHeaders,
} from "@/lib/api/server-proxy";

const gatewayBaseURL = readOriginWithFallback(["GITRANK_API_BASE_URL"], "http://localhost:8080");

export async function proxyGateway(request: Request, path: string): Promise<Response> {
  const target = buildGatewayURL(path);
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

  let response: Response;
  try {
    response = await fetch(target, {
      method: request.method,
      headers: outboundHeaders,
      body,
      cache: "no-store",
    });
  } catch {
    return new Response(
      JSON.stringify({
        error: {
          code: "dependency_unavailable",
          message: "API gateway is unavailable. Retry after backend services are running.",
        },
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    );
  }

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

function buildGatewayURL(path: string): string {
  return new URL(path, `${gatewayBaseURL.replace(/\/$/, "")}/`).toString();
}
