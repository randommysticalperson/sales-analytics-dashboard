/**
 * Client-side econophysics computation engine.
 * All 8 models are ported from server/econophysics.ts so that what-if
 * recalculations happen instantly in the browser with zero server round-trips.
 *
 * Sources:
 *   - Classical Econophysics (Cockshott, Cottrell, Yakovenko et al.)
 *   - Mathematical Finance (Wallace, Durham University)
 */

// ─── Boltzmann-Gibbs Distribution ────────────────────────────────────────────

export interface BoltzmannResult {
  temperature: number;
  lambda: number;
  histogram: { bin: string; count: number; expected: number; binMid: number }[];
  paretoThreshold: number;
  paretoFraction: number;
  paretoRevenueShare: number;
}

export function boltzmannGibbs(
  values: number[],
  paretoPercentile = 0.9
): BoltzmannResult {
  // Defensive: filter out any non-finite or non-positive values
  const safeValues = values.filter(v => typeof v === 'number' && Number.isFinite(v) && v > 0);
  if (safeValues.length === 0) {
    return { temperature: 0, lambda: 0, histogram: [], paretoThreshold: 0, paretoFraction: 0, paretoRevenueShare: 0 };
  }
  const sorted = [...safeValues].sort((a, b) => a - b);
  const temperature = safeValues.reduce((s, v) => s + v, 0) / safeValues.length;
  const lambda = temperature > 0 ? 1 / temperature : 0;

  // Build histogram (10 bins)
  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;
  const nBins = 10;
  const range = max - min;
  const binWidth = range > 0 ? range / nBins : 1;
  const bins = Array.from({ length: nBins }, (_, i) => ({
    lo: min + i * binWidth,
    hi: min + (i + 1) * binWidth,
    count: 0,
  }));
  for (const v of safeValues) {
    const rawIdx = range > 0 ? Math.floor((v - min) / binWidth) : 0;
    const idx = Math.max(0, Math.min(isFinite(rawIdx) ? rawIdx : 0, nBins - 1));
    bins[idx]!.count++;
  }
  const histogram = bins.map(b => {
    const mid = (b.lo + b.hi) / 2;
    const expected = lambda > 0
      ? safeValues.length * (Math.exp(-lambda * b.lo) - Math.exp(-lambda * b.hi))
      : 0;
    const lo = b.lo >= 1000 ? `$${(b.lo / 1000).toFixed(0)}K` : `$${b.lo.toFixed(0)}`;
    const hi = b.hi >= 1000 ? `$${(b.hi / 1000).toFixed(0)}K` : `$${b.hi.toFixed(0)}`;
    return { bin: `${lo}–${hi}`, count: b.count, expected: Math.max(0, Math.round(expected)), binMid: mid };
  });

  // Pareto tail
  const thresholdIdx = Math.floor(paretoPercentile * sorted.length);
  const paretoThreshold = sorted[thresholdIdx] ?? sorted[sorted.length - 1]!;
  const paretoValues = safeValues.filter(v => v >= paretoThreshold);
  const paretoFraction = paretoValues.length / safeValues.length;
  const totalRevenue = safeValues.reduce((s, v) => s + v, 0);
  const paretoRevenue = paretoValues.reduce((s, v) => s + v, 0);
  const paretoRevenueShare = totalRevenue > 0 ? paretoRevenue / totalRevenue : 0;

  return { temperature, lambda, histogram, paretoThreshold, paretoFraction, paretoRevenueShare };
}

// ─── Gini Coefficient & Lorenz Curve ─────────────────────────────────────────

export interface GiniResult {
  gini: number;
  lorenz: { population: number; wealthShare: number }[];
  interpretation: string;
}

export function giniAndLorenz(values: number[]): GiniResult {
  if (values.length === 0) return { gini: 0, lorenz: [], interpretation: "No data" };
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const total = sorted.reduce((s, v) => s + v, 0);
  if (total === 0) return { gini: 0, lorenz: [], interpretation: "All zero" };

  // Lorenz curve points
  const lorenz: { population: number; wealthShare: number }[] = [{ population: 0, wealthShare: 0 }];
  let cumWealth = 0;
  for (let i = 0; i < n; i++) {
    cumWealth += sorted[i];
    lorenz.push({ population: (i + 1) / n, wealthShare: cumWealth / total });
  }

  // Gini = 1 - 2 * area under Lorenz curve (trapezoidal)
  let area = 0;
  for (let i = 1; i < lorenz.length; i++) {
    const dx = lorenz[i].population - lorenz[i - 1].population;
    area += dx * (lorenz[i].wealthShare + lorenz[i - 1].wealthShare) / 2;
  }
  const gini = Math.round((1 - 2 * area) * 1000) / 1000;

  let interpretation: string;
  if (gini < 0.2) interpretation = "Very low concentration — revenue is broadly distributed";
  else if (gini < 0.35) interpretation = "Low concentration — revenue is broadly distributed";
  else if (gini < 0.5) interpretation = "Moderate concentration — some reps dominate";
  else if (gini < 0.65) interpretation = "High concentration — a few reps drive most revenue";
  else interpretation = "Very high concentration — revenue is highly skewed";

  return { gini, lorenz, interpretation };
}

