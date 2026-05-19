"use client";

import { WifiOff } from "lucide-react";
import { useMemo } from "react";
import { useNetworkConstraintPreference } from "@/hooks/use-gamification-preference";

type NavigatorWithConnection = Navigator & {
  connection?: {
    saveData?: boolean;
    effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
  };
};

const REDUCED_DATA_QUERY = "(prefers-reduced-data: reduce)";

export function ConstrainedNetworkPill() {
  const constrainedNetwork = useNetworkConstraintPreference();
  const detail = useMemo(() => {
    if (!constrainedNetwork || typeof window === "undefined") {
      return "Adaptive network mode";
    }
    const connection = (window.navigator as NavigatorWithConnection).connection;
    if (connection?.saveData) {
      return "Save-Data enabled";
    }
    if (connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g") {
      return `Connection ${connection.effectiveType}`;
    }
    if (window.matchMedia(REDUCED_DATA_QUERY).matches) {
      return "Reduced-data preference";
    }
    return "Adaptive network mode";
  }, [constrainedNetwork]);

  if (!constrainedNetwork) {
    return null;
  }

  return (
    <span
      className="neon-chip neon-chip-warning inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
      title="Constrained network mode is active. GitRank reduces prefetch and polling to save bandwidth."
    >
      <WifiOff className="h-3.5 w-3.5" />
      <span>{detail}</span>
    </span>
  );
}
