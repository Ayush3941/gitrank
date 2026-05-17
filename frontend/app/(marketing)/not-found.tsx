import { RouteFallbackCard } from "@/components/shared/RouteFallbackCard";

export default function MarketingRouteNotFound() {
  return (
    <RouteFallbackCard
      eyebrow="Marketing route not found"
      title="This public route does not exist"
      description="Use the primary onboarding path or open login directly to continue with GitHub OAuth."
      actions={[
        { label: "Go home", href: "/", variant: "secondary" },
        { label: "Open login", href: "/login", variant: "secondary" },
        { label: "Start onboarding", href: "/onboarding/connect-github", variant: "default" },
      ]}
    />
  );
}
