"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function TimelineChartInner({ data }: { data: Array<{ label: string; xp: number }> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="xpGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--primary))" stopOpacity={0.46} />
            <stop offset="55%" stopColor="rgb(var(--primary-2))" stopOpacity={0.2} />
            <stop offset="100%" stopColor="rgb(var(--primary-2))" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgb(var(--primary) / 0.12)" vertical={false} />
        <XAxis
          dataKey="label"
          stroke="rgb(var(--text-soft))"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "rgb(var(--text-soft))", fontSize: 12, fontWeight: 500 }}
        />
        <YAxis
          stroke="rgb(var(--text-soft))"
          tickLine={false}
          axisLine={false}
          width={42}
          tick={{ fill: "rgb(var(--text-soft))", fontSize: 12, fontWeight: 500 }}
        />
        <Tooltip
          contentStyle={{
            background: "rgb(var(--card-2) / 0.95)",
            border: "1px solid rgb(var(--primary) / 0.28)",
            borderRadius: "0.6rem",
            color: "rgb(var(--text-strong))",
          }}
          labelStyle={{ color: "rgb(var(--text-strong))", fontWeight: 600 }}
          itemStyle={{ color: "rgb(var(--text-body))", fontWeight: 500 }}
        />
        <Area
          type="monotone"
          dataKey="xp"
          stroke="rgb(var(--primary))"
          strokeWidth={2.4}
          fill="url(#xpGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
