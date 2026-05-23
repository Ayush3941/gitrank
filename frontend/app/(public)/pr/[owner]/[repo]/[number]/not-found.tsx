import { RouteFallbackCard } from "@/components/shared/RouteFallbackCard";

export default function PublicPRReportNotFound() {
  return (
    <RouteFallbackCard
      centered
      eyebrow="PR report not found"
      title="This battle report route is unavailable"
      description="The requested pull-request report path is unavailable. Open contribution lanes or return to dashboard."
      actions={[
        { label: "Open contributions", href: "/dashboard/contributions", variant: "secondary" },
        { label: "Open dashboard", href: "/dashboard", variant: "secondary" },
        { label: "Open landing", href: "/", variant: "default" },
      ]}
    />
  );
}
