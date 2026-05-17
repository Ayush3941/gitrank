"use client";

import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";
import type { SkillNode } from "@/types/gitrank";

export function SkillRadarChartInner({ skills }: { skills: SkillNode[] }) {
  return (
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
  );
}
