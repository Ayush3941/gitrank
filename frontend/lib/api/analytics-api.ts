type AnalyticsEventName =
  | "onboarding.completed"
  | "sync.succeeded"
  | "sync.failed"
  | "score_explanation.opened"
  | "badge.viewed";

type AnalyticsEventInput = {
  eventName: AnalyticsEventName;
  source?: string;
  target?: string;
  status?: "success" | "failure";
};

export async function emitAnalyticsEvent(input: AnalyticsEventInput): Promise<void> {
  try {
    await fetch("/api/analytics/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({
        event_name: input.eventName,
        source: input.source,
        target: input.target,
        status: input.status,
      }),
    });
  } catch {
    // Analytics should never block user-facing flows.
  }
}
