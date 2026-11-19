"use client";

import { useEffect, useRef, useState } from "react";
import { generatePRSummary } from "@/features/pr-report/data/summary-stream";

export function usePRSummary(owner: string, repo: string, number: number) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "generating" | "complete" | "stopped" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);

  useEffect(() => () => active.current?.abort(), []);

  async function generate() {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setText("");
    setError(null);
    setStatus("generating");
    try {
      await generatePRSummary(owner, repo, number, controller.signal, setText);
      if (!controller.signal.aborted) setStatus("complete");
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(failure instanceof SyntaxError
          ? "The AI response could not be read. Please generate it again."
          : failure instanceof Error ? failure.message : "An AI summary could not be generated.");
        setStatus("error");
      }
    } finally {
      if (active.current === controller) active.current = null;
    }
  }

  function stop() {
    active.current?.abort();
    setStatus("stopped");
  }

  return { text, status, error, generate, stop };
}
