import { RouteFallbackCard } from "@/components/shared/RouteFallbackCard";

export default function DashboardNotFound() {
  return (
    <RouteFallbackCard
      eyebrow="Dashboard route missing"
      title="This dashboard page does not exist"
      description="The requested dashboard route is unavailable in this build. Use the core dashboard routes below."
      actions={[
        { label: "Dashboard", href: "/dashboard", variant: "secondary" },
        { label: "Contributions", href: "/dashboard/contributions", variant: "secondary" },
        { label: "Settings", href: "/dashboard/settings", variant: "secondary" },
      ]}
    />
  );
}
