type AnalyticsEventName =
  | "onboarding.started"
  | "onboarding.completed"
  | "onboarding.sync.started"
  | "sync.succeeded"
  | "sync.failed"
  | "score_explanation.opened"
  | "badge.viewed"
  | "profile.shared"
  | "empty_state.viewed"
  | "error_state.viewed"
  | "stale_state.viewed"
  | "web_vital.sample";

type AnalyticsEventInput = {
  eventName: AnalyticsEventName;
  source?: string;
  target?: string;
  status?: "success" | "failure";
  metricName?: "CLS" | "FCP" | "LCP" | "INP" | "TTFB" | "FID";
  metricValue?: number;
  metricRating?: "good" | "needs-improvement" | "poor" | "unknown";
  routeGroup?: string;
};

export async function emitAnalyticsEvent(input: AnalyticsEventInput): Promise<void> {
  const controller = new AbortController();
  const timeoutID = globalThis.setTimeout(() => controller.abort(), 1500);
  void fetch("/api/analytics/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    cache: "no-store",
    keepalive: true,
    signal: controller.signal,
    body: JSON.stringify({
      event_name: input.eventName,
      source: input.source,
      target: input.target,
      status: input.status,
      metric_name: input.metricName,
      metric_value: input.metricValue,
      metric_rating: input.metricRating,
      route_group: input.routeGroup,
    }),
  })
    .catch(() => {
      // Analytics should never block user-facing flows.
    })
    .finally(() => {
      globalThis.clearTimeout(timeoutID);
    });
}
