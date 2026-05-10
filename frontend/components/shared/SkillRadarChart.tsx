"use client";

import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";
import type { SkillNode } from "@/types/gitrank";

export function SkillRadarChart({ skills }: { skills: SkillNode[] }) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={skills}>
          <PolarGrid stroke="rgba(255,255,255,0.12)" />
          <PolarAngleAxis dataKey="category" tick={{ fill: "#d2d7ff", fontSize: 12 }} />
          <Radar
            dataKey="score"
            stroke="#86a3ff"
            fill="rgba(92,126,255,0.32)"
            fillOpacity={1}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
      <p className="sr-only">
        Skill radar chart showing the most evident contribution signals across documentation, testing, backend, and architecture.
      </p>
    </div>
  );
}
