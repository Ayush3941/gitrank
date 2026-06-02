import { RouteFallbackCard } from "@/components/shared/RouteFallbackCard";

export default function DashboardNotFound() {
  return (
    <RouteFallbackCard
      centered
      eyebrow="Dashboard route missing"
      title="This dashboard page does not exist"
      description="The requested dashboard route is unavailable. Return to dashboard or inspect contribution evidence."
      actions={[
        { label: "Dashboard", href: "/dashboard", variant: "default" },
        { label: "Contributions", href: "/dashboard/contributions", variant: "secondary" },
      ]}
    />
  );
}
