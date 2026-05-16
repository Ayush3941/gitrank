import type { Metadata } from "next";
import { SettingsPageClient } from "@/features/settings/components/SettingsPageClient";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage profile visibility, repository privacy, account controls, and data-export actions.",
};

export default function SettingsPage() {
  return <SettingsPageClient />;
}
