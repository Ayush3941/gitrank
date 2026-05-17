import { AppShell } from "@/components/shared/AppShell";
import { RouteFallbackCard } from "@/components/shared/RouteFallbackCard";

export default function NotFound() {
  return (
    <AppShell className="flex min-h-[70vh] items-center justify-center">
      <RouteFallbackCard
        centered
        eyebrow="404"
        title="Route not found"
        description="This route does not exist in the current GitRank build. Use dashboard navigation or return to the main landing page."
        actions={[
          { label: "Open dashboard", href: "/dashboard", variant: "secondary" },
          { label: "Go home", href: "/", variant: "default" },
        ]}
      />
    </AppShell>
  );
}
