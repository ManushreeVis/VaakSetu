"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DayPoint {
  day: string;
  count: number;
}

interface ActivityChartProps {
  data: DayPoint[];
}

const fmtDay = (iso: string): string => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
};

export function ActivityChart({ data }: ActivityChartProps) {
  const total = data.reduce((a, d) => a + d.count, 0);
  const maxCount = Math.max(1, ...data.map((d) => d.count));

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-primary" />
          Activity — last 14 days
        </CardTitle>
        <span className="text-sm font-semibold tabular-nums text-muted-foreground">{total} jobs</span>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <XAxis
              dataKey="day"
              tickFormatter={fmtDay}
              tick={{ fontSize: 10, fill: "currentColor" }}
              className="text-muted-foreground"
              interval={1}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: "currentColor" }}
              className="text-muted-foreground"
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.4 }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "var(--popover-foreground)",
              }}
              labelFormatter={fmtDay}
              formatter={(v: number) => [`${v} job${v === 1 ? "" : "s"}`, "Activity"]}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={28}>
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={d.count > 0 ? "var(--primary)" : "var(--muted-foreground)"}
                  fillOpacity={d.count > 0 ? 0.85 : 0.25}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {total === 0 && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            No activity yet — run your first translation to see it here.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
