/**
 * Econophysics Analytics Page
 *
 * Applies models from two sources:
 *
 * 1. Classical Econophysics (Cockshott, Cottrell, Michaelson, Wright, Yakovenko)
 *    Ch. 8 — Statistical Mechanics of Money (Dragulescu & Yakovenko):
 *    - Boltzmann-Gibbs distribution: P(m) = (1/T)·exp(-m/T), T = mean deal value
 *    - Gini coefficient & Lorenz curve for revenue concentration
 *    - Shannon/Boltzmann entropy of revenue distribution
 *    - Economic temperature trend T(t) = M(t)/N(t)
 *    - Pareto tail: top ~10% of deals follow power-law, not exponential
 *
 * 2. Mathematical Finance (Clare Wallace, Durham University)
 *    Ch. 6 — Black-Scholes / GBM:
 *    - Geometric Brownian Motion: S_t = S_0·exp((μ-σ²/2)t + σW_t)
 *    - Drift μ and volatility σ estimated from log-returns of monthly revenue
 *    - Monte Carlo forecast: 200 paths, 6-month horizon
 *    - Binomial pipeline expected value: E[Revenue] = Σ deal_value × P(win|stage)
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
} from "recharts";
import { TrendingUp, TrendingDown, Thermometer, Activity, BarChart2, Sigma, Zap, Target, BookOpen, AlertTriangle, ExternalLink, Settings2, Check, X } from "lucide-react";
import { toast } from "sonner";

// PDF URLs (uploaded to webdev static storage)
const PDF_URLS = {
  classicalEconophysics: "/manus-storage/classical_econophysics_36239cd1.pdf",
  mathematicalFinance: "/manus-storage/mathematical_finance_wallace_durham_3170cced.pdf",
};

const STAGE_ORDER = ["lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"];

const fmt = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K` : `$${n}`;

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

const STAGE_COLORS: Record<string, string> = {
  lead: "#94a3b8",
  qualified: "#60a5fa",
  proposal: "#a78bfa",
  negotiation: "#f59e0b",
  closed_won: "#34d399",
  closed_lost: "#f87171",
};

// ─── Data Quality Banner ──────────────────────────────────────────────────────
function DataQualityBanner({ dealCount, monthCount }: { dealCount: number; monthCount: number }) {
  const issues: string[] = [];
  if (dealCount < 30) issues.push(`only ${dealCount} closed deals (30+ recommended for reliable distribution fits)`);
  if (monthCount < 6) issues.push(`only ${monthCount} months of revenue history (6+ recommended for GBM estimation)`);
  if (issues.length === 0) return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 px-4 py-3">
      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Data quality notice</p>
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
          The current dataset has {issues.join(" and ")}. All models will render, but outputs should be treated as
          illustrative rather than statistically reliable. See the <span className="font-medium">General Caveats</span> section
          in the methodology document for details.
        </p>
      </div>
    </div>
  );
}

// ─── Methodology Modal ────────────────────────────────────────────────────────
const METHODOLOGY_MODELS = [
  {
    name: "Boltzmann-Gibbs Distribution", formula: "P(m) = (1/T) · exp(−m/T)",
    source: "Classical Econophysics Ch. 8", pdf: "classicalEconophysics" as const,
    assumptions: ["Money conservation — total deal value in the system is fixed.", "Random pairwise exchange — deal values arise from agent interactions.", "Equilibrium — the pipeline has reached a statistical steady state.", "Exponential body with a power-law Pareto tail above the 90th percentile."],
    limitations: ["Fewer than ~30 deals makes the histogram too sparse to test the fit.", "The model is purely descriptive — it says nothing about why deals have the values they do.", "The Pareto threshold is set mechanically at the 90th percentile, not estimated statistically."],
  },
  {
    name: "Economic Temperature (T = M/N)", formula: "T(t) = total deal value / number of deals",
    source: "Classical Econophysics Ch. 8", pdf: "classicalEconophysics" as const,
    assumptions: ["Uniform deal mix — all deals are treated as equivalent agents.", "Consistent period length — periods must be the same duration for comparison."],
    limitations: ["Sensitive to outliers — one very large deal can spike the temperature for a period.", "Does not capture the spread of deal sizes within a period."],
  },
  {
    name: "Gini Coefficient & Lorenz Curve", formula: "G = 1 − 2∫L(x)dx",
    source: "Classical Econophysics Ch. 8, 13", pdf: "classicalEconophysics" as const,
    assumptions: ["Reps are comparable agents operating under similar conditions.", "Revenue is the right metric — ignores pipeline value, activity, or deal count."],
    limitations: ["With fewer than 5–6 reps, the Gini is highly sensitive to individual performance.", "Identical Gini values can arise from very different distributions.", "Does not account for part-time reps or reps who joined mid-period."],
  },
  {
    name: "Shannon / Boltzmann Entropy", formula: "S = −Σ pᵢ · ln(pᵢ)",
    source: "Classical Econophysics Ch. 1", pdf: "classicalEconophysics" as const,
    assumptions: ["All reps are active — reps with zero revenue are excluded by convention.", "Revenue shares sum to 1 — deals without an assigned rep are excluded."],
    limitations: ["Entropy is not directional on its own — track it as a time series to detect trends.", "Normalised entropy depends on the number of active reps."],
  },
  {
    name: "Pareto Tail Analysis", formula: "P(m) ~ m^(−α) for m > m₀",
    source: "Classical Econophysics Ch. 8", pdf: "classicalEconophysics" as const,
    assumptions: ["The 90th percentile is a reasonable threshold for the exponential-to-power-law crossover.", "The tail is stable — the model reports a snapshot, not a trend."],
    limitations: ["Fewer than 20–30 deals makes the 90th percentile threshold unreliable.", "The power-law exponent α is not fitted — this is a descriptive first step only."],
  },
  {
    name: "GBM — Drift & Volatility", formula: "Sₜ = S₀ · exp((μ − σ²/2)t + σWₜ)",
    source: "Mathematical Finance Ch. 6", pdf: "mathematicalFinance" as const,
    assumptions: ["Log-normal revenue — revenue is always positive and log-returns are normally distributed.", "Constant drift μ and volatility σ over time.", "Independent monthly increments — no autocorrelation between months."],
    limitations: ["Fewer than 6 months of data produces unreliable estimates (capped at 300%/yr drift, 200%/yr volatility).", "Cannot model structural breaks — pivots, major hires, or market downturns will invalidate historical parameters.", "Fat-tailed revenue distributions are underestimated by the normal assumption."],
  },
  {
    name: "Monte Carlo Revenue Forecast", formula: "200 GBM paths, 6-month horizon",
    source: "Mathematical Finance Ch. 6", pdf: "mathematicalFinance" as const,
    assumptions: ["All GBM assumptions above apply.", "200 paths is sufficient for stable percentile estimates at a 6-month horizon.", "Fixed random seed (42) for reproducibility."],
    limitations: ["Forecast bands widen rapidly — beyond 6–12 months they become too wide to be informative.", "Does not incorporate external information such as pipeline size or headcount changes.", "This is a statistical scenario tool, not a financial forecast."],
  },
  {
    name: "Binomial Pipeline Expected Value", formula: "E[R] = Σ vᵢ · p(stageᵢ)",
    source: "Mathematical Finance Ch. 2–3", pdf: "mathematicalFinance" as const,
    assumptions: ["Stage probabilities are fixed and universal across all deals in that stage.", "Deals are independent — the outcome of one does not affect another.", "Deal value is certain — no negotiation discount is modelled."],
    limitations: ["Default stage probabilities are industry benchmarks, not your actual historical conversion rates. Calibrate them using the editor.", "Does not account for deal age — a stale deal in Proposal is less likely to close than a fresh one.", "Expected value is a mean — the actual outcome will differ. No confidence interval is provided."],
  },
];

function MethodologyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            Econophysics Methodology
          </DialogTitle>
          <DialogDescription>
            Plain-English explanation of each model's assumptions and limitations. Full derivations in the source PDFs.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-3 pt-1 pb-3 border-b border-border">
          <a href={PDF_URLS.classicalEconophysics} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 transition-colors">
            <ExternalLink className="w-3.5 h-3.5" />
            Classical Econophysics — Cockshott, Cottrell, Yakovenko et al.
          </a>
          <a href={PDF_URLS.mathematicalFinance} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 transition-colors">
            <ExternalLink className="w-3.5 h-3.5" />
            Mathematical Finance — Clare Wallace, Durham University
          </a>
        </div>
        <div className="space-y-5 pt-1">
          {METHODOLOGY_MODELS.map((model) => (
            <div key={model.name} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{model.name}</h3>
                  <code className="text-xs text-muted-foreground font-mono">{model.formula}</code>
                </div>
                <a href={PDF_URLS[model.pdf]} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  <Badge variant="outline" className="text-[10px] hover:bg-muted cursor-pointer gap-1">
                    <ExternalLink className="w-2.5 h-2.5" />{model.source}
                  </Badge>
                </a>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Assumptions</p>
                  <ul className="space-y-1">{model.assumptions.map((a, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
                      <span className="text-emerald-500 mt-0.5 shrink-0">•</span>{a}
                    </li>
                  ))}</ul>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Limitations</p>
                  <ul className="space-y-1">{model.limitations.map((l, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
                      <span className="text-amber-500 mt-0.5 shrink-0">•</span>{l}
                    </li>
                  ))}</ul>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">General caveat:</span> All models are descriptive and exploratory.
            They are intended to surface patterns and prompt questions, not to replace human judgment.
            The quality of every output depends directly on the completeness and accuracy of the underlying CRM data.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Stage Probability Editor (admin only) ────────────────────────────────────
function StageProbabilityEditor({ stageProbabilities }: { stageProbabilities: Record<string, number> }) {
  const utils = trpc.useUtils();
  const updateMutation = trpc.stageProbabilities.update.useMutation({
    onSuccess: () => { utils.stageProbabilities.get.invalidate(); utils.econophysics.full.invalidate(); toast.success("Stage probability updated"); },
    onError: (err) => toast.error(err.message),
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const startEdit = (stage: string, current: number) => { setEditing(stage); setEditValue((current * 100).toFixed(1)); };
  const commitEdit = (stage: string) => {
    const val = parseFloat(editValue);
    if (isNaN(val) || val < 0 || val > 100) { toast.error("Enter a value between 0 and 100"); return; }
    updateMutation.mutate({ stage: stage as any, probability: val / 100 });
    setEditing(null);
  };
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">Stage Win Probabilities</CardTitle>
          <Badge variant="secondary" className="text-[10px] ml-auto">Admin</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Used in the Binomial Pipeline EV model. Click any value to edit. Defaults are industry benchmarks — calibrate to your actual conversion rates.</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {STAGE_ORDER.map((stage) => {
            const prob = stageProbabilities[stage] ?? 0;
            const isEditing = editing === stage;
            const isFixed = stage === "closed_won" || stage === "closed_lost";
            return (
              <div key={stage} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: STAGE_COLORS[stage] }} />
                <span className="text-sm font-medium text-foreground w-28 shrink-0">{STAGE_LABELS[stage]}</span>
                <div className="flex-1">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${prob * 100}%`, backgroundColor: STAGE_COLORS[stage] }} />
                  </div>
                </div>
                {isEditing ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Input className="h-7 w-20 text-xs text-right" value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") commitEdit(stage); if (e.key === "Escape") setEditing(null); }}
                      autoFocus />
                    <span className="text-xs text-muted-foreground">%</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => commitEdit(stage)} disabled={updateMutation.isPending}><Check className="w-3.5 h-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setEditing(null)}><X className="w-3.5 h-3.5" /></Button>
                  </div>
                ) : (
                  <button className={`text-sm font-semibold w-14 text-right shrink-0 transition-colors ${ isFixed ? "text-muted-foreground cursor-default" : "text-foreground hover:text-indigo-600 cursor-pointer" }`}
                    onClick={() => !isFixed && startEdit(stage, prob)} title={isFixed ? "Fixed value" : "Click to edit"}>
                    {pct(prob)}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Metric Card ─────────────────────────────────────────────────────────────
function MetricCard({
  title,
  value,
  sub,
  icon: Icon,
  accent = false,
  tooltip,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent?: boolean;
  tooltip?: string;
}) {
  return (
    <Card className={`relative overflow-hidden ${accent ? "border-indigo-300 bg-indigo-50/40 dark:bg-indigo-950/20 dark:border-indigo-700" : ""}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{title}</p>
            <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{sub}</p>}
          </div>
          <div className={`p-2.5 rounded-xl shrink-0 ${accent ? "bg-indigo-100 dark:bg-indigo-900/40" : "bg-muted"}`}>
            <Icon className={`w-5 h-5 ${accent ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground"}`} />
          </div>
        </div>
        {tooltip && (
          <p className="mt-3 text-[11px] text-muted-foreground/70 border-t pt-2 leading-relaxed">{tooltip}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title, source, description }: { title: string; source: string; description: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground border-muted-foreground/30">
          {source}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">{description}</p>
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, prefix = "$" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" && p.name !== "Population %" && p.name !== "Probability"
            ? prefix + p.value.toLocaleString()
            : p.value}
        </p>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Econophysics() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [methodologyOpen, setMethodologyOpen] = useState(false);

  const { data, isLoading } = trpc.econophysics.full.useQuery(undefined, {
    staleTime: 60_000,
  });
  const { data: stageProbData } = trpc.stageProbabilities.get.useQuery(undefined, { staleTime: 30_000 });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <Skeleton className="h-7 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  if (!data) return null;

  const { boltzmannGibbs, gini, entropy, gbmParams, forecast, pipelineValue, temperatureTrend, repRevenues, monthlySeries } = data;

  // ── Data quality checks ──
  const dealCount = boltzmannGibbs.histogram.reduce((s: number, b: any) => s + b.count, 0);
  const monthCount = monthlySeries.filter((m: any) => m.totalValue > 0).length;

  // ── Lorenz curve data ──
  const lorenzData = gini.lorenz.filter((_, i) => i % Math.max(1, Math.floor(gini.lorenz.length / 20)) === 0).map(p => ({
    population: Math.round(p.population * 100),
    wealthShare: Math.round(p.wealthShare * 100),
    equalLine: Math.round(p.population * 100),
  }));

  // ── Monte Carlo fan chart data ──
  const months = ["Now", "+1m", "+2m", "+3m", "+4m", "+5m", "+6m"];
  const forecastData = forecast.median.map((med, i) => ({
    month: months[i] ?? `+${i}m`,
    median: med,
    p10: forecast.p10[i],
    p90: forecast.p90[i],
    p25: forecast.p25[i],
    p75: forecast.p75[i],
  }));

  // ── Pipeline binomial data ──
  const pipelineData = pipelineValue.byStage
    .filter(s => s.stage !== "closed_lost")
    .sort((a, b) => b.faceValue - a.faceValue)
    .map(s => ({
      stage: STAGE_LABELS[s.stage] ?? s.stage,
      faceValue: s.faceValue,
      expectedValue: s.expectedValue,
      probability: Math.round(s.probability * 100),
      fill: STAGE_COLORS[s.stage] ?? "#94a3b8",
    }));

  // ── Economic temperature trend ──
  const tempData = temperatureTrend.slice(-12).map(t => ({
    label: t.label,
    temperature: t.temperature,
  }));

  // ── Monthly revenue for GBM context ──
  const revenueData = monthlySeries.slice(-12).map(m => ({
    label: m.label,
    revenue: m.totalValue,
  }));

  return (
    <div className="p-6 space-y-8 max-w-7xl">
      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground mb-1">Econophysics Analytics</h1>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Statistical physics and mathematical finance models applied to CRM data. Based on{" "}
            <a href={PDF_URLS.classicalEconophysics} target="_blank" rel="noopener noreferrer"
              className="font-medium text-foreground hover:text-indigo-600 inline-flex items-center gap-0.5 transition-colors">
              Classical Econophysics<ExternalLink className="w-3 h-3 ml-0.5" />
            </a>{" "}(Cockshott, Cottrell, Yakovenko et al.) and{" "}
            <a href={PDF_URLS.mathematicalFinance} target="_blank" rel="noopener noreferrer"
              className="font-medium text-foreground hover:text-indigo-600 inline-flex items-center gap-0.5 transition-colors">
              Mathematical Finance<ExternalLink className="w-3 h-3 ml-0.5" />
            </a>{" "}(Wallace, Durham University).
          </p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => setMethodologyOpen(true)}>
          <BookOpen className="w-3.5 h-3.5" />
          Read methodology
        </Button>
      </div>

      {/* ── Data Quality Banner ── */}
      <DataQualityBanner dealCount={dealCount} monthCount={monthCount} />

      {/* ── Top KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Economic Temperature"
          value={fmt(boltzmannGibbs.temperature)}
          sub="T = M/N — mean deal value per agent"
          icon={Thermometer}
          accent
          tooltip="Analogous to thermodynamic temperature. Higher T = more 'hot money' per deal. Source: Ch. 8, Classical Econophysics."
        />
        <MetricCard
          title="Gini Coefficient"
          value={boltzmannGibbs.temperature > 0 ? gini.gini.toFixed(3) : "—"}
          sub={gini.interpretation}
          icon={Activity}
          tooltip="Measures revenue inequality across reps. Pure Boltzmann-Gibbs equilibrium gives Gini = 0.5. Source: Classical Econophysics Ch. 8, 13."
        />
        <MetricCard
          title="Revenue Entropy"
          value={`${pct(entropy.normalizedEntropy)} S/S_max`}
          sub={entropy.interpretation}
          icon={Sigma}
          tooltip="S = −Σ p_i·ln(p_i). Maximum entropy = perfectly equal distribution. Source: Boltzmann entropy, Classical Econophysics Ch. 1."
        />
        <MetricCard
          title="Pareto Tail Share"
          value={pct(boltzmannGibbs.paretoRevenueShare)}
          sub={`Top ${pct(boltzmannGibbs.paretoFraction)} of deals by value`}
          icon={BarChart2}
          tooltip="Deals above the 90th percentile follow a power-law (Pareto-Zipf) rather than the Boltzmann-Gibbs exponential. Source: Dragulescu & Yakovenko (2002)."
        />
        <MetricCard
          title="GBM Drift (μ)"
          value={`${(gbmParams.mu * 100).toFixed(1)}% /yr`}
          sub="Expected annual revenue growth rate"
          icon={TrendingUp}
          tooltip="μ = annualised mean log-return of monthly revenue. From GBM: S_t = S_0·exp((μ−σ²/2)t + σW_t). Source: Mathematical Finance Ch. 6."
        />
        <MetricCard
          title="GBM Volatility (σ)"
          value={`${(gbmParams.sigma * 100).toFixed(1)}% /yr`}
          sub="Annualised revenue volatility"
          icon={Zap}
          tooltip="σ = std(log-returns)·√12. Measures unpredictability of revenue growth. Source: Mathematical Finance Ch. 6 (Black-Scholes / GBM)."
        />
        <MetricCard
          title="Pipeline Expected Value"
          value={fmt(pipelineValue.totalExpected)}
          sub={`${pct(pipelineValue.weightedConversionRate)} weighted conversion`}
          icon={Target}
          accent
          tooltip="E[Revenue] = Σ deal_value × P(win|stage). Binomial model with stage-specific win probabilities. Source: Mathematical Finance Ch. 2–3."
        />
        <MetricCard
          title="GBM 6-Month Forecast"
          value={fmt(forecast.expectedFinal)}
          sub="E[S_T] = S_0·exp(μ·T), median of 200 paths"
          icon={TrendingUp}
          tooltip="Monte Carlo simulation: 200 GBM paths over 6 months using estimated μ and σ. Source: Mathematical Finance Ch. 6."
        />
      </div>

      {/* ── Section 1: Boltzmann-Gibbs Distribution ── */}
      <div>
        <SectionHeader
          title="Boltzmann-Gibbs Distribution of Deal Values"
          source="Classical Econophysics Ch. 8 — Dragulescu & Yakovenko (2000)"
          description={`In a closed economic system where money is conserved, the equilibrium distribution follows P(m) = (1/T)·exp(−m/T) where T = ${fmt(boltzmannGibbs.temperature)} is the economic temperature. The bars show observed deal values; the line shows the theoretical Boltzmann-Gibbs fit. Deals above the Pareto threshold (${fmt(boltzmannGibbs.paretoThreshold)}) deviate from the exponential and enter the power-law tail.`}
        />
        <Card>
          <CardContent className="pt-5 pb-3">
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={boltzmannGibbs.histogram} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="bin"
                  tickFormatter={v => fmt(v)}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" name="Observed count" fill="#6366f1" opacity={0.75} radius={[3, 3, 0, 0]} />
                <Line
                  dataKey="expected"
                  name="Boltzmann-Gibbs fit"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={false}
                  type="monotone"
                />
                <ReferenceLine
                  x={boltzmannGibbs.paretoThreshold}
                  stroke="#f87171"
                  strokeDasharray="4 3"
                  label={{ value: "Pareto threshold", position: "top", fontSize: 10, fill: "#f87171" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Section 2: Lorenz Curve & Gini ── */}
      <div>
        <SectionHeader
          title="Lorenz Curve — Revenue Concentration Across Sales Reps"
          source="Classical Econophysics Ch. 8, 13 — Gini coefficient"
          description={`The Lorenz curve plots cumulative revenue share against cumulative population share. The diagonal represents perfect equality. Gini = ${gini.gini.toFixed(3)}. ${gini.interpretation}. For a pure Boltzmann-Gibbs (exponential) distribution, Gini = 0.5. Values above 0.5 indicate Pareto dynamics in the upper tail.`}
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Lorenz Curve</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-3">
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={lorenzData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="population"
                    tickFormatter={v => `${v}%`}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    label={{ value: "Population %", position: "insideBottom", offset: -3, fontSize: 11 }}
                  />
                  <YAxis
                    tickFormatter={v => `${v}%`}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    label={{ value: "Revenue %", angle: -90, position: "insideLeft", fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(v: any, name: string) => [`${v}%`, name]}
                    labelFormatter={l => `Population: ${l}%`}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    dataKey="equalLine"
                    name="Perfect equality"
                    stroke="#94a3b8"
                    strokeDasharray="5 3"
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Area
                    dataKey="wealthShare"
                    name="Actual revenue share"
                    stroke="#6366f1"
                    fill="#6366f1"
                    fillOpacity={0.15}
                    strokeWidth={2}
                    dot={false}
                    type="monotone"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Revenue per Rep</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-3">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={[...repRevenues].sort((a, b) => b.revenue - a.revenue)}
                  margin={{ top: 5, right: 20, left: 10, bottom: 30 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="repName"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    angle={-30}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Section 3: GBM Monte Carlo Forecast ── */}
      <div>
        <SectionHeader
          title="GBM Monte Carlo Revenue Forecast (6 Months)"
          source="Mathematical Finance Ch. 6 — Black-Scholes / Geometric Brownian Motion"
          description={`Revenue modelled as S_t = S_0·exp((μ−σ²/2)·t + σ·W_t) with estimated drift μ = ${(gbmParams.mu * 100).toFixed(1)}%/yr and volatility σ = ${(gbmParams.sigma * 100).toFixed(1)}%/yr from historical log-returns. 200 Monte Carlo paths simulated. The shaded bands show the 10th–90th and 25th–75th percentile ranges. Expected final value: ${fmt(forecast.expectedFinal)}.`}
        />
        <Card>
          <CardContent className="pt-5 pb-3">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={forecastData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {/* 10-90 band */}
                <Area
                  dataKey="p90"
                  name="90th pct"
                  stroke="transparent"
                  fill="#6366f1"
                  fillOpacity={0.08}
                  legendType="none"
                  type="monotone"
                />
                <Area
                  dataKey="p10"
                  name="10th pct"
                  stroke="transparent"
                  fill="#ffffff"
                  fillOpacity={1}
                  legendType="none"
                  type="monotone"
                />
                {/* 25-75 band */}
                <Area
                  dataKey="p75"
                  name="75th pct"
                  stroke="transparent"
                  fill="#6366f1"
                  fillOpacity={0.15}
                  legendType="none"
                  type="monotone"
                />
                <Area
                  dataKey="p25"
                  name="25th pct"
                  stroke="transparent"
                  fill="#ffffff"
                  fillOpacity={1}
                  legendType="none"
                  type="monotone"
                />
                <Line
                  dataKey="p90"
                  name="Optimistic (P90)"
                  stroke="#34d399"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  type="monotone"
                />
                <Line
                  dataKey="p10"
                  name="Pessimistic (P10)"
                  stroke="#f87171"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  type="monotone"
                />
                <Line
                  dataKey="median"
                  name="Median forecast"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#6366f1" }}
                  type="monotone"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Section 4: Binomial Pipeline Expected Value ── */}
      <div>
        <SectionHeader
          title="Binomial Pipeline Expected Value"
          source="Mathematical Finance Ch. 2–3 — Binomial model & risk-neutral valuation"
          description={`Each deal is modelled as a binomial outcome: win with probability p(stage) or lose. Stage win probabilities: Lead 10%, Qualified 25%, Proposal 45%, Negotiation 70%, Closed Won 100%. Total face value: ${fmt(pipelineValue.totalFaceValue)}. Weighted expected value: ${fmt(pipelineValue.totalExpected)} (${pct(pipelineValue.weightedConversionRate)} conversion).`}
        />
        <Card>
          <CardContent className="pt-5 pb-3">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={pipelineData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="stage" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="faceValue" name="Face value" fill="#94a3b8" radius={[4, 4, 0, 0]} opacity={0.5} />
                <Bar dataKey="expectedValue" name="Expected value (binomial)" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Section 5: Economic Temperature Trend + Stage Probability Editor ── */}
      <div>
        <SectionHeader
          title="Economic Temperature Trend"
          source="Classical Econophysics Ch. 8 — T = M/N (mean money per agent)"
          description={`Economic temperature T(t) = total deal value / number of deals per period. Analogous to the thermodynamic temperature of a gas: a rising T indicates increasing 'hot money' per deal — deals are getting larger on average. A falling T may signal market cooling or a shift toward smaller, higher-volume deals.`}
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Temperature T(t) Over Time</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-3">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={tempData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    dataKey="temperature"
                    name="Economic temperature T"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.15}
                    strokeWidth={2}
                    type="monotone"
                    dot={{ r: 3, fill: "#f59e0b" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Monthly Revenue (Historical)</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-3">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={revenueData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          {isAdmin && stageProbData ? (
            <StageProbabilityEditor stageProbabilities={stageProbData} />
          ) : (
            <Card className="flex items-center justify-center min-h-[200px]">
              <p className="text-xs text-muted-foreground text-center px-6">
                Stage win probability calibration is available to administrators only.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* ── Model Reference Table ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Model Reference</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Model</th>
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Formula</th>
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Current Value</th>
                  <th className="text-left py-2 font-medium text-muted-foreground">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                <tr>
                  <td className="py-2 pr-4 font-medium">Boltzmann-Gibbs</td>
                  <td className="py-2 pr-4 font-mono text-muted-foreground">P(m) = (1/T)·e^(−m/T)</td>
                  <td className="py-2 pr-4">T = {fmt(boltzmannGibbs.temperature)}, λ = {boltzmannGibbs.lambda.toFixed(6)}</td>
                  <td className="py-2"><a href={PDF_URLS.classicalEconophysics} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-indigo-600 inline-flex items-center gap-1 transition-colors">Classical Econophysics Ch. 8<ExternalLink className="w-2.5 h-2.5" /></a></td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium">Gini Coefficient</td>
                  <td className="py-2 pr-4 font-mono text-muted-foreground">G = 1 − 2∫L(x)dx</td>
                  <td className="py-2 pr-4">G = {gini.gini.toFixed(3)}</td>
                  <td className="py-2"><a href={PDF_URLS.classicalEconophysics} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-indigo-600 inline-flex items-center gap-1 transition-colors">Classical Econophysics Ch. 8, 13<ExternalLink className="w-2.5 h-2.5" /></a></td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium">Boltzmann Entropy</td>
                  <td className="py-2 pr-4 font-mono text-muted-foreground">S = −Σ p_i·ln(p_i)</td>
                  <td className="py-2 pr-4">S = {entropy.entropy} (S/S_max = {pct(entropy.normalizedEntropy)})</td>
                  <td className="py-2"><a href={PDF_URLS.classicalEconophysics} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-indigo-600 inline-flex items-center gap-1 transition-colors">Classical Econophysics Ch. 1<ExternalLink className="w-2.5 h-2.5" /></a></td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium">GBM (drift)</td>
                  <td className="py-2 pr-4 font-mono text-muted-foreground">μ = E[ln(Sₜ/Sₜ₋₁)]·12 + σ²/2</td>
                  <td className="py-2 pr-4">μ = {(gbmParams.mu * 100).toFixed(2)}%/yr</td>
                  <td className="py-2"><a href={PDF_URLS.mathematicalFinance} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-indigo-600 inline-flex items-center gap-1 transition-colors">Mathematical Finance Ch. 6<ExternalLink className="w-2.5 h-2.5" /></a></td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium">GBM (volatility)</td>
                  <td className="py-2 pr-4 font-mono text-muted-foreground">σ = std(log-returns)·√12</td>
                  <td className="py-2 pr-4">σ = {(gbmParams.sigma * 100).toFixed(2)}%/yr</td>
                  <td className="py-2"><a href={PDF_URLS.mathematicalFinance} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-indigo-600 inline-flex items-center gap-1 transition-colors">Mathematical Finance Ch. 6<ExternalLink className="w-2.5 h-2.5" /></a></td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium">Monte Carlo (GBM)</td>
                  <td className="py-2 pr-4 font-mono text-muted-foreground">Sₜ = S₀·exp((μ−σ²/2)t + σWₜ)</td>
                  <td className="py-2 pr-4">E[S₆] = {fmt(forecast.expectedFinal)}</td>
                  <td className="py-2"><a href={PDF_URLS.mathematicalFinance} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-indigo-600 inline-flex items-center gap-1 transition-colors">Mathematical Finance Ch. 6<ExternalLink className="w-2.5 h-2.5" /></a></td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium">Binomial Pipeline</td>
                  <td className="py-2 pr-4 font-mono text-muted-foreground">E[R] = Σ vᵢ·p(stageᵢ)</td>
                  <td className="py-2 pr-4">E[R] = {fmt(pipelineValue.totalExpected)}</td>
                  <td className="py-2"><a href={PDF_URLS.mathematicalFinance} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-indigo-600 inline-flex items-center gap-1 transition-colors">Mathematical Finance Ch. 2–3<ExternalLink className="w-2.5 h-2.5" /></a></td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium">Pareto Tail</td>
                  <td className="py-2 pr-4 font-mono text-muted-foreground">P(m) ~ m^(−α) for m &gt; m₀</td>
                  <td className="py-2 pr-4">Top {pct(boltzmannGibbs.paretoFraction)} → {pct(boltzmannGibbs.paretoRevenueShare)} of revenue</td>
                  <td className="py-2"><a href={PDF_URLS.classicalEconophysics} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-indigo-600 inline-flex items-center gap-1 transition-colors">Classical Econophysics Ch. 8<ExternalLink className="w-2.5 h-2.5" /></a></td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Methodology Modal ── */}
      <MethodologyModal open={methodologyOpen} onClose={() => setMethodologyOpen(false)} />
    </div>
  );
}
