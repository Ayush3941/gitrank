import type { NextConfig } from "next";
import { loadBackendEnvDefaultsForFrontend } from "./lib/runtime/backend-env-loader";

loadBackendEnvDefaultsForFrontend(__dirname);

const cspReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob: https://api.dicebear.com https://avatars.githubusercontent.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "connect-src 'self' https://api.github.com",
].join("; ");

function contentSecurityHeaders() {
  const mode = (process.env.GITRANK_CSP_MODE || "report-only").trim().toLowerCase();
  const headers: Array<{ key: string; value: string }> = [];

  if (mode === "enforce" || mode === "both") {
    headers.push({
      key: "Content-Security-Policy",
      value: cspReportOnly,
    });
  }

  if (mode === "report-only" || mode === "both" || headers.length === 0) {
    headers.push({
      key: "Content-Security-Policy-Report-Only",
      value: cspReportOnly,
    });
  }

  return headers;
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...contentSecurityHeaders(),
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-site",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
