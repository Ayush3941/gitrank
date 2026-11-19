import { describe, expect, it } from "vitest";
import { readSummaryStream } from "@/features/pr-report/data/summary-stream";

function bytes(text: string, size = 7) {
  const encoded = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({ start(controller) { for (let i = 0; i < encoded.length; i += size) controller.enqueue(encoded.slice(i, i + size)); controller.close(); } });
}
const delta = (text: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\r\n\r\n`;

describe("PR summary event stream", () => {
  it("preserves long explanations, paragraphs, and split UTF-8 characters", async () => {
    const text = "A useful explanation ☀.\n\n".repeat(40);
    let rendered = "";
    await readSummaryStream(bytes(delta(text) + "data: [DONE]\r\n\r\n"), (value) => { rendered = value; });
    expect(rendered).toBe(text);
    expect(rendered.length).toBeGreaterThan(320);
  });
  it("does not call a disconnected response complete", async () => {
    await expect(readSummaryStream(bytes(delta("Partial explanation")), () => {})).rejects.toThrow("before it was complete");
  });
  it("does not accept an empty completed stream", async () => {
    await expect(readSummaryStream(bytes("data: [DONE]\n\n"), () => {})).rejects.toThrow("before it was complete");
  });
  it("surfaces a provider error without exposing its diagnostic body", async () => {
    await expect(readSummaryStream(bytes('data: {"error":{"message":"private diagnostic"}}\n\n'), () => {})).rejects.toThrow("provider interrupted");
  });
});
