import { RouteFallbackCard } from "@/components/shared/RouteFallbackCard";

export default function PublicPRReportNotFound() {
  return (
    <RouteFallbackCard
      centered
      eyebrow="PR report not found"
      title="This battle report route is unavailable"
      description="This battle report may be private, still syncing, or not published yet. Open the leaderboard or return to landing."
      actions={[
        { label: "Open leaderboard", href: "/dashboard/leaderboard", variant: "default" },
        { label: "Open landing", href: "/", variant: "secondary" },
      ]}
    />
  );
}
