import { RouteFallbackCard } from "@/components/shared/RouteFallbackCard";

export default function PublicProfileNotFound() {
  return (
    <RouteFallbackCard
      centered
      eyebrow="Public profile not found"
      title="This contributor profile is unavailable"
      description="The requested profile path is unavailable. Open dashboard profile lanes or return to landing."
      actions={[
        { label: "Open dashboard", href: "/dashboard", variant: "secondary" },
        { label: "Browse contributions", href: "/dashboard/contributions", variant: "secondary" },
        { label: "Open landing", href: "/", variant: "default" },
      ]}
    />
  );
}
