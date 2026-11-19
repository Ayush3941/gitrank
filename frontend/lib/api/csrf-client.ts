import { frontendPolicy } from "@/lib/runtime/frontend-policy";

export function requireCSRFToken(): string {
  if (typeof document === "undefined") {
    throw new Error("CSRF token is only available in the browser.");
  }

  const cookie = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${frontendPolicy.csrfCookieName}=`));
  if (!cookie) {
    throw new Error("CSRF cookie is missing.");
  }

  return decodeURIComponent(cookie.slice(frontendPolicy.csrfCookieName.length + 1));
}
