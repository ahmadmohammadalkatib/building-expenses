"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
  const compact = (v: number) => `₪${(v / 100).toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 })}`;
  const series = [
    { key: "collections", label: labels.collections, color: "var(--chart-1)" },
    { key: "expenses", label: labels.expenses, color: "var(--chart-2)" },
  ];
  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {series.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
            {s.label}
          </li>
        ))}
      </ul>
      <div className="h-64 w-full" dir="ltr">
        <ResponsiveContainer>
          <BarChart data={rtl ? [...data].reverse() : data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barGap={3} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--muted)", fontSize: 12 }} />
            <YAxis
              orientation={rtl ? "right" : "left"}
              tickFormatter={compact}
              tickLine={false}
              axisLine={false}
              width={56}
              tick={{ fill: "var(--muted)", fontSize: 12 }}
            />
            <Tooltip
              formatter={(v: number) => fmt(v)}
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                boxShadow: "var(--sh-md)",
                color: "var(--text)",
                fontSize: 13,
                padding: "8px 12px",
              }}
              labelStyle={{ color: "var(--muted)", marginBottom: 4 }}
              cursor={{ fill: "var(--surface-2)" }}
            />
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={22} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
