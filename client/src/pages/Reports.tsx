import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";
import { cn } from "@/lib/utils";
import { formatCurrency, formatCurrencyFull, PageHeader } from "@/components/crm/shared";

const PRESETS = [
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "6mo", days: 180 },
  { label: "1yr", days: 365 },
];

function getDateRange(days: number) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

const STAGE_COLORS: Record<string, string> = {
  lead: "#94a3b8",
  qualified: "#3b82f6",
  proposal: "#8b5cf6",
  negotiation: "#f59e0b",
  closed_won: "#10b981",
  closed_lost: "#ef4444",
};

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead", qualified: "Qualified", proposal: "Proposal",
  negotiation: "Negotiation", closed_won: "Closed Won", closed_lost: "Closed Lost",
};

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-xs">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? p.fill }}>
          {p.name}: {typeof p.value === "number" && p.name?.toLowerCase().includes("revenue")
            ? formatCurrencyFull(p.value)
            : p.value}
        </p>
      ))}
    </div>
  );
}

export default function Reports() {
  const [preset, setPreset] = useState(2); // 6mo default
  const { startDate, endDate } = useMemo(() => getDateRange(PRESETS[preset].days), [preset]);

  const trendQuery = trpc.revenue.trend.useQuery({
    granularity: PRESETS[preset].days <= 30 ? "daily" : PRESETS[preset].days <= 180 ? "weekly" : "monthly",
    startDate,
    endDate,
  });
  const stageQuery = trpc.reports.dealsByStage.useQuery({});
  const leaderboardQuery = trpc.team.leaderboard.useQuery({ startDate, endDate });

  const trendData = (trendQuery.data ?? []).map((r) => ({
    period: r.period,
    Revenue: Number(r.revenue),
    Deals: Number(r.count),
  }));

  const stageData = (stageQuery.data ?? []).map((r) => ({
    name: STAGE_LABELS[r.stage] ?? r.stage,
    value: Number(r.count),
    totalValue: Number(r.totalValue),
    color: STAGE_COLORS[r.stage] ?? "#94a3b8",
  }));

  const repData = (leaderboardQuery.data ?? []).slice(0, 8).map((r) => ({
    name: r.name?.split(" ")[0] ?? "Rep",
    Revenue: Number(r.revenue),
    Deals: r.dealsClosed,
  }));

  const totalRevenue = trendData.reduce((s, r) => s + r.Revenue, 0);
  const totalDeals = trendData.reduce((s, r) => s + r.Deals, 0);
  const totalPipelineValue = stageData.reduce((s, r) => s + r.totalValue, 0);

  return (
    <div className="p-6 max-w-[1400px]">
      <div className="flex items-center justify-between mb-6">
        <PageHeader
          title="Reports"
          subtitle="Analytics and performance insights"
        />
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => setPreset(i)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                preset === i ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Revenue Generated", value: formatCurrencyFull(totalRevenue), sub: "Closed won" },
          { label: "Deals Closed", value: String(totalDeals), sub: "Won in period" },
          { label: "Total Pipeline", value: formatCurrencyFull(totalPipelineValue), sub: "All open deals" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Revenue trend */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm mb-4">
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-foreground">Revenue & Deals Over Time</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Closed won revenue and deal count by period</p>
        </div>
        {trendData.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">No data for this period</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.008 247)" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: "oklch(0.52 0.018 247)" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="rev" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11, fill: "oklch(0.52 0.018 247)" }} axisLine={false} tickLine={false} width={60} />
              <YAxis yAxisId="deals" orientation="right" tick={{ fontSize: 11, fill: "oklch(0.52 0.018 247)" }} axisLine={false} tickLine={false} width={30} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Area yAxisId="rev" type="monotone" dataKey="Revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revGrad)" dot={false} />
              <Bar yAxisId="deals" dataKey="Deals" fill="#0ea5e9" opacity={0.7} radius={[2, 2, 0, 0]} maxBarSize={20} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pipeline by stage */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-foreground">Pipeline Distribution</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Deal count by stage</p>
          </div>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={200}>
              <PieChart>
                <Pie
                  data={stageData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {stageData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any, name: any) => [v, name]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {stageData.map((s) => (
                <div key={s.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    <span className="text-muted-foreground">{s.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{s.value}</span>
                    <span className="text-muted-foreground">{formatCurrency(s.totalValue)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rep performance */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-foreground">Rep Revenue Comparison</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Revenue generated per sales rep</p>
          </div>
          {repData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={repData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.008 247)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "oklch(0.52 0.018 247)" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11, fill: "oklch(0.52 0.018 247)" }} axisLine={false} tickLine={false} width={55} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="Revenue" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
