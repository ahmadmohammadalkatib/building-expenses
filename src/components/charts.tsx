"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function CashFlowChart({
  data,
  labels,
  rtl,
}: {
  data: { label: string; collections: number; expenses: number }[];
  labels: { collections: string; expenses: string };
  rtl: boolean;
}) {
  const fmt = (v: number) => `₪${(v / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer>
        <BarChart data={rtl ? [...data].reverse() : data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
          <YAxis
            orientation={rtl ? "right" : "left"}
            tickFormatter={fmt}
            tickLine={false}
            axisLine={false}
            width={70}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
          />
          <Tooltip
            formatter={(v: number) => fmt(v)}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)" }}
            cursor={{ fill: "var(--surface-2)" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="collections" name={labels.collections} fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="expenses" name={labels.expenses} fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
