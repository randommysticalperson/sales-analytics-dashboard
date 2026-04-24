import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Trophy, TrendingUp, Target, DollarSign } from "lucide-react";
import { Avatar, formatCurrency, formatCurrencyFull, PageHeader } from "@/components/crm/shared";

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

const MEDAL_COLORS = ["#f59e0b", "#94a3b8", "#cd7c2f"];
const MEDAL_LABELS = ["1st", "2nd", "3rd"];

export default function Team() {
  const [preset, setPreset] = useState(1);
  const { startDate, endDate } = useMemo(() => getDateRange(PRESETS[preset].days), [preset]);

  const leaderboardQuery = trpc.team.leaderboard.useQuery({ startDate, endDate });
  const reps = leaderboardQuery.data ?? [];

  const maxRevenue = Math.max(...reps.map((r) => Number(r.revenue)), 1);

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <PageHeader
          title="Team Performance"
          subtitle="Sales rep leaderboard and metrics"
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

      {/* Top 3 podium */}
      {reps.length >= 3 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {reps.slice(0, 3).map((rep, i) => (
            <div
              key={rep.id}
              className={cn(
                "bg-card border border-border rounded-xl p-5 text-center shadow-sm relative overflow-hidden",
                i === 0 && "ring-2 ring-amber-300/60"
              )}
            >
              <div
                className="absolute inset-0 opacity-30 pointer-events-none"
                style={{
                  background: `radial-gradient(circle at 50% 0%, ${MEDAL_COLORS[i]}22 0%, transparent 70%)`,
                }}
              />
              <div className="relative">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white mx-auto mb-3"
              style={{ background: MEDAL_COLORS[i] }}
            >
              {i === 0 ? <Trophy className="w-5 h-5" /> : MEDAL_LABELS[i]}
            </div>
                <Avatar
                  initials={rep.avatarInitials}
                  color={rep.avatarColor}
                  size="md"
                  name={rep.name ?? ""}
                />
                <div className="mt-3">
                  <p className="text-sm font-semibold text-foreground">{rep.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{rep.title ?? "Sales Rep"}</p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-foreground">{rep.dealsClosed}</p>
                    <p className="text-xs text-muted-foreground">Deals</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-primary">{formatCurrency(Number(rep.revenue))}</p>
                    <p className="text-xs text-muted-foreground">Revenue</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full leaderboard table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Full Leaderboard</h3>
        </div>
        {leaderboardQuery.isLoading ? (
          <div className="p-5 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-muted" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 bg-muted rounded w-32" />
                  <div className="h-3 bg-muted rounded w-20" />
                </div>
                <div className="h-4 bg-muted rounded w-20" />
                <div className="h-4 bg-muted rounded w-16" />
              </div>
            ))}
          </div>
        ) : reps.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No data for this period</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-12">#</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rep</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Revenue</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deals Closed</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Win Rate</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Avg Deal</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-40">Revenue Share</th>
              </tr>
            </thead>
            <tbody>
              {reps.map((rep, i) => {
                const revenueShare = (Number(rep.revenue) / maxRevenue) * 100;
                const winRate = rep.winRate;
                const avgDeal = rep.dealsClosed > 0
                  ? Number(rep.revenue) / rep.dealsClosed
                  : 0;

                return (
                  <tr key={rep.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <span
                        className="text-sm font-bold"
                        style={{ color: i < 3 ? MEDAL_COLORS[i] : "oklch(0.52 0.018 247)" }}
                      >
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar initials={rep.avatarInitials} color={rep.avatarColor} size="sm" name={rep.name ?? ""} />
                        <div>
                          <p className="font-medium text-foreground">{rep.name}</p>
                          <p className="text-xs text-muted-foreground">{rep.title ?? "Sales Rep"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-semibold text-foreground">{formatCurrencyFull(Number(rep.revenue))}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-medium text-foreground">{rep.dealsClosed}</span>
                        <span className="text-xs text-muted-foreground">/ {rep.dealsClosed + rep.dealsLost} total</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className={cn("w-3.5 h-3.5", winRate >= 50 ? "text-emerald-500" : "text-muted-foreground")} />
                        <span className={cn("font-medium", winRate >= 50 ? "text-emerald-600" : "text-foreground")}>{winRate}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">{formatCurrency(avgDeal)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${revenueShare}%`, background: rep.avatarColor ?? "oklch(0.49 0.18 264)" }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">{Math.round(revenueShare)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