// ─── Revenue Entropy ─────────────────────────────────────────────────────────

export interface EntropyResult {
  entropy: number;
  maxEntropy: number;
  normalizedEntropy: number;
  interpretation: string;
}

export function revenueEntropy(values: number[]): EntropyResult {
  if (values.length === 0) return { entropy: 0, maxEntropy: 0, normalizedEntropy: 0, interpretation: "No data" };
  const total = values.reduce((s, v) => s + v, 0);
  if (total === 0) return { entropy: 0, maxEntropy: 0, normalizedEntropy: 0, interpretation: "No revenue" };

  const probs = values.map(v => v / total);
  const entropy = -probs.reduce((s, p) => s + (p > 0 ? p * Math.log(p) : 0), 0);
  const maxEntropy = values.length > 1 ? Math.log(values.length) : 1;
  const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;
  const entropyRounded = Math.round(entropy * 100) / 100;

  let interpretation: string;
  if (normalizedEntropy > 0.9) interpretation = "Near-maximum entropy — revenue highly equalised across reps";
  else if (normalizedEntropy > 0.7) interpretation = "Moderate entropy — reasonably even distribution";
  else if (normalizedEntropy > 0.5) interpretation = "Below-average entropy — some concentration present";
  else interpretation = "Low entropy — revenue heavily concentrated in a few reps";

  return { entropy: entropyRounded, maxEntropy: Math.round(maxEntropy * 100) / 100, normalizedEntropy: Math.round(normalizedEntropy * 1000) / 1000, interpretation };
}

// ─── GBM Parameter Estimation ────────────────────────────────────────────────

export interface GBMParams {
  mu: number;       // annualised drift
  sigma: number;    // annualised volatility
  muMonthly: number;
  sigmaMonthly: number;
  logReturns: number[];
}

export function estimateGBMParams(monthlyRevenue: number[]): GBMParams {
  const series = monthlyRevenue.filter(v => v > 0);
  if (series.length < 2) return { mu: 0, sigma: 0, muMonthly: 0, sigmaMonthly: 0, logReturns: [] };

  const logReturns: number[] = [];
  for (let i = 1; i < series.length; i++) {
    logReturns.push(Math.log(series[i] / series[i - 1]));
  }
  if (logReturns.length === 0) return { mu: 0, sigma: 0, muMonthly: 0, sigmaMonthly: 0, logReturns: [] };

  const meanR = logReturns.reduce((s, r) => s + r, 0) / logReturns.length;
  const varR = logReturns.reduce((s, r) => s + (r - meanR) ** 2, 0) / Math.max(logReturns.length - 1, 1);
  const sigmaMonthly = Math.sqrt(varR);
  const muMonthly = meanR + varR / 2;

  // Cap at ±500%/yr and 300%/yr for volatility
  const muAnnual = Math.max(-5, Math.min(5, muMonthly * 12));
  const sigmaAnnual = Math.min(3, sigmaMonthly * Math.sqrt(12));

  return { mu: muAnnual, sigma: sigmaAnnual, muMonthly, sigmaMonthly, logReturns };
}

// ─── Monte Carlo GBM Forecast ─────────────────────────────────────────────────

export interface MonteCarloResult {
  paths: number[][];
  median: number[];
  p10: number[];
  p90: number[];
  p25: number[];
  p75: number[];
  expectedFinal: number;
  labels: string[];
}

