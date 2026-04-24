import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp, DollarSign, Target, Award, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Avatar,
  formatCurrency,
  formatCurrencyFull,
  ActivityIcon,
  timeAgo,
  PageHeader,
} from "@/components/crm/shared";

// ─── Date range presets ───────────────────────────────────────────────────────

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

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  gradient,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  gradient: string;
}) {
  return (
    <div
      className={cn(
        "relative bg-card rounded-xl border border-border p-5 overflow-hidden",
        "shadow-sm hover:shadow-md transition-shadow duration-200"
      )}
    >
      <div
        className="absolute inset-0 opacity-60 pointer-events-none"
        style={{ background: gradient }}
      />
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: `${color}18` }}
          >
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
        </div>
        <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-xs">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {p.name === "Revenue" ? formatCurrencyFull(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Overview() {
  const [preset, setPreset] = useState(1); // 90d default
  const { startDate, endDate } = useMemo(() => getDateRange(PRESETS[preset].days), [preset]);

  const kpiQuery = trpc.kpi.summary.useQuery({ startDate, endDate });
  const trendQuery = trpc.revenue.trend.useQuery({
    granularity: PRESETS[preset].days <= 30 ? "daily" : PRESETS[preset].days <= 180 ? "weekly" : "monthly",
    startDate,
    endDate,
  });
  const stageQuery = trpc.reports.dealsByStage.useQuery({});
  const recentQuery = trpc.activities.recent.useQuery({ limit: 8 });

  const kpi = kpiQuery.data;
  const trendData = (trendQuery.data ?? []).map((r) => ({
    period: r.period,
    Revenue: Number(r.revenue),
    Deals: Number(r.count),
  }));

  const STAGE_ORDER = ["lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"];
  const STAGE_LABELS: Record<string, string> = {
    lead: "Lead", qualified: "Qualified", proposal: "Proposal",
    negotiation: "Negotiation", closed_won: "Won", closed_lost: "Lost",
  };
  const stageData = STAGE_ORDER.map((s) => {
    const row = (stageQuery.data ?? []).find((r) => r.stage === s);
    return {
      stage: STAGE_LABELS[s] ?? s,
      Deals: Number(row?.count ?? 0),
      Value: Number(row?.totalValue ?? 0),
    };
  });

  return (
    <div className="p-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <PageHeader
          title="Overview"
          subtitle="Your sales performance at a glance"
        />
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => setPreset(i)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                preset === i
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Total Revenue"
          value={formatCurrency(Number(kpi?.totalRevenue ?? 0))}
          subtitle={`${PRESETS[preset].label} period`}
          icon={DollarSign}
          color="#6366f1"
          gradient="linear-gradient(135deg, oklch(0.49 0.18 264 / 0.06) 0%, transparent 60%)"
        />
        <KpiCard
          title="Deals Closed"
          value={String(kpi?.dealsClosed ?? 0)}
          subtitle="Closed won"
          icon={Target}
          color="#0ea5e9"
          gradient="linear-gradient(135deg, oklch(0.6 0.18 200 / 0.06) 0%, transparent 60%)"
        />
        <KpiCard
          title="Win Rate"
          value={`${kpi?.winRate ?? 0}%`}
          subtitle="Won vs total closed"
          icon={TrendingUp}
          color="#10b981"
          gradient="linear-gradient(135deg, oklch(0.65 0.16 150 / 0.06) 0%, transparent 60%)"
        />
        <KpiCard
          title="Avg Deal Size"
          value={formatCurrency(Number(kpi?.avgDealSize ?? 0))}
          subtitle="Per closed deal"
          icon={Award}
          color="#f59e0b"
          gradient="linear-gradient(135deg, oklch(0.7 0.18 50 / 0.06) 0%, transparent 60%)"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Revenue trend */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Revenue Trend</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Closed won revenue over time</p>
            </div>
          </div>
          {trendData.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">
              No revenue data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.008 247)" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: "oklch(0.52 0.018 247)" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11, fill: "oklch(0.52 0.018 247)" }} axisLine={false} tickLine={false} width={60} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="Revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revenueGrad)" dot={false} activeDot={{ r: 4, fill: "#6366f1" }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Deals by stage */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-foreground">Pipeline by Stage</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Deal count per stage</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stageData} layout="vertical" margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.008 247)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "oklch(0.52 0.018 247)" }} axisLine={false} tickLine={false} />
              <YAxis dataKey="stage" type="category" tick={{ fontSize: 11, fill: "oklch(0.52 0.018 247)" }} axisLine={false} tickLine={false} width={72} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="Deals" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
        </div>
        {recentQuery.isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-2.5 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (recentQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No recent activity</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(recentQuery.data ?? []).map((a) => (
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <ActivityIcon type={a.type} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {a.repName && (
                      <span className="text-xs text-muted-foreground">{a.repName}</span>
                    )}
                    {a.dealTitle && (
                      <>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground truncate">{a.dealTitle}</span>
                      </>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">{timeAgo(a.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
