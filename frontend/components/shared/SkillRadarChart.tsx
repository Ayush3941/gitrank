"use client";

import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";
import type { SkillNode } from "@/types/gitrank";

export function SkillRadarChart({ skills }: { skills: SkillNode[] }) {
  return (
    <div className="neon-tile relative h-80 w-full overflow-hidden rounded-[1.75rem] p-3">
      <div className="pointer-events-none absolute -top-12 right-8 h-28 w-28 rounded-full bg-fuchsia-400/16 blur-3xl" />
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={skills}>
          <PolarGrid stroke="rgba(34,226,255,0.18)" />
          <PolarAngleAxis dataKey="category" tick={{ fill: "#d8deff", fontSize: 12 }} />
          <Radar
            dataKey="score"
            stroke="#22e2ff"
            fill="rgba(34,226,255,0.28)"
            fillOpacity={1}
            strokeWidth={2.4}
          />
        </RadarChart>
      </ResponsiveContainer>
      <p className="sr-only">
        Skill radar chart showing the most evident contribution signals across documentation, testing, backend, and architecture.
      </p>
    </div>
  );
}