export function monteCarloForecast(
  s0: number,
  muAnnual: number,
  sigmaAnnual: number,
  horizonMonths = 6,
  nPaths = 200,
  seed = 42
): MonteCarloResult {
  const mu = muAnnual / 12;
  const sigma = sigmaAnnual / Math.sqrt(12);

  if (s0 <= 0 || nPaths === 0) {
    const empty = Array(horizonMonths + 1).fill(s0);
    const labels = Array.from({ length: horizonMonths + 1 }, (_, i) => i === 0 ? "Now" : `+${i}mo`);
    return { paths: [], median: empty, p10: empty, p90: empty, p25: empty, p75: empty, expectedFinal: s0, labels };
  }

  let rngState = seed;
  function lcg(): number {
    rngState = (rngState * 1664525 + 1013904223) & 0xffffffff;
    return (rngState >>> 0) / 0xffffffff;
  }
  function randn(): number {
    const u1 = Math.max(lcg(), 1e-10);
    const u2 = lcg();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  const drift = (mu - 0.5 * sigma * sigma);
  const diffusion = sigma;
  const allPaths: number[][] = [];

  for (let p = 0; p < nPaths; p++) {
    const path = [s0];
    let s = s0;
    for (let t = 0; t < horizonMonths; t++) {
      s = s * Math.exp(drift + diffusion * randn());
      path.push(Math.round(s));
    }
    allPaths.push(path);
  }

  const median: number[] = [];
  const p10: number[] = [];
  const p90: number[] = [];
  const p25: number[] = [];
  const p75: number[] = [];

  for (let t = 0; t <= horizonMonths; t++) {
    const vals = allPaths.map(p => p[t]).sort((a, b) => a - b);
    median.push(vals[Math.floor(nPaths * 0.5)]);
    p10.push(vals[Math.floor(nPaths * 0.1)]);
    p90.push(vals[Math.floor(nPaths * 0.9)]);
    p25.push(vals[Math.floor(nPaths * 0.25)]);
    p75.push(vals[Math.floor(nPaths * 0.75)]);
  }

  const step = Math.max(1, Math.floor(nPaths / 20));
  const sampledPaths = allPaths.filter((_, i) => i % step === 0).slice(0, 20);
  const expectedFinal = Math.round(s0 * Math.exp(mu * horizonMonths));
  const labels = Array.from({ length: horizonMonths + 1 }, (_, i) => i === 0 ? "Now" : `+${i}mo`);

  return { paths: sampledPaths, median, p10, p90, p25, p75, expectedFinal, labels };
}

// ─── Binomial Pipeline Expected Value ────────────────────────────────────────

export interface BinomialResult {
  totalExpected: number;
  totalFaceValue: number;
  weightedConversionRate: number;
  byStage: {
    stage: string;
    count: number;
    faceValue: number;
    probability: number;
    expectedValue: number;
  }[];
}

export function binomialPipelineValue(
  deals: { stage: string; value: number }[],
  stageProbMap: Record<string, number>
): BinomialResult {
  const stageMap: Record<string, { count: number; faceValue: number; probability: number }> = {};
  for (const deal of deals) {
    const stage = deal.stage.toLowerCase().replace(/ /g, "_");
    const prob = stageProbMap[stage] ?? 0.1;
    if (!stageMap[stage]) stageMap[stage] = { count: 0, faceValue: 0, probability: prob };
    stageMap[stage].count++;
    stageMap[stage].faceValue += deal.value;
  }
  const byStage = Object.entries(stageMap).map(([stage, data]) => ({
    stage,
    count: data.count,
    faceValue: data.faceValue,
    probability: data.probability,
    expectedValue: Math.round(data.faceValue * data.probability),
  }));
  const totalExpected = byStage.reduce((s, b) => s + b.expectedValue, 0);
  const totalFaceValue = byStage.reduce((s, b) => s + b.faceValue, 0);
  const weightedConversionRate = totalFaceValue > 0 ? totalExpected / totalFaceValue : 0;
  return { totalExpected, totalFaceValue, weightedConversionRate, byStage };
}

// ─── Economic Temperature Trend ──────────────────────────────────────────────

export function economicTemperatureTrend(
  periods: { label: string; totalValue: number; dealCount: number }[]
): { label: string; temperature: number }[] {
  return periods.map(p => ({
    label: p.label,
    temperature: p.dealCount > 0 ? Math.round(p.totalValue / p.dealCount) : 0,
  }));
}

// ─── What-If Parameters ───────────────────────────────────────────────────────

export interface WhatIfParams {
  // GBM
  muAnnual: number;          // drift %/yr  (−100 to 500)
  sigmaAnnual: number;       // volatility %/yr (0 to 300)
  horizonMonths: number;     // 1–24
  nPaths: number;            // 50 | 100 | 200 | 500
  // Pareto
  paretoPercentile: number;  // 0.80–0.99
  // Stage probabilities
  stageProbabilities: Record<string, number>;
  // Deal assumptions (for synthetic what-if without changing real data)
  avgDealValue: number;      // override average deal value
  dealCount: number;         // override number of deals
}

export const DEFAULT_STAGE_PROBS: Record<string, number> = {
  lead: 0.10,
  qualified: 0.25,
  proposal: 0.45,
  negotiation: 0.70,
  closed_won: 1.00,
  closed_lost: 0.00,
};

export const SCENARIO_PRESETS: Record<string, Partial<WhatIfParams>> = {
  optimistic: {
    muAnnual: 0.80,
    sigmaAnnual: 0.40,
    stageProbabilities: { lead: 0.20, qualified: 0.40, proposal: 0.65, negotiation: 0.85, closed_won: 1.00, closed_lost: 0.00 },
  },
  pessimistic: {
    muAnnual: -0.20,
    sigmaAnnual: 1.20,
    stageProbabilities: { lead: 0.05, qualified: 0.15, proposal: 0.25, negotiation: 0.50, closed_won: 1.00, closed_lost: 0.00 },
  },
  conservative: {
    muAnnual: 0.15,
    sigmaAnnual: 0.60,
    stageProbabilities: { lead: 0.10, qualified: 0.25, proposal: 0.45, negotiation: 0.70, closed_won: 1.00, closed_lost: 0.00 },
  },
};
