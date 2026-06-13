import { RouteFallbackCard } from "@/components/shared/RouteFallbackCard";

export default function PublicProfileNotFound() {
  return (
    <RouteFallbackCard
      centered
      eyebrow="Public profile not found"
      title="This contributor profile is unavailable"
      description="This public profile is hidden, missing, or has not published scored PR evidence yet. Open the leaderboard or return to landing."
      actions={[
        { label: "Open leaderboard", href: "/dashboard/leaderboard", variant: "default" },
        { label: "Open landing", href: "/", variant: "secondary" },
      ]}
    />
  );
}
