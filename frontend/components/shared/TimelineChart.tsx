"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function TimelineChart({ data }: { data: Array<{ label: string; xp: number }> }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="xpGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5c7eff" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#5c7eff" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="label" stroke="#99a3d4" tickLine={false} axisLine={false} />
          <YAxis stroke="#99a3d4" tickLine={false} axisLine={false} width={42} />
          <Tooltip
            contentStyle={{
              background: "rgba(11,16,32,0.95)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "16px",
            }}
          />
          <Area type="monotone" dataKey="xp" stroke="#86a3ff" strokeWidth={2} fill="url(#xpGradient)" />
        </AreaChart>
      </ResponsiveContainer>
      <p className="sr-only">Contribution quality timeline showing cumulative XP growth over time.</p>
    </div>
  );
}
