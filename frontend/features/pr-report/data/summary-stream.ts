import { requireCSRFToken } from "@/lib/api/csrf-client";

export async function generatePRSummary(
  owner: string,
  repo: string,
  number: number,
  signal: AbortSignal,
  onText: (text: string) => void,
): Promise<void> {
  let csrfToken: string;
  try {
    csrfToken = requireCSRFToken();
  } catch {
    throw new Error("Sign in to generate an AI summary.");
  }
  const response = await fetch(
    `/api/pr/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${number}/summary`,
    {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: "{}",
      signal,
    },
  );
  if (response.status === 401) throw new Error("Sign in to generate an AI summary.");
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message || "An AI summary could not be generated. Please try again.");
  }
  if (!response.body || !response.headers.get("content-type")?.startsWith("text/event-stream")) {
    throw new Error("The AI provider did not return a summary stream.");
  }
  await readSummaryStream(response.body, onText);
}

export async function readSummaryStream(
  stream: ReadableStream<Uint8Array>,
  onText: (text: string) => void,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let text = "";
  let completed = false;
  let truncated = false;
  try {
    while (!completed) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      pending = pending.replaceAll("\r\n", "\n");
      let boundary: number;
      while ((boundary = pending.indexOf("\n\n")) >= 0) {
        const frame = pending.slice(0, boundary);
        pending = pending.slice(boundary + 2);
        const data = frame.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
        if (!data) continue;
        if (data.trim() === "[DONE]") { completed = true; break; }
        const event = JSON.parse(data) as {
          error?: unknown;
          choices?: { delta?: { content?: string }; finish_reason?: string | null }[];
        };
        if (event.error) throw new Error("The AI provider interrupted this summary. Please generate it again.");
        const choice = event.choices?.[0];
        if (choice?.finish_reason === "length") truncated = true;
        if (choice?.finish_reason === "content_filter") throw new Error("The AI provider could not finish this summary.");
        if (typeof choice?.delta?.content === "string") {
          text += choice.delta.content;
          if (text.length > 40_000) throw new Error("The explanation exceeded its output limit.");
          onText(text);
        }
      }
      if (done) break;
    }
    if (!completed || !text.trim()) throw new Error("The summary ended before it was complete. Please generate it again.");
    if (truncated) throw new Error("The explanation reached its length limit. You can generate a new version.");
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
