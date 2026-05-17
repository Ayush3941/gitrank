import { RouteFallbackCard } from "@/components/shared/RouteFallbackCard";

export default function PublicPRReportNotFound() {
  return (
    <RouteFallbackCard
      eyebrow="PR report not found"
      title="This battle report route is unavailable"
      description="The requested pull-request report path does not exist in the current GitRank build. Open contribution drill-down or return to dashboard overview."
      actions={[
        { label: "Open contributions", href: "/dashboard/contributions", variant: "secondary" },
        { label: "Open dashboard", href: "/dashboard", variant: "secondary" },
        { label: "Go home", href: "/", variant: "default" },
      ]}
    />
  );
}
