"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function TimelineChart({ data }: { data: Array<{ label: string; xp: number }> }) {
  return (
    <div className="neon-tile relative h-72 w-full overflow-hidden rounded-[1.75rem] p-3">
      <div className="pointer-events-none absolute -left-10 top-14 h-24 w-24 rounded-full bg-cyan-400/14 blur-3xl" />
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="xpGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22e2ff" stopOpacity={0.46} />
              <stop offset="55%" stopColor="#9b5dff" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#9b5dff" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(34,226,255,0.12)" vertical={false} />
          <XAxis dataKey="label" stroke="#9aa9e2" tickLine={false} axisLine={false} />
          <YAxis stroke="#9aa9e2" tickLine={false} axisLine={false} width={42} />
          <Tooltip
            contentStyle={{
              background: "rgba(11,16,32,0.95)",
              border: "1px solid rgba(34,226,255,0.28)",
              borderRadius: "16px",
            }}
          />
          <Area type="monotone" dataKey="xp" stroke="#22e2ff" strokeWidth={2.4} fill="url(#xpGradient)" />
        </AreaChart>
      </ResponsiveContainer>
      <p className="sr-only">Contribution quality timeline showing cumulative XP growth over time.</p>
    </div>
  );
}
