"use client";

import { WifiOff } from "lucide-react";
import { useMemo } from "react";
import { useNetworkConstraintReason } from "@/hooks/use-gamification-preference";

type NavigatorWithConnection = Navigator & {
  connection?: {
    saveData?: boolean;
    effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
  };
};

export function ConstrainedNetworkPill() {
  const networkConstraintReason = useNetworkConstraintReason();
  const detail = useMemo(() => {
    if (typeof window === "undefined" || !networkConstraintReason) {
      return "Adaptive network mode";
    }
    if (networkConstraintReason === "save-data") {
      return "Save-Data enabled";
    }
    if (networkConstraintReason === "slow-connection") {
      const connection = (window.navigator as NavigatorWithConnection).connection;
      return connection?.effectiveType ? `Connection ${connection.effectiveType}` : "Slow connection";
    }
    if (networkConstraintReason === "reduced-data-preference") {
      return "Reduced-data preference";
    }
    if (networkConstraintReason === "low-device-memory") {
      return "Low-memory device mode";
    }
    if (networkConstraintReason === "low-cpu-cores") {
      return "Low-CPU device mode";
    }
    if (networkConstraintReason === "slow-display-updates") {
      return "Slow display updates";
    }
    return "Adaptive network mode";
  }, [networkConstraintReason]);

  if (!networkConstraintReason) {
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
