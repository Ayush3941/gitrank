import type { AccountDataExport } from "@/lib/api/account-api";

export function buildAccountExportFilename(
  payload: AccountDataExport,
  preferredHandle?: string,
): string {
  const generatedAt = new Date(payload.generated_at);
  const exportDate = Number.isNaN(generatedAt.getTime())
    ? new Date().toISOString().slice(0, 10)
    : generatedAt.toISOString().slice(0, 10);
  const handle = preferredHandle || payload.user.public_handle || "account";
  return `gitrank-account-export-${sanitizeExportHandle(handle)}-${exportDate}.json`;
}

export function downloadJSON(payload: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function sanitizeExportHandle(value: string): string {
  const safeHandle = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return safeHandle || "account";
}
