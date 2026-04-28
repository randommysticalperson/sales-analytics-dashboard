/**
 * WhatIfPanel — interactive parameter editor for the Econophysics page.
 * All controls update a WhatIfParams object in the parent via onParamsChange.
 * No server calls are made; all recalculation happens in econophysicsEngine.ts.
 */

import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RotateCcw, Zap, TrendingDown, Shield } from "lucide-react";
import {
  WhatIfParams,
  ActuarialWhatIfParams,
  SCENARIO_PRESETS,
  DEFAULT_STAGE_PROBS,
  DEFAULT_ACTUARIAL_PARAMS,
} from "@/lib/econophysicsEngine";

interface WhatIfPanelProps {
  params: WhatIfParams;
  baseline: WhatIfParams;
  onParamsChange: (p: WhatIfParams) => void;
  onReset: () => void;
  isWhatIfMode: boolean;
  // Actuarial model parameters (separate from GBM/pipeline what-if)
  actuarialParams?: ActuarialWhatIfParams;
  onActuarialParamsChange?: (p: ActuarialWhatIfParams) => void;
}

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
};

const EDITABLE_STAGES = ["lead", "qualified", "proposal", "negotiation"];

function pct(v: number) {
  return `${(v * 100).toFixed(0)}%`;
}

function DeltaBadge({ current, baseline }: { current: number; baseline: number }) {
  if (Math.abs(current - baseline) < 0.001) return null;
  const delta = current - baseline;
  const positive = delta > 0;
  return (
    <span
      className={`ml-1.5 text-[10px] font-semibold px-1 py-0.5 rounded ${
        positive
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
      }`}
    >
      {positive ? "▲" : "▼"} {Math.abs(delta * 100).toFixed(0)}pp
    </span>
  );
}

