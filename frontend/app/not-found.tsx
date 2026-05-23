import { AppShell } from "@/components/shared/AppShell";
import { RouteFallbackCard } from "@/components/shared/RouteFallbackCard";

export default function NotFound() {
  return (
    <AppShell className="flex min-h-[70vh] items-center justify-center">
      <RouteFallbackCard
        centered
        eyebrow="404"
        title="Route not found"
        description="This route is unavailable. Open dashboard lanes or return to landing."
        actions={[
          { label: "Open dashboard", href: "/dashboard", variant: "secondary" },
          { label: "Open landing", href: "/", variant: "default" },
        ]}
      />
    </AppShell>
  );
}
