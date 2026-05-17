import { RouteFallbackCard } from "@/components/shared/RouteFallbackCard";

export default function PublicProfileNotFound() {
  return (
    <RouteFallbackCard
      eyebrow="Public profile not found"
      title="This contributor profile is unavailable"
      description="The requested profile path does not exist in the current GitRank snapshot. Try the dashboard profile view or return to the main landing route."
      actions={[
        { label: "Open dashboard", href: "/dashboard", variant: "secondary" },
        { label: "Browse contributions", href: "/dashboard/contributions", variant: "secondary" },
        { label: "Go home", href: "/", variant: "default" },
      ]}
    />
  );
}