export function WhatIfPanel({
  params,
  baseline,
  onParamsChange,
  onReset,
  isWhatIfMode,
  actuarialParams = DEFAULT_ACTUARIAL_PARAMS,
  onActuarialParamsChange,
}: WhatIfPanelProps) {
  function setActuarial<K extends keyof ActuarialWhatIfParams>(key: K, value: ActuarialWhatIfParams[K]) {
    onActuarialParamsChange?.({ ...actuarialParams, [key]: value });
  }
  function set<K extends keyof WhatIfParams>(key: K, value: WhatIfParams[K]) {
    onParamsChange({ ...params, [key]: value });
  }

  function setStageProb(stage: string, value: number) {
    onParamsChange({
      ...params,
      stageProbabilities: { ...params.stageProbabilities, [stage]: value },
    });
  }

  function applyPreset(name: keyof typeof SCENARIO_PRESETS) {
    const preset = SCENARIO_PRESETS[name];
    onParamsChange({
      ...params,
      ...preset,
      stageProbabilities: {
        ...params.stageProbabilities,
        ...(preset.stageProbabilities ?? {}),
      },
    });
  }

  return (
    <div className="flex flex-col gap-5 text-sm">
      {/* ── Mode indicator ── */}
      {isWhatIfMode && (
        <div className="flex items-center gap-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 px-3 py-2">
          <Zap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
            What-if mode active — charts show hypothetical outputs
          </span>
        </div>
      )}

      {/* ── Scenario presets ── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Scenario Presets
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
            onClick={() => applyPreset("optimistic")}
          >
            <TrendingDown className="w-3 h-3 rotate-180" />
            Optimistic
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 gap-1 border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400"
            onClick={() => applyPreset("conservative")}
          >
            <Shield className="w-3 h-3" />
            Conservative
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 gap-1 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/40"
            onClick={() => applyPreset("pessimistic")}
          >
            <TrendingDown className="w-3 h-3" />
            Pessimistic
          </Button>
        </div>
      </div>

      <Separator />

      {/* ── GBM Parameters ── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          GBM Parameters
        </p>

        <div className="space-y-4">
          {/* Drift μ */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs">
                Drift μ (annual)
                <DeltaBadge current={params.muAnnual} baseline={baseline.muAnnual} />
              </Label>
              <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                {(params.muAnnual * 100).toFixed(0)}%/yr
              </span>
            </div>
            <Slider
              min={-100}
              max={500}
              step={5}
              value={[Math.round(params.muAnnual * 100)]}
              onValueChange={([v]) => set("muAnnual", v / 100)}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
              <span>−100%</span>
              <span>+500%</span>
            </div>
          </div>

          {/* Volatility σ */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs">
                Volatility σ (annual)
                <DeltaBadge current={params.sigmaAnnual} baseline={baseline.sigmaAnnual} />
              </Label>
              <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                {(params.sigmaAnnual * 100).toFixed(0)}%/yr
              </span>
            </div>
            <Slider
              min={0}
              max={300}
              step={5}
              value={[Math.round(params.sigmaAnnual * 100)]}
              onValueChange={([v]) => set("sigmaAnnual", v / 100)}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
              <span>0%</span>
              <span>300%</span>
            </div>
          </div>

          {/* Forecast horizon */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs">Forecast Horizon</Label>
              <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                {params.horizonMonths} months
              </span>
            </div>
            <Slider
              min={1}
              max={24}
              step={1}
              value={[params.horizonMonths]}
              onValueChange={([v]) => set("horizonMonths", v)}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
              <span>1 mo</span>
              <span>24 mo</span>
            </div>
          </div>

          {/* Number of paths */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs">Monte Carlo Paths</Label>
            </div>
            <Select
              value={String(params.nPaths)}
              onValueChange={v => set("nPaths", Number(v))}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50 paths (fast)</SelectItem>
                <SelectItem value="100">100 paths</SelectItem>
                <SelectItem value="200">200 paths (default)</SelectItem>
                <SelectItem value="500">500 paths (precise)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      {/* ── Stage Win Probabilities ── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Stage Win Probabilities
        </p>
        <div className="space-y-3">
          {EDITABLE_STAGES.map(stage => {
            const current = params.stageProbabilities[stage] ?? DEFAULT_STAGE_PROBS[stage];
            const base = baseline.stageProbabilities[stage] ?? DEFAULT_STAGE_PROBS[stage];
            return (
              <div key={stage}>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs">
                    {STAGE_LABELS[stage]}
                    <DeltaBadge current={current} baseline={base} />
                  </Label>
                  <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                    {pct(current)}
                  </span>
                </div>
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[Math.round(current * 100)]}
                  onValueChange={([v]) => setStageProb(stage, v / 100)}
                  className="w-full"
                />
              </div>
            );
          })}
          <div className="flex gap-2 text-[10px] text-muted-foreground pt-1">
            <span className="px-1.5 py-0.5 bg-muted rounded">Closed Won = 100% (fixed)</span>
            <span className="px-1.5 py-0.5 bg-muted rounded">Closed Lost = 0% (fixed)</span>
          </div>
        </div>
      </div>

      <Separator />

      {/* ── Pareto Threshold ── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Distribution Parameters
        </p>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label className="text-xs">Pareto Threshold Percentile</Label>
            <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
              {Math.round(params.paretoPercentile * 100)}th pct
            </span>
          </div>
          <Slider
            min={70}
            max={99}
            step={1}
            value={[Math.round(params.paretoPercentile * 100)]}
            onValueChange={([v]) => set("paretoPercentile", v / 100)}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
            <span>70th</span>
            <span>99th</span>
          </div>
        </div>
      </div>

      <Separator />

      {/* ── Deal Assumptions ── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Deal Assumptions
        </p>
        <div className="space-y-3">
          <div>
            <Label className="text-xs mb-1.5 block">
              Avg Deal Value (override)
              {params.avgDealValue !== baseline.avgDealValue && (
                <span className="ml-1.5 text-[10px] font-semibold px-1 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400">
                  modified
                </span>
              )}
            </Label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
              <Input
                type="number"
                min={1000}
                max={10_000_000}
                step={1000}
                value={params.avgDealValue}
                onChange={e => set("avgDealValue", Number(e.target.value) || baseline.avgDealValue)}
                className="pl-5 h-7 text-xs"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">
              Deal Count (override)
              {params.dealCount !== baseline.dealCount && (
                <span className="ml-1.5 text-[10px] font-semibold px-1 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400">
                  modified
                </span>
              )}
            </Label>
            <Input
              type="number"
              min={1}
              max={10000}
              step={1}
              value={params.dealCount}
              onChange={e => set("dealCount", Number(e.target.value) || baseline.dealCount)}
              className="h-7 text-xs"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* ── Actuarial Parameters (Finan PV2020) ── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          Actuarial Parameters
        </p>
        <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
          Poisson, Geometric/NB, and Bayesian models (Finan PV2020)
        </p>
        <div className="space-y-4">
          {/* Poisson λ */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs">Poisson Rate λ (deals/mo)</Label>
              <span className="text-xs font-mono font-semibold text-violet-600 dark:text-violet-400 tabular-nums">
                {actuarialParams.poissonLambda.toFixed(1)}
              </span>
            </div>
            <Slider
              min={1}
              max={30}
              step={0.5}
              value={[actuarialParams.poissonLambda]}
              onValueChange={([v]) => setActuarial("poissonLambda", v)}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
              <span>1</span>
              <span>30 deals/mo</span>
            </div>
          </div>

          {/* Close rate p */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs">Close Rate p (%/month)</Label>
              <span className="text-xs font-mono font-semibold text-violet-600 dark:text-violet-400 tabular-nums">
                {(actuarialParams.closeRatePerPeriod * 100).toFixed(0)}%
              </span>
            </div>
            <Slider
              min={1}
              max={99}
              step={1}
              value={[Math.round(actuarialParams.closeRatePerPeriod * 100)]}
              onValueChange={([v]) => setActuarial("closeRatePerPeriod", v / 100)}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
              <span>1%</span>
              <span>99%</span>
            </div>
          </div>

          {/* Quota target r */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs">Quota Target r (closes)</Label>
              <span className="text-xs font-mono font-semibold text-violet-600 dark:text-violet-400 tabular-nums">
                {actuarialParams.quotaTarget}
              </span>
            </div>
            <Slider
              min={1}
              max={20}
              step={1}
              value={[actuarialParams.quotaTarget]}
              onValueChange={([v]) => setActuarial("quotaTarget", v)}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
              <span>1</span>
              <span>20 closes</span>
            </div>
          </div>

          {/* Bayesian prior α₀ */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs">Bayesian Prior α₀ (belief wins)</Label>
              <span className="text-xs font-mono font-semibold text-violet-600 dark:text-violet-400 tabular-nums">
                {actuarialParams.bayesPriorAlpha.toFixed(1)}
              </span>
            </div>
            <Slider
              min={1}
              max={20}
              step={0.5}
              value={[actuarialParams.bayesPriorAlpha]}
              onValueChange={([v]) => setActuarial("bayesPriorAlpha", v)}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
              <span>1 (flat)</span>
              <span>20 (strong)</span>
            </div>
          </div>

          {/* Bayesian prior β₀ */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs">Bayesian Prior β₀ (belief losses)</Label>
              <span className="text-xs font-mono font-semibold text-violet-600 dark:text-violet-400 tabular-nums">
                {actuarialParams.bayesPriorBeta.toFixed(1)}
              </span>
            </div>
            <Slider
              min={1}
              max={20}
              step={0.5}
              value={[actuarialParams.bayesPriorBeta]}
              onValueChange={([v]) => setActuarial("bayesPriorBeta", v)}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
              <span>1 (flat)</span>
              <span>20 (strong)</span>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* ── Reset ── */}
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-1.5 text-xs"
        onClick={onReset}
        disabled={!isWhatIfMode}
      >
        <RotateCcw className="w-3.5 h-3.5" />
        Reset to Baseline
      </Button>
    </div>
  );
}
