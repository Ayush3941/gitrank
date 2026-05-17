"use client";

import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";
import type { SkillNode } from "@/types/gitrank";

export function SkillRadarChartInner({ skills }: { skills: SkillNode[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={skills}>
        <PolarGrid stroke="rgb(var(--primary) / 0.18)" />
        <PolarAngleAxis
          dataKey="category"
          tick={{ fill: "rgb(var(--text-body))", fontSize: 12.5, fontWeight: 500 }}
        />
        <Radar
          dataKey="score"
          stroke="rgb(var(--primary))"
          fill="rgb(var(--primary) / 0.26)"
          fillOpacity={1}
          strokeWidth={2.4}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
