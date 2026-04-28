import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AreaChart, Area, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, ComposedChart,
} from "recharts";
import {
  TrendingUp, TrendingDown, Thermometer, Activity, BarChart2, Sigma,
  Zap, Target, BookOpen, AlertTriangle, ExternalLink, Settings2, Check, X,
  SlidersHorizontal, ChevronRight, ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { WhatIfPanel } from "@/components/crm/WhatIfPanel";
import {
  boltzmannGibbs as computeBoltzmann,
  giniAndLorenz as computeGini,
  revenueEntropy as computeEntropy,
  monteCarloForecast as computeMonteCarlo,
  binomialPipelineValue as computeBinomial,
  economicTemperatureTrend as computeTempTrend,
  poissonDealArrival as computePoisson,
  geometricSalesCycle as computeGeometric,
  bayesianWinRate as computeBayes,
  perRepPoisson as computeRepPoisson,
  survivalHazard as computeSurvival,
  bayesPriorCalibration,
  type ConfidenceLevel,
  WhatIfParams,
  ActuarialWhatIfParams,
  DEFAULT_STAGE_PROBS,
  DEFAULT_ACTUARIAL_PARAMS,
} from "@/lib/econophysicsEngine";

// ─── Constants ────────────────────────────────────────────────────────────────
const PDF_URLS: Record<string, string> = {
  classicalEconophysics: "/manus-storage/classical_econophysics_36239cd1.pdf",
  mathematicalFinance: "/manus-storage/mathematical_finance_wallace_durham_3170cced.pdf",
  finanPV2020: "/manus-storage/finan_probability_actuaries_pv2020_536ebf15.pdf",
};
const STAGE_ORDER = ["lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"];
const fmt = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K` : `$${n.toFixed(0)}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const STAGE_LABELS: Record<string, string> = {
  lead: "Lead", qualified: "Qualified", proposal: "Proposal",
  negotiation: "Negotiation", closed_won: "Closed Won", closed_lost: "Closed Lost",
};
const STAGE_COLORS: Record<string, string> = {
  lead: "#94a3b8", qualified: "#60a5fa", proposal: "#a78bfa",
  negotiation: "#f59e0b", closed_won: "#34d399", closed_lost: "#f87171",
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

// ─── What-If Mode Banner ──────────────────────────────────────────────────────
function WhatIfModeBanner({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 dark:border-indigo-700 px-4 py-2.5">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
        <p className="text-sm font-medium text-indigo-800 dark:text-indigo-300">
          What-if mode — charts and KPIs reflect hypothetical parameters, not live data
        </p>
      </div>
      <Button size="sm" variant="outline" className="text-xs h-7 shrink-0 border-indigo-300 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:text-indigo-300" onClick={onReset}>
        Reset to baseline
      </Button>
    </div>
  );
}

// ─── Delta Badge ──────────────────────────────────────────────────────────────
function DeltaBadge({ current, baseline, isPercent = false }: { current: number; baseline: number; isPercent?: boolean }) {
  if (baseline === 0 || Math.abs(current - baseline) / Math.abs(baseline) < 0.005) return null;
  const delta = current - baseline;
  const relDelta = (delta / Math.abs(baseline)) * 100;
  const positive = delta > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1 py-0.5 rounded ml-1 ${
      positive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
               : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
    }`}>
      {positive ? "▲" : "▼"} {Math.abs(isPercent ? delta * 100 : relDelta).toFixed(1)}{isPercent ? "pp" : "%"}
    </span>
  );
}

// ─── Methodology Modal ────────────────────────────────────────────────────────
const METHODOLOGY_MODELS: { name: string; formula: string; source: string; pdf: string; assumptions: string[]; limitations: string[] }[] = [
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
    assumptions: ["Revenue shares are treated as probabilities over discrete agents.", "Each rep is an independent 'microstate'."],
    limitations: ["Sensitive to the number of reps — more reps mechanically raises maximum entropy.", "Does not distinguish between different types of revenue concentration."],
  },
  {
    name: "Pareto Tail Analysis", formula: "P(m) ~ m^(−α) for m > m₀",
    source: "Classical Econophysics Ch. 8", pdf: "classicalEconophysics" as const,
    assumptions: ["The top deals follow a power-law rather than the exponential Boltzmann-Gibbs body.", "The threshold m₀ is set at the 90th percentile (adjustable in what-if mode)."],
    limitations: ["With fewer than 30 deals, the tail contains only 3 data points — insufficient for a reliable power-law fit.", "The α exponent is not estimated here; only the tail share is reported."],
  },
  {
    name: "Geometric Brownian Motion (GBM)", formula: "dS = μS dt + σS dW",
    source: "Mathematical Finance Ch. 6", pdf: "mathematicalFinance" as const,
    assumptions: ["Revenue follows a log-normal process — log-returns are i.i.d. normal.", "Drift μ and volatility σ are constant over the forecast horizon.", "No jumps, regime changes, or seasonal effects."],
    limitations: ["GBM is a continuous-time model applied to monthly discrete data.", "With fewer than 6 months of history, parameter estimates are unreliable.", "Log-normal assumption breaks down when revenue can be zero or negative."],
  },
  {
    name: "Monte Carlo GBM Forecast", formula: "Sₜ = S₀ · exp((μ−σ²/2)t + σWₜ)",
    source: "Mathematical Finance Ch. 6", pdf: "mathematicalFinance" as const,
    assumptions: ["Each simulated path is an independent realisation of the GBM process.", "The seeded pseudo-random generator (LCG + Box-Muller) produces reproducible results.", "200 paths are sufficient to estimate the 10th–90th percentile band."],
    limitations: ["All paths share the same μ and σ — no parameter uncertainty is modelled.", "The forecast ignores known future events (product launches, seasonality, churn)."],
  },
  {
    name: "Binomial Pipeline Expected Value", formula: "E[R] = Σ vᵢ · p(stageᵢ)",
    source: "Mathematical Finance Ch. 2–3", pdf: "mathematicalFinance",
    assumptions: ["Each deal is an independent Bernoulli trial — win or lose.", "Stage win probabilities are constant across all deals in the same stage.", "Deal values are fixed — no upsell or downsell modelled."],
    limitations: ["Default stage probabilities (10%, 25%, 45%, 70%) are industry benchmarks, not your actuals.", "Ignores deal age, rep quality, and competitive dynamics.", "Independence assumption breaks down when deals share the same account or rep."],
  },
  {
    name: "Poisson Deal-Arrival Model", formula: "P(X=k) = e^(−λ)·λᵏ/k!",
    source: "Finan PV2020 §7.4", pdf: "finanPV2020",
    assumptions: ["Deals arrive independently of each other.", "The arrival rate λ (deals/month) is constant over the observation window.", "E(X) = Var(X) = λ — mean and variance are equal for a Poisson process."],
    limitations: ["Assumes stationarity — seasonal spikes or ramp-up periods violate the constant-λ assumption.", "With fewer than 6 months of data, the λ estimate is unreliable.", "Does not model deal value — only arrival count."],
  },
  {
    name: "Geometric / Negative-Binomial Sales Cycle", formula: "P(X=n) = p·(1−p)^(n−1)",
    source: "Finan PV2020 §7.6–7.7", pdf: "finanPV2020",
    assumptions: ["Each period is an independent Bernoulli trial with constant close probability p.", "E(X) = 1/p — expected number of periods to first close.", "Negative-Binomial extension: time to r-th close follows NB(r, p)."],
    limitations: ["Constant p assumption ignores deal-specific factors (rep skill, account size, competition).", "Geometric distribution has memoryless property — past failures do not change future probability.", "p is estimated from aggregate win rate, not per-deal or per-rep rates."],
  },
  {
    name: "Bayesian Win-Rate Updater", formula: "Posterior ∝ Beta(α₀+W, β₀+L)",
    source: "Finan PV2020 §5.2", pdf: "finanPV2020",
    assumptions: ["Prior belief is modelled as Beta(α₀, β₀) — conjugate prior for Bernoulli likelihood.", "Each deal outcome is an independent Bernoulli trial.", "Law of Total Probability: P(Win) = Σ P(Win|Stage)·P(Stage)."],
    limitations: ["Prior parameters α₀ and β₀ are subjective — the default Uniform(1,1) is non-informative.", "Assumes deal outcomes are exchangeable — ignores rep, product, and account heterogeneity.", "The Beta distribution is a continuous approximation to a discrete win-rate."],
  },
];

function MethodologyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-3 shrink-0">
          <DialogTitle className="text-base font-semibold">Model Methodology</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Assumptions and limitations for all 11 models used on this page.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-3 px-6 pb-3 border-b border-border shrink-0">
          <a href={PDF_URLS.classicalEconophysics} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 transition-colors">
            <ExternalLink className="w-3.5 h-3.5" />Classical Econophysics — Cockshott, Cottrell, Yakovenko et al.
          </a>
          <a href={PDF_URLS.mathematicalFinance} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 transition-colors">
            <ExternalLink className="w-3.5 h-3.5" />Mathematical Finance — Clare Wallace, Durham University
          </a>
          <a href={PDF_URLS.finanPV2020} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 transition-colors">
            <ExternalLink className="w-3.5 h-3.5" />A Probability Course for the Actuaries — Marcel B. Finan (PV2020)
          </a>
        </div>
        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-4">
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
          <div className="pt-4 border-t border-border mt-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">General caveat:</span> All models are descriptive and exploratory.
              They are intended to surface patterns and prompt questions, not to replace human judgment.
              The quality of every output depends directly on the completeness and accuracy of the underlying CRM data.
            </p>
          </div>
        </ScrollArea>
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
          {STAGE_ORDER.map(stage => {
            const prob = stageProbabilities[stage] ?? DEFAULT_STAGE_PROBS[stage] ?? 0;
            const isFixed = stage === "closed_won" || stage === "closed_lost";
            return (
              <div key={stage} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STAGE_COLORS[stage] }} />
                  <span className="text-xs font-medium">{STAGE_LABELS[stage]}</span>
                </div>
                {editing === stage ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number" min={0} max={100} step={0.1}
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") commitEdit(stage); if (e.key === "Escape") setEditing(null); }}
                      className="w-20 h-6 text-xs text-right"
                      autoFocus
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => commitEdit(stage)}><Check className="w-3 h-3 text-emerald-600" /></Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditing(null)}><X className="w-3 h-3 text-red-500" /></Button>
                  </div>
                ) : (
                  <button
                    onClick={() => !isFixed && startEdit(stage, prob)}
                    title={isFixed ? "Fixed value" : "Click to edit"}
                    className={`text-xs font-mono font-semibold px-2 py-0.5 rounded transition-colors ${
                      isFixed ? "text-muted-foreground cursor-default" : "text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
                    }`}
                  >
                    {(prob * 100).toFixed(1)}%
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

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title, source, description }: { title: string; source: string; description: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground border-muted-foreground/30">{source}</Badge>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">{description}</p>
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" ? (p.value > 1000 ? fmt(p.value) : p.value.toFixed(2)) : p.value}
        </p>
      ))}
    </div>
  );
}

// ─── Metric Card ─────────────────────────────────────────────────────────────
function MetricCard({
  title, value, sub, icon: Icon, accent, tooltip,
  baseline, currentNum, baselineNum, isPercent,
}: {
  title: string; value: string; sub: string; icon: any; accent?: boolean; tooltip?: string;
  baseline?: string; currentNum?: number; baselineNum?: number; isPercent?: boolean;
}) {
  return (
    <Card className={`relative overflow-hidden ${accent ? "border-indigo-200 dark:border-indigo-800" : ""}`} title={tooltip}>
      {accent && <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 to-violet-500" />}
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide leading-tight">{title}</p>
          <div className={`p-1.5 rounded-lg ${accent ? "bg-indigo-100 dark:bg-indigo-900/40" : "bg-muted"}`}>
            <Icon className={`w-3.5 h-3.5 ${accent ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground"}`} />
          </div>
        </div>
        <div className="flex items-baseline gap-1 flex-wrap">
          <p className="text-xl font-bold text-foreground tabular-nums">{value}</p>
          {currentNum !== undefined && baselineNum !== undefined && (
            <DeltaBadge current={currentNum} baseline={baselineNum} isPercent={isPercent} />
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 leading-tight">{sub}</p>
        {baseline && baseline !== value && (
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">Baseline: {baseline}</p>
        )}
      </CardContent>
    </Card>
  );
}
// ─── Bayesian Prior Calibration Wizard ────────────────────────────────────────────────────────────────────────────────
function BayesWizardSection({
  onApply,
  wins = 0,
  losses = 0,
}: {
  onApply?: (alpha: number, beta: number) => void;
  wins?: number;
  losses?: number;
}) {
  const [beliefRate, setBeliefRate] = useState(30);
  const [confidence, setConfidence] = useState<ConfidenceLevel>("medium");
  const [applied, setApplied] = useState(false);

  const calibration = useMemo(
    () => bayesPriorCalibration(beliefRate / 100, confidence),
    [beliefRate, confidence]
  );

  // Live posterior: update prior with observed wins/losses
  const posteriorAlpha = calibration.alpha + wins;
  const posteriorBeta = calibration.beta + losses;
  const posteriorMean = posteriorAlpha / (posteriorAlpha + posteriorBeta);
  const posteriorCurve = useMemo(() => {
    const pts: { p: number; prior: number; posterior: number }[] = [];
    for (let i = 0; i <= 100; i++) {
      const p = i / 100;
      const priorDensity = calibration.curve[i]?.density ?? 0;
      // Beta PDF: p^(a-1) * (1-p)^(b-1) / B(a,b) — approximate via ratio
      const logB = (a: number, b: number) => {
        const logGamma = (n: number): number => {
          if (n < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * n)) - logGamma(1 - n);
          n -= 1;
          let x = 0.99999999999980993;
          const c = [676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
          for (let k = 0; k < 8; k++) x += c[k]! / (n + k + 1);
          const t = n + 7.5;
          return 0.5 * Math.log(2 * Math.PI) + (n + 0.5) * Math.log(t) - t + Math.log(x);
        };
        return logGamma(a) + logGamma(b) - logGamma(a + b);
      };
      const postDensity = p === 0 || p === 1 ? 0 :
        Math.exp((posteriorAlpha - 1) * Math.log(p) + (posteriorBeta - 1) * Math.log(1 - p) - logB(posteriorAlpha, posteriorBeta));
      pts.push({ p, prior: priorDensity, posterior: isFinite(postDensity) ? postDensity : 0 });
    }
    return pts;
  }, [calibration, posteriorAlpha, posteriorBeta]);

  const handleApply = () => {
    onApply?.(calibration.alpha, calibration.beta);
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  };

  const confidenceOptions: { value: ConfidenceLevel; label: string; desc: string }[] = [
    { value: "low",       label: "Low",       desc: "~5 effective obs." },
    { value: "medium",    label: "Medium",    desc: "~20 effective obs." },
    { value: "high",      label: "High",      desc: "~50 effective obs." },
    { value: "very_high", label: "Very High", desc: "~100 effective obs." },
  ];

  return (
    <div>
      <SectionHeader
        title="Bayesian Prior Calibration Wizard"
        source="Finan PV2020 §5.2 — Method of moments: α = μκ, β = (1−μ)κ"
        description="Convert a plain-English belief about win rate and confidence into Beta(α, β) prior parameters. The concentration κ controls how strongly the prior resists updating."
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Controls */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Prior Belief</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Believed Win Rate: <span className="font-semibold text-foreground">{beliefRate}%</span></label>
                <input
                  type="range" min={1} max={99} value={beliefRate}
                  onChange={e => setBeliefRate(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                  <span>1%</span><span>50%</span><span>99%</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-2">Confidence Level</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {confidenceOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setConfidence(opt.value)}
                      className={`text-xs px-2 py-1.5 rounded border transition-colors ${
                        confidence === opt.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-transparent border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-[10px] opacity-70">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 gap-2">
            <MetricCard title="α (prior wins)" value={calibration.alpha.toFixed(1)} sub={`α = ${(beliefRate/100).toFixed(2)} × κ`} icon={Target} accent tooltip="Prior successes parameter of Beta distribution." />
            <MetricCard title="β (prior losses)" value={calibration.beta.toFixed(1)} sub={`β = ${(1-beliefRate/100).toFixed(2)} × κ`} icon={Target} tooltip="Prior failures parameter of Beta distribution." />
            <MetricCard title="Prior Mean" value={`${(calibration.priorMean * 100).toFixed(1)}%`} sub="α/(α+β)" icon={Activity} tooltip="Expected win rate under the prior." />
            <MetricCard title="90% Prior CI" value={`${(calibration.ci90Low*100).toFixed(0)}–${(calibration.ci90High*100).toFixed(0)}%`} sub="5th–95th percentile" icon={BarChart2} tooltip="90% of the prior probability mass falls in this range." />
          </div>
        </div>
        {/* Chart + Apply */}
        <div className="lg:col-span-2 space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Prior vs. Live Posterior — Beta(α₀={calibration.alpha.toFixed(1)}, β₀={calibration.beta.toFixed(1)})</CardTitle>
                <button
                  onClick={handleApply}
                  className={`text-xs px-3 py-1.5 rounded font-medium transition-all ${
                    applied
                      ? "bg-green-500/20 text-green-400 border border-green-500/40"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                >
                  {applied ? "✓ Applied to What-if" : "Apply to What-if Panel"}
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={posteriorCurve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="p" tickFormatter={(v) => `${(v*100).toFixed(0)}%`} tick={{ fontSize: 10 }} label={{ value: "Win Rate p", position: "insideBottom", offset: -2, fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number, name: string) => [v.toFixed(3), name === 'prior' ? 'Prior density' : 'Posterior density']} labelFormatter={(l: number) => `p = ${(l*100).toFixed(0)}%`} />
                  <Legend />
                  <Area type="monotone" dataKey="prior" stroke="#6366f1" fill="rgba(99,102,241,0.15)" name="Prior" dot={false} strokeDasharray="4 2" />
                  <Area type="monotone" dataKey="posterior" stroke="#10b981" fill="rgba(16,185,129,0.15)" name="Posterior" dot={false} />
                  <ReferenceLine x={calibration.priorMean} stroke="#6366f1" strokeDasharray="3 2" label={{ value: `Prior mean ${(calibration.priorMean*100).toFixed(0)}%`, fontSize: 9, fill: "#6366f1" }} />
                  <ReferenceLine x={posteriorMean} stroke="#10b981" strokeDasharray="3 2" label={{ value: `Post. mean ${(posteriorMean*100).toFixed(0)}%`, fontSize: 9, fill: "#10b981" }} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="mt-3 p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Posterior preview: </span>
                Beta(α₀+W, β₀+L) = Beta({posteriorAlpha.toFixed(1)}, {posteriorBeta.toFixed(1)}) after {wins} wins and {losses} losses from your pipeline.
                Click <span className="font-medium text-foreground">Apply to What-if Panel</span> to seed the Bayesian Win-Rate Updater with α₀ = <span className="font-mono text-primary">{calibration.alpha.toFixed(1)}</span>, β₀ = <span className="font-mono text-primary">{calibration.beta.toFixed(1)}</span>.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────────────────────
export default function Econophysics() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  const { data, isLoading } = trpc.econophysics.full.useQuery(undefined, { staleTime: 60_000 });
  const { data: stageProbData } = trpc.stageProbabilities.get.useQuery(undefined, { staleTime: 30_000 });

  // ── Derive baseline params from server data ──────────────────────────────
  const baselineParams = useMemo<WhatIfParams>(() => {
    const serverProbs = stageProbData ?? DEFAULT_STAGE_PROBS;
    const gbm = data?.gbmParams;
    const dealValues = data?.boltzmannGibbs?.histogram?.flatMap((b: any) => Array(Math.max(0, b.count ?? 0)).fill(b.bin ?? 0)).filter((v: number) => v > 0) ?? [];
    const avgDeal = dealValues.length > 0 ? dealValues.reduce((s: number, v: number) => s + v, 0) / dealValues.length : 100_000;
    const dealCount = dealValues.length || 10;
    return {
      muAnnual: gbm?.mu ?? 0.3,
      sigmaAnnual: gbm?.sigma ?? 0.2,
      horizonMonths: 6,
      nPaths: 200,
      paretoPercentile: 0.9,
      stageProbabilities: { ...DEFAULT_STAGE_PROBS, ...serverProbs },
      avgDealValue: Math.round(avgDeal),
      dealCount,
    };
  }, [data, stageProbData]);

  const [whatIfParams, setWhatIfParams] = useState<WhatIfParams | null>(null);
  const [actuarialParams, setActuarialParams] = useState<ActuarialWhatIfParams>(DEFAULT_ACTUARIAL_PARAMS);
  const activeParams = whatIfParams ?? baselineParams;
  const isWhatIfMode = whatIfParams !== null;

  const handleParamsChange = useCallback((p: WhatIfParams) => {
    setWhatIfParams(p);
  }, []);

  const handleReset = useCallback(() => {
    setWhatIfParams(null);
  }, []);

  // ── All useMemo hooks ABOVE early returns (Rules of Hooks) ──────────────
  const serverBGData = (data as any)?.boltzmannGibbs;
  const serverRepRevenues: any[] = (data as any)?.repRevenues ?? [];
  const serverMonthlySeries: any[] = (data as any)?.monthlySeries ?? [];
  const serverAllDeals: any[] = (data as any)?.allDeals ?? [];
  const serverPoissonArrival = (data as any)?.poissonArrival;
  const serverGeometricCycle = (data as any)?.geometricCycle;
  const serverBayesianWinRate = (data as any)?.bayesianWinRate;
  const serverRepPoisson = (data as any)?.repPoisson;
  const serverSurvival = (data as any)?.survival;

  // ── Actuarial model computations ────────────────────────────────────────────
  const wiPoisson = useMemo(() =>
    computePoisson(serverMonthlySeries.map((m: any) => m.dealCount ?? 0), actuarialParams.poissonLambda),
    [serverMonthlySeries, actuarialParams.poissonLambda]
  );
  const wiGeometric = useMemo(() => {
    const wins = serverBayesianWinRate?.wins ?? 0;
    const totalPeriods = Math.max(1, serverMonthlySeries.length);
    return computeGeometric(wins, totalPeriods, actuarialParams.quotaTarget, actuarialParams.closeRatePerPeriod);
  }, [serverBayesianWinRate, serverMonthlySeries, actuarialParams.quotaTarget, actuarialParams.closeRatePerPeriod]);
  const wiBayes = useMemo(() => {
    const wins = serverBayesianWinRate?.wins ?? 0;
    const losses = serverBayesianWinRate?.losses ?? 0;
    return computeBayes(wins, losses, actuarialParams.bayesPriorAlpha, actuarialParams.bayesPriorBeta);
  }, [serverBayesianWinRate, actuarialParams.bayesPriorAlpha, actuarialParams.bayesPriorBeta]);

  const syntheticDealValues = useMemo(() => {
    if (!isWhatIfMode) return null;
    const T = activeParams.avgDealValue;
    const n = activeParams.dealCount;
    const values: number[] = [];
    let seed = 12345;
    for (let i = 0; i < n; i++) {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      const u = Math.max((seed >>> 0) / 0xffffffff, 1e-10);
      values.push(Math.round(-T * Math.log(u)));
    }
    return values;
  }, [isWhatIfMode, activeParams.avgDealValue, activeParams.dealCount]);

  const realDealValues = useMemo(() =>
    serverBGData?.histogram?.flatMap((b: any) => Array(Math.max(0, b.count ?? 0)).fill(b.bin ?? 0)).filter((v: number) => v > 0) ?? [],
    [serverBGData]
  );
  const wiDealValues = syntheticDealValues ?? realDealValues;

  const wiBG = useMemo(() =>
    wiDealValues.length > 0 ? computeBoltzmann(wiDealValues, activeParams.paretoPercentile) : null,
    [wiDealValues, activeParams.paretoPercentile]
  );
  const wiGini = useMemo(() =>
    serverRepRevenues.length > 0 ? computeGini(serverRepRevenues.map((r: any) => r.revenue)) : null,
    [serverRepRevenues]
  );
  const wiEntropy = useMemo(() =>
    serverRepRevenues.length > 0 ? computeEntropy(serverRepRevenues.map((r: any) => r.revenue)) : null,
    [serverRepRevenues]
  );

  const s0Hook = serverMonthlySeries.length > 0 ? serverMonthlySeries[serverMonthlySeries.length - 1].totalValue : 100_000;

  const wiForecast = useMemo(() =>
    computeMonteCarlo(s0Hook, activeParams.muAnnual, activeParams.sigmaAnnual, activeParams.horizonMonths, activeParams.nPaths),
    [s0Hook, activeParams.muAnnual, activeParams.sigmaAnnual, activeParams.horizonMonths, activeParams.nPaths]
  );
  const wiPipeline = useMemo(() =>
    computeBinomial(serverAllDeals, activeParams.stageProbabilities),
    [serverAllDeals, activeParams.stageProbabilities]
  );
  const baseBG = useMemo(() =>
    realDealValues.length > 0 ? computeBoltzmann(realDealValues, 0.9) : null,
    [realDealValues]
  );
  const baseForecast = useMemo(() =>
    computeMonteCarlo(s0Hook, baselineParams.muAnnual, baselineParams.sigmaAnnual, 6, 200),
    [s0Hook, baselineParams.muAnnual, baselineParams.sigmaAnnual]
  );
  const basePipeline = useMemo(() =>
    computeBinomial(serverAllDeals, baselineParams.stageProbabilities),
    [serverAllDeals, baselineParams.stageProbabilities]
  );


  // ── Sync baseline into whatIfParams once data loads ──────────────────────
  // (don't auto-set — let user explicitly open what-if)

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div><Skeleton className="h-7 w-64 mb-2" /><Skeleton className="h-4 w-96" /></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }
  if (!data) return null;

  const { boltzmannGibbs: serverBG, gini: serverGini, entropy: serverEntropy, gbmParams, forecast: serverForecast, pipelineValue: serverPipeline, temperatureTrend, repRevenues, monthlySeries } = data as any;

  // Actuarial display data
  const displayPoisson = wiPoisson;
  const displayGeometric = wiGeometric;
  const displayBayes = wiBayes;

  // ── Data quality checks ──────────────────────────────────────────────────
  const dealCount = serverBG.histogram.reduce((s: number, b: any) => s + b.count, 0);
  const monthCount = monthlySeries.filter((m: any) => m.totalValue > 0).length;

  // Use what-if values for display
  const displayBG = (isWhatIfMode && wiBG) ? wiBG : serverBG;
  const displayGini = wiGini ?? serverGini;
  const displayEntropy = wiEntropy ?? serverEntropy;
  const displayForecast = isWhatIfMode ? wiForecast : serverForecast;
  const displayPipeline = isWhatIfMode ? wiPipeline : serverPipeline;

  // ── Chart data ────────────────────────────────────────────────────────────
  const lorenzData = (displayGini?.lorenz ?? []).filter((_: unknown, i: number) => i % Math.max(1, Math.floor((displayGini?.lorenz?.length ?? 1) / 20)) === 0)
    .map((p: { population: number; wealthShare: number }) => ({
      population: Math.round(p.population * 100),
      wealthShare: Math.round(p.wealthShare * 100),
      equalLine: Math.round(p.population * 100),
    }));

  const forecastLabels = Array.from({ length: activeParams.horizonMonths + 1 }, (_, i) => i === 0 ? "Now" : `+${i}mo`);
  const forecastData = displayForecast.median.map((med: number, i: number) => ({
    month: forecastLabels[i] ?? `+${i}mo`,
    median: med,
    p10: displayForecast.p10[i],
    p90: displayForecast.p90[i],
    p25: displayForecast.p25[i],
    p75: displayForecast.p75[i],
  }));

  const pipelineData = displayPipeline.byStage
    .filter((s: any) => s.stage !== "closed_lost")
    .sort((a: any, b: any) => b.faceValue - a.faceValue)
    .map((s: any) => ({
      stage: STAGE_LABELS[s.stage] ?? s.stage,
      faceValue: s.faceValue,
      expectedValue: s.expectedValue,
      probability: Math.round(s.probability * 100),
      fill: STAGE_COLORS[s.stage] ?? "#94a3b8",
    }));

  const tempData = temperatureTrend.slice(-12).map((t: any) => ({ label: t.label, temperature: t.temperature }));
  const revenueData = monthlySeries.slice(-12).map((m: any) => ({ label: m.label, revenue: m.totalValue }));

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Main content area ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-8 max-w-6xl">
          {/* ── Page Header ── */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-foreground mb-1">Econophysics Analytics</h1>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Statistical physics and mathematical finance models applied to CRM data. Based on{" "}
                <a href={PDF_URLS.classicalEconophysics} target="_blank" rel="noopener noreferrer"
                  className="font-medium text-foreground hover:text-indigo-600 inline-flex items-center gap-0.5 transition-colors">
                  Classical Econophysics<ExternalLink className="w-3 h-3 ml-0.5" />
                </a>{" "}and{" "}
                <a href={PDF_URLS.mathematicalFinance} target="_blank" rel="noopener noreferrer"
                  className="font-medium text-foreground hover:text-indigo-600 inline-flex items-center gap-0.5 transition-colors">
                  Mathematical Finance<ExternalLink className="w-3 h-3 ml-0.5" />
                </a>.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setMethodologyOpen(true)}>
                <BookOpen className="w-3.5 h-3.5" />Read methodology
              </Button>
              <Button
                size="sm"
                className={`gap-1.5 text-xs ${isWhatIfMode ? "bg-indigo-600 hover:bg-indigo-700 text-white" : ""}`}
                variant={isWhatIfMode ? "default" : "outline"}
                onClick={() => { setPanelOpen(v => !v); if (!panelOpen && !whatIfParams) setWhatIfParams({ ...baselineParams }); }}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                What-if
                {panelOpen ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
              </Button>
            </div>
          </div>

          {/* ── Banners ── */}
          <DataQualityBanner dealCount={dealCount} monthCount={monthCount} />
          {isWhatIfMode && <WhatIfModeBanner onReset={handleReset} />}

          {/* ── Top KPI Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              title="Economic Temperature"
              value={fmt(displayBG.temperature)}
              baseline={isWhatIfMode ? fmt(baseBG?.temperature ?? 0) : undefined}
              currentNum={displayBG.temperature}
              baselineNum={baseBG?.temperature ?? 0}
              sub="T = M/N — mean deal value per agent"
              icon={Thermometer} accent
              tooltip="Analogous to thermodynamic temperature. Higher T = more 'hot money' per deal."
            />
            <MetricCard
              title="Gini Coefficient"
              value={displayGini.gini.toFixed(3)}
              sub={displayGini.interpretation}
              icon={Activity}
              tooltip="Measures revenue inequality across reps. Gini = 0.5 for pure Boltzmann-Gibbs equilibrium."
            />
            <MetricCard
              title="Revenue Entropy"
              value={`${pct(displayEntropy.normalizedEntropy)} S/S_max`}
              sub={displayEntropy.interpretation}
              icon={Sigma}
              tooltip="S = −Σ p_i·ln(p_i). Maximum entropy = perfectly equal distribution."
            />
            <MetricCard
              title="Pareto Tail Share"
              value={pct(displayBG.paretoRevenueShare)}
              baseline={isWhatIfMode ? pct(baseBG?.paretoRevenueShare ?? 0) : undefined}
              currentNum={displayBG.paretoRevenueShare}
              baselineNum={baseBG?.paretoRevenueShare ?? 0}
              isPercent
              sub={`Top ${pct(displayBG.paretoFraction)} of deals by value`}
              icon={BarChart2}
              tooltip="Deals above the Pareto threshold follow a power-law rather than the exponential body."
            />
            <MetricCard
              title="GBM Drift (μ)"
              value={`${(activeParams.muAnnual * 100).toFixed(1)}% /yr`}
              baseline={isWhatIfMode ? `${(baselineParams.muAnnual * 100).toFixed(1)}% /yr` : undefined}
              currentNum={activeParams.muAnnual}
              baselineNum={baselineParams.muAnnual}
              isPercent
              sub="Expected annual revenue growth rate"
              icon={TrendingUp}
              tooltip="μ = annualised mean log-return. From GBM: S_t = S_0·exp((μ−σ²/2)t + σW_t)."
            />
            <MetricCard
              title="GBM Volatility (σ)"
              value={`${(activeParams.sigmaAnnual * 100).toFixed(1)}% /yr`}
              baseline={isWhatIfMode ? `${(baselineParams.sigmaAnnual * 100).toFixed(1)}% /yr` : undefined}
              currentNum={activeParams.sigmaAnnual}
              baselineNum={baselineParams.sigmaAnnual}
              isPercent
              sub="Annualised revenue volatility"
              icon={Zap}
              tooltip="σ = std(log-returns)·√12. Measures unpredictability of revenue growth."
            />
            <MetricCard
              title="Pipeline Expected Value"
              value={fmt(displayPipeline.totalExpected)}
              baseline={isWhatIfMode ? fmt(basePipeline.totalExpected) : undefined}
              currentNum={displayPipeline.totalExpected}
              baselineNum={basePipeline.totalExpected}
              sub={`${pct(displayPipeline.weightedConversionRate)} weighted conversion`}
              icon={Target} accent
              tooltip="E[Revenue] = Σ deal_value × P(win|stage). Binomial model."
            />
            <MetricCard
              title={`GBM ${activeParams.horizonMonths}-Month Forecast`}
              value={fmt(displayForecast.expectedFinal)}
              baseline={isWhatIfMode ? fmt(baseForecast.expectedFinal) : undefined}
              currentNum={displayForecast.expectedFinal}
              baselineNum={baseForecast.expectedFinal}
              sub={`E[S_T] = S_0·exp(μ·T), median of ${activeParams.nPaths} paths`}
              icon={TrendingUp}
              tooltip="Monte Carlo simulation using estimated μ and σ."
            />
          </div>

          {/* ── Section 1: Boltzmann-Gibbs Distribution ── */}
          <div>
            <SectionHeader
              title="Boltzmann-Gibbs Distribution of Deal Values"
              source="Classical Econophysics Ch. 8 — Dragulescu & Yakovenko (2000)"
              description={`P(m) = (1/T)·exp(−m/T) where T = ${fmt(displayBG.temperature)}. Bars = observed deal values; line = theoretical fit. Pareto threshold at ${Math.round(activeParams.paretoPercentile * 100)}th percentile (${fmt(displayBG.paretoThreshold)}).`}
            />
            <Card>
              <CardContent className="pt-5 pb-3">
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={displayBG.histogram} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="bin" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="count" name="Observed count" fill="#6366f1" opacity={0.75} radius={[3, 3, 0, 0]} />
                    <Line dataKey="expected" name="Boltzmann-Gibbs fit" stroke="#f59e0b" strokeWidth={2.5} dot={false} type="monotone" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* ── Section 2: Lorenz Curve ── */}
          <div>
            <SectionHeader
              title="Lorenz Curve — Revenue Concentration Across Sales Reps"
              source="Classical Econophysics Ch. 8, 13 — Gini coefficient"
              description={`Gini = ${displayGini.gini.toFixed(3)}. ${displayGini.interpretation}. For a pure Boltzmann-Gibbs distribution, Gini = 0.5.`}
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Lorenz Curve</CardTitle></CardHeader>
                <CardContent className="pt-0 pb-3">
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={lorenzData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="population" tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} label={{ value: "Population %", position: "insideBottom", offset: -3, fontSize: 11 }} />
                      <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} label={{ value: "Revenue %", angle: -90, position: "insideLeft", fontSize: 11 }} />
                      <Tooltip formatter={(v: any, name: string) => [`${v}%`, name]} labelFormatter={l => `Population: ${l}%`} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line dataKey="equalLine" name="Perfect equality" stroke="#94a3b8" strokeDasharray="5 3" strokeWidth={1.5} dot={false} />
                      <Area dataKey="wealthShare" name="Actual revenue share" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} strokeWidth={2} dot={false} type="monotone" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Revenue per Rep</CardTitle></CardHeader>
                <CardContent className="pt-0 pb-3">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={[...repRevenues].sort((a: any, b: any) => b.revenue - a.revenue)} margin={{ top: 5, right: 20, left: 10, bottom: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="repName" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} angle={-30} textAnchor="end" interval={0} />
                      <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ── Section 3: GBM Monte Carlo ── */}
          <div>
            <SectionHeader
              title={`GBM Monte Carlo Revenue Forecast (${activeParams.horizonMonths} Months)`}
              source="Mathematical Finance Ch. 6 — Black-Scholes / Geometric Brownian Motion"
              description={`S_t = S_0·exp((μ−σ²/2)·t + σ·W_t) with μ = ${(activeParams.muAnnual * 100).toFixed(1)}%/yr and σ = ${(activeParams.sigmaAnnual * 100).toFixed(1)}%/yr. ${activeParams.nPaths} Monte Carlo paths. Expected final: ${fmt(displayForecast.expectedFinal)}.`}
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
                    <Area dataKey="p90" name="90th pct" stroke="transparent" fill="#6366f1" fillOpacity={0.08} />
                    <Area dataKey="p75" name="75th pct" stroke="transparent" fill="#6366f1" fillOpacity={0.12} />
                    <Area dataKey="p25" name="25th pct" stroke="transparent" fill="#6366f1" fillOpacity={0.12} />
                    <Area dataKey="p10" name="10th pct" stroke="transparent" fill="#6366f1" fillOpacity={0.08} />
                    <Line dataKey="median" name="Median path" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3, fill: "#6366f1" }} type="monotone" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* ── Section 4: Binomial Pipeline EV ── */}
          <div>
            <SectionHeader
              title="Binomial Pipeline Expected Value"
              source="Mathematical Finance Ch. 2–3 — Binomial model & risk-neutral valuation"
              description={`E[R] = Σ vᵢ·p(stageᵢ). Total face value: ${fmt(displayPipeline.totalFaceValue)}. Weighted expected value: ${fmt(displayPipeline.totalExpected)} (${pct(displayPipeline.weightedConversionRate)} conversion).`}
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
              description="T(t) = total deal value / number of deals per period. Rising T = larger deals on average. Falling T may signal market cooling or a shift to higher-volume smaller deals."
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Temperature T(t) Over Time</CardTitle></CardHeader>
                <CardContent className="pt-0 pb-3">
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={tempData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area dataKey="temperature" name="Economic temperature T" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} strokeWidth={2} type="monotone" dot={{ r: 3, fill: "#f59e0b" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Monthly Revenue (Historical)</CardTitle></CardHeader>
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

          {/* ── Section 6: Poisson Deal-Arrival Model ── */}
          <div>
            <SectionHeader
              title="Poisson Deal-Arrival Model"
              source="Finan PV2020 §7.4 — Poisson distribution"
              description={`P(X=k) = e^(−λ)·λᵏ/k! where λ = ${displayPoisson.lambda} deals/month. Mode = ${displayPoisson.mode} deals. 90% CI: [${displayPoisson.ci90Low}, ${displayPoisson.ci90High}]. E(X) = Var(X) = λ.`}
            />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Probability Mass Function P(X = k)</CardTitle></CardHeader>
                  <CardContent className="pt-0 pb-3">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart
                        data={displayPoisson.pmf.filter((e: any) => e.probability > 0.001).slice(0, 25)}
                        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="k" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} label={{ value: "Deals per month (k)", position: "insideBottom", offset: -3, fontSize: 11 }} />
                        <YAxis tickFormatter={(v: number) => v.toFixed(2)} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="probability" name="P(X=k)" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                        <ReferenceLine x={displayPoisson.mode} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: "Mode", fontSize: 10, fill: "#f59e0b" }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
              <div className="space-y-3">
                <MetricCard title="Arrival Rate λ" value={`${displayPoisson.lambda} deals/mo`} sub="E(X) = Var(X) = λ" icon={Activity} accent tooltip="Poisson rate parameter — estimated as mean of monthly deal counts." />
                <MetricCard title="Most Likely Count" value={`${displayPoisson.mode} deals`} sub="Mode = ⌊λ⌋ for λ > 1" icon={Target} tooltip="The most probable number of deals in any given month." />
                <MetricCard title="90% Confidence Interval" value={`[${displayPoisson.ci90Low}, ${displayPoisson.ci90High}]`} sub="5th–95th percentile range" icon={BarChart2} tooltip="90% of months should fall within this deal-count range." />
              </div>
            </div>
          </div>

          {/* ── Section 7: Geometric / Negative-Binomial Sales Cycle ── */}
          <div>
            <SectionHeader
              title="Geometric & Negative-Binomial Sales Cycle"
              source="Finan PV2020 §7.6–7.7 — Geometric and Negative-Binomial distributions"
              description={`P(X=n) = p·(1−p)^(n−1) where p = ${(displayGeometric.closeRatePerPeriod * 100).toFixed(1)}%/month. E(X) = ${displayGeometric.expectedCycleMonths} months to first close. Time to ${displayGeometric.quotaTarget} closes: E(Y) = ${displayGeometric.expectedMonthsToQuota} months.`}
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Geometric PMF — Months to First Close</CardTitle></CardHeader>
                <CardContent className="pt-0 pb-3">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={displayGeometric.pmf.filter((e: any) => e.probability > 0.001).slice(0, 20)}
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="n" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} label={{ value: "Months (n)", position: "insideBottom", offset: -3, fontSize: 11 }} />
                      <YAxis tickFormatter={(v: number) => v.toFixed(2)} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="probability" name="P(X=n)" fill="#10b981" radius={[3, 3, 0, 0]} />
                      <Line dataKey="cumulative" name="Cumulative" stroke="#f59e0b" strokeWidth={2} dot={false} type="monotone" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Negative-Binomial PMF — Months to {displayGeometric.quotaTarget} Closes</CardTitle></CardHeader>
                <CardContent className="pt-0 pb-3">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={displayGeometric.nbPmf.filter((e: any) => e.probability > 0.001).slice(0, 25)}
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="n" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} label={{ value: "Months (n)", position: "insideBottom", offset: -3, fontSize: 11 }} />
                      <YAxis tickFormatter={(v: number) => v.toFixed(3)} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="probability" name={`P(Y=n | r=${displayGeometric.quotaTarget})`} fill="#06b6d4" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <MetricCard title="Close Rate p" value={`${(displayGeometric.closeRatePerPeriod * 100).toFixed(1)}%/mo`} sub="Bernoulli probability per period" icon={Target} accent />
              <MetricCard title="Expected Cycle" value={`${displayGeometric.expectedCycleMonths} mo`} sub="E(X) = 1/p — months to first close" icon={Activity} />
              <MetricCard title="Variance" value={displayGeometric.varianceCycles.toFixed(2)} sub="Var(X) = (1−p)/p²" icon={Sigma} />
              <MetricCard title={`Time to ${displayGeometric.quotaTarget} Closes`} value={`${displayGeometric.expectedMonthsToQuota} mo`} sub={`E(Y) = r/p where r = ${displayGeometric.quotaTarget}`} icon={TrendingUp} accent />
            </div>
          </div>

          {/* ── Section 8: Bayesian Win-Rate Updater ── */}
          <div>
            <SectionHeader
              title="Bayesian Win-Rate Updater"
              source="Finan PV2020 §5.2 — Bayes' formula & Law of Total Probability"
              description={`Prior: Beta(${displayBayes.priorAlpha}, ${displayBayes.priorBeta}). Posterior: Beta(${displayBayes.posteriorAlpha.toFixed(1)}, ${displayBayes.posteriorBeta.toFixed(1)}) after ${displayBayes.wins} wins and ${displayBayes.losses} losses. Posterior mean win rate: ${(displayBayes.posteriorMean * 100).toFixed(1)}%.`}
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Prior vs Posterior Beta Distribution</CardTitle></CardHeader>
                <CardContent className="pt-0 pb-3">
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart
                      data={displayBayes.posteriorCurve.map((pt: any, i: number) => ({
                        p: pt.p,
                        prior: displayBayes.priorCurve[i]?.density ?? 0,
                        posterior: pt.density,
                      }))}
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="p" tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} label={{ value: "Win rate p", position: "insideBottom", offset: -3, fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area dataKey="prior" name="Prior Beta(α₀,β₀)" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.2} strokeWidth={1.5} dot={false} type="monotone" />
                      <Area dataKey="posterior" name="Posterior Beta(α,β)" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} dot={false} type="monotone" />
                      <ReferenceLine x={displayBayes.posteriorMean} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: "Mean", fontSize: 10, fill: "#f59e0b" }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Law of Total Probability — Stage Decomposition</CardTitle></CardHeader>
                <CardContent className="pt-0 pb-3">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={displayBayes.stageDecomposition}
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="stage" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip formatter={(v: any) => [`${(Number(v) * 100).toFixed(1)}%`]} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="stageShare" name="P(Stage)" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="stageWinRate" name="P(Win|Stage)" fill="#6366f1" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="contribution" name="P(Win∩Stage)" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <MetricCard title="Posterior Mean" value={`${(displayBayes.posteriorMean * 100).toFixed(1)}%`} sub={`Beta(${displayBayes.posteriorAlpha.toFixed(1)}, ${displayBayes.posteriorBeta.toFixed(1)}) mean`} icon={Target} accent tooltip="E[p | data] = (α₀+W)/(α₀+β₀+W+L)" />
              <MetricCard title="MAP Estimate" value={`${(displayBayes.posteriorMode * 100).toFixed(1)}%`} sub="Maximum a posteriori win rate" icon={Activity} tooltip="Mode of posterior Beta distribution." />
              <MetricCard title="90% Credible Interval" value={`${(displayBayes.ci90Low * 100).toFixed(1)}%–${(displayBayes.ci90High * 100).toFixed(1)}%`} sub="5th–95th percentile of posterior" icon={BarChart2} tooltip="There is 90% posterior probability that the true win rate lies in this interval." />
              <MetricCard title="P(Win) — Total Probability" value={`${(displayBayes.totalProbabilityWin * 100).toFixed(1)}%`} sub="P(Win) = Σ P(Win|Stage)·P(Stage)" icon={Sigma} accent tooltip="Law of Total Probability decomposition across pipeline stages." />
            </div>
          </div>

          {/* ── Section 9: Per-Rep Poisson λ Breakdown ── */}
          <div>
            <SectionHeader
              title="Per-Rep Poisson λ Breakdown"
              source="Finan PV2020 §7.4 — Each rep modelled as independent Poisson process"
              description="λᵢ = mean monthly closed-won deals for rep i. Reps with high λ drive deal volume; CV measures dispersion across the team."
            />
            {serverRepPoisson && serverRepPoisson.reps && serverRepPoisson.reps.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <MetricCard title="Team Total λ" value={`${serverRepPoisson.totalLambda} deals/mo`} sub="Sum of all rep arrival rates" icon={Activity} accent tooltip="Total expected deals per month across all reps." />
                  <MetricCard title="Top Contributor" value={serverRepPoisson.topRep} sub={`λ = ${serverRepPoisson.reps.find((r: any) => r.repName === serverRepPoisson.topRep)?.lambda ?? 0}`} icon={TrendingUp} tooltip="Rep with the highest monthly deal arrival rate." />
                  <MetricCard title="λ Dispersion (CV)" value={`${(serverRepPoisson.lambdaCV * 100).toFixed(1)}%`} sub="Coefficient of variation across reps" icon={BarChart2} tooltip="CV = σ(λ)/μ(λ). High CV means deal volume is concentrated in a few reps." />
                </div>
                <Card>
                  <CardContent className="pt-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Rep</th>
                            <th className="text-right py-2 pr-4 font-medium text-muted-foreground">λ (deals/mo)</th>
                            <th className="text-right py-2 pr-4 font-medium text-muted-foreground">Mode</th>
                            <th className="text-right py-2 pr-4 font-medium text-muted-foreground">90% CI</th>
                            <th className="text-right py-2 font-medium text-muted-foreground">Team Share</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {[...serverRepPoisson.reps].sort((a: any, b: any) => b.lambda - a.lambda).map((rep: any) => (
                            <tr key={rep.repName}>
                              <td className="py-2 pr-4 font-medium">{rep.repName}</td>
                              <td className="py-2 pr-4 text-right tabular-nums">{rep.lambda}</td>
                              <td className="py-2 pr-4 text-right tabular-nums">{rep.mode}</td>
                              <td className="py-2 pr-4 text-right tabular-nums">[{rep.ci90Low}, {rep.ci90High}]</td>
                              <td className="py-2 text-right tabular-nums">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 bg-muted rounded-full h-1.5">
                                    <div className="bg-primary h-1.5 rounded-full" style={{ width: `${Math.min(100, rep.share * 100)}%` }} />
                                  </div>
                                  <span>{(rep.share * 100).toFixed(1)}%</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg">No per-rep closed-won deal data available. Add deals with assigned reps to see the Poisson breakdown.</div>
            )}
          </div>

          {/* ── Section 10: Survival / Hazard Function for Deal Age ── */}
          <div>
            <SectionHeader
              title="Deal Age Survival & Hazard Function"
              source="Finan PV2020 §13 — Kaplan-Meier estimator: S(t) = Π(1 − dᵢ/nᵢ)"
              description={`Kaplan-Meier survival curve across all deals. Median survival: ${serverSurvival?.medianSurvival ?? 0} months. Restricted mean: ${serverSurvival?.meanSurvival ?? 0} months. Deals still open are right-censored.`}
            />
            {serverSurvival && serverSurvival.kmCurve && serverSurvival.kmCurve.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Kaplan-Meier Survival Curve S(t)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <ComposedChart data={serverSurvival.kmCurve}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="t" tick={{ fontSize: 10 }} label={{ value: "Age (months)", position: "insideBottom", offset: -2, fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                          <Tooltip formatter={(v: number, name: string) => [name === 'survival' ? `${(v * 100).toFixed(1)}%` : v.toFixed(3), name === 'survival' ? 'S(t)' : 'h(t)']} labelFormatter={(l) => `Month ${l}`} />
                          <Legend />
                          <Area type="stepAfter" dataKey="survival" stroke="#6366f1" fill="rgba(99,102,241,0.15)" name="S(t)" dot={false} />
                          <Line type="stepAfter" dataKey="hazard" stroke="#f59e0b" dot={false} name="h(t)" strokeDasharray="4 2" />
                          <ReferenceLine x={serverSurvival.medianSurvival} stroke="#10b981" strokeDasharray="4 2" label={{ value: `Median: ${serverSurvival.medianSurvival}mo`, fontSize: 9, fill: "#10b981" }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
                <div className="space-y-3">
                  <MetricCard title="Median Survival" value={`${serverSurvival.medianSurvival} months`} sub="t where S(t) first ≤ 50%" icon={Activity} accent tooltip="Half of all deals close or are lost within this many months." />
                  <MetricCard title="Restricted Mean" value={`${serverSurvival.meanSurvival} months`} sub="Area under KM curve" icon={Sigma} tooltip="Expected deal age weighted by the survival function." />
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground">At-Risk by Stage</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-1.5">
                        {serverSurvival.atRiskTable.slice(0, 6).map((row: any) => (
                          <div key={row.stage} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground truncate max-w-[100px]">{STAGE_LABELS[row.stage] ?? row.stage}</span>
                            <div className="flex items-center gap-2">
                              <span className="tabular-nums">{row.medianAge}mo</span>
                              <Badge variant="outline" className="text-[10px] py-0">{row.count}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg">No deal age data available for survival analysis. Add deals with creation dates to see the Kaplan-Meier curve.</div>
            )}
          </div>

          {/* ── Section 11: Bayesian Prior Calibration Wizard ── */}
          <BayesWizardSection
            wins={serverBayesianWinRate?.wins ?? 0}
            losses={serverBayesianWinRate?.losses ?? 0}
            onApply={(alpha, beta) => setActuarialParams(prev => ({ ...prev, bayesPriorAlpha: alpha, bayesPriorBeta: beta }))}
          />

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
                    {[
                      { name: "Boltzmann-Gibbs", formula: "P(m) = (1/T)·e^(−m/T)", value: `T = ${fmt(displayBG.temperature)}, λ = ${displayBG.lambda.toFixed(6)}`, src: "Classical Econophysics Ch. 8", pdf: "classicalEconophysics" as const },
                      { name: "Gini Coefficient", formula: "G = 1 − 2∫L(x)dx", value: `G = ${displayGini.gini.toFixed(3)}`, src: "Classical Econophysics Ch. 8, 13", pdf: "classicalEconophysics" as const },
                      { name: "Boltzmann Entropy", formula: "S = −Σ p_i·ln(p_i)", value: `S = ${displayEntropy.entropy} (S/S_max = ${pct(displayEntropy.normalizedEntropy)})`, src: "Classical Econophysics Ch. 1", pdf: "classicalEconophysics" as const },
                      { name: "GBM (drift)", formula: "μ = E[ln(Sₜ/Sₜ₋₁)]·12 + σ²/2", value: `μ = ${(activeParams.muAnnual * 100).toFixed(2)}%/yr`, src: "Mathematical Finance Ch. 6", pdf: "mathematicalFinance" as const },
                      { name: "GBM (volatility)", formula: "σ = std(log-returns)·√12", value: `σ = ${(activeParams.sigmaAnnual * 100).toFixed(2)}%/yr`, src: "Mathematical Finance Ch. 6", pdf: "mathematicalFinance" as const },
                      { name: "Monte Carlo (GBM)", formula: "Sₜ = S₀·exp((μ−σ²/2)t + σWₜ)", value: `E[S_${activeParams.horizonMonths}] = ${fmt(displayForecast.expectedFinal)}`, src: "Mathematical Finance Ch. 6", pdf: "mathematicalFinance" as const },
                      { name: "Binomial Pipeline", formula: "E[R] = Σ vᵢ·p(stageᵢ)", value: `E[R] = ${fmt(displayPipeline.totalExpected)}`, src: "Mathematical Finance Ch. 2–3", pdf: "mathematicalFinance" as const },
                      { name: "Pareto Tail", formula: "P(m) ~ m^(−α) for m > m₀", value: `Top ${pct(displayBG.paretoFraction)} → ${pct(displayBG.paretoRevenueShare)} of revenue`, src: "Classical Econophysics Ch. 8", pdf: "classicalEconophysics" },
                      { name: "Poisson Arrival", formula: "P(X=k) = e^(−λ)·λᵏ/k!", value: `λ = ${displayPoisson.lambda}, mode = ${displayPoisson.mode}, CI₉₀ = [${displayPoisson.ci90Low}, ${displayPoisson.ci90High}]`, src: "Finan PV2020 §7.4", pdf: "finanPV2020" },
                      { name: "Geometric Cycle", formula: "P(X=n) = p·(1−p)^(n−1)", value: `p = ${(displayGeometric.closeRatePerPeriod * 100).toFixed(1)}%, E(X) = ${displayGeometric.expectedCycleMonths} mo`, src: "Finan PV2020 §7.6–7.7", pdf: "finanPV2020" },
                      { name: "Bayesian Win Rate", formula: "Posterior ∝ Beta(α₀+W, β₀+L)", value: `E[p|data] = ${(displayBayes.posteriorMean * 100).toFixed(1)}%, CI₉₀ = [${(displayBayes.ci90Low * 100).toFixed(1)}%, ${(displayBayes.ci90High * 100).toFixed(1)}%]`, src: "Finan PV2020 §5.2", pdf: "finanPV2020" },
                    ].map(row => (
                      <tr key={row.name}>
                        <td className="py-2 pr-4 font-medium">{row.name}</td>
                        <td className="py-2 pr-4 font-mono text-muted-foreground">{row.formula}</td>
                        <td className="py-2 pr-4">{row.value}</td>
                        <td className="py-2">
                          <a href={PDF_URLS[row.pdf]} target="_blank" rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-indigo-600 inline-flex items-center gap-1 transition-colors">
                            {row.src}<ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── What-If Panel (right sidebar) ── */}
      {panelOpen && (
        <div className="w-72 shrink-0 border-l border-border bg-card overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-sm font-semibold text-foreground">What-if Analysis</h2>
              </div>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setPanelOpen(false)}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mb-4 leading-relaxed">
              Adjust parameters below. All KPI cards and charts update instantly — no server calls required.
            </p>
            <WhatIfPanel
              params={whatIfParams ?? baselineParams}
              baseline={baselineParams}
              onParamsChange={handleParamsChange}
              onReset={handleReset}
              isWhatIfMode={isWhatIfMode}
              actuarialParams={actuarialParams}
              onActuarialParamsChange={setActuarialParams}
            />
          </div>
        </div>
      )}

      {/* ── Methodology Modal ── */}
      <MethodologyModal open={methodologyOpen} onClose={() => setMethodologyOpen(false)} />
    </div>
  );
}
