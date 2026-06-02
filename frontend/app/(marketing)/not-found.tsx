import { RouteFallbackCard } from "@/components/shared/RouteFallbackCard";

export default function MarketingRouteNotFound() {
  return (
    <RouteFallbackCard
      centered
      eyebrow="Marketing route not found"
      title="This public route does not exist"
      description="Return home or use the primary onboarding path to continue with GitHub."
      actions={[
        { label: "Go home", href: "/", variant: "secondary" },
        { label: "Start onboarding", href: "/onboarding/connect-github", variant: "default" },
      ]}
    />
  );
}
