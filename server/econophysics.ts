/**
 * Econophysics Analytics Engine
 *
 * Implements models from:
 * 1. Classical Econophysics (Cockshott, Cottrell, Michaelson, Wright, Yakovenko)
 *    - Boltzmann-Gibbs distribution of money (Ch. 8, Dragulescu & Yakovenko)
 *    - Gini coefficient & Lorenz curve (income inequality)
 *    - Pareto tail / power-law analysis
 *    - Shannon/Boltzmann entropy of revenue distribution
 *    - Economic temperature T = M/N (mean deal value)
 *
 * 2. Mathematical Finance (Clare Wallace, Durham University)
 *    - Geometric Brownian Motion (GBM): S_t = S_0 · exp((μ - σ²/2)t + σW_t)
 *    - Drift μ and volatility σ estimated from log-returns of monthly revenue
 *    - Monte Carlo revenue forecast (N paths, horizon H months)
 *    - Binomial pipeline expected value (stage win probabilities)
 */

// ─── Boltzmann-Gibbs Distribution ────────────────────────────────────────────
// P(m) = (1/T) · exp(-m/T)  where T = mean deal value ("economic temperature")
// Ref: Dragulescu & Yakovenko (2000, 2002); Classical Econophysics Ch. 8

export function boltzmannGibbs(values: number[]): {
  temperature: number;        // T = mean(values) — "economic temperature"
  lambda: number;             // λ = 1/T — rate parameter
  histogram: { bin: number; count: number; expected: number }[];
  paretoThreshold: number;    // value above which power-law tail begins (~90th pct)
  paretoFraction: number;     // fraction of agents in Pareto tail
  paretoRevenueShare: number; // fraction of total revenue in Pareto tail
} {
  if (values.length === 0) {
    return { temperature: 0, lambda: 0, histogram: [], paretoThreshold: 0, paretoFraction: 0, paretoRevenueShare: 0 };
  }

  const n = values.length;
  const total = values.reduce((s, v) => s + v, 0);
  const temperature = total / n;  // T = M/N
  const lambda = temperature > 0 ? 1 / temperature : 0;

  // Build histogram with ~12 bins
  const sorted = [...values].sort((a, b) => a - b);
  const maxVal = sorted[sorted.length - 1];
  const minVal = sorted[0];
  const numBins = Math.min(12, n);
  const binWidth = maxVal > minVal ? (maxVal - minVal) / numBins : 1;

  const histogram: { bin: number; count: number; expected: number }[] = [];
  for (let i = 0; i < numBins; i++) {
    const binStart = minVal + i * binWidth;
    const binEnd = binStart + binWidth;
    const binMid = (binStart + binEnd) / 2;
    const count = values.filter(v => v >= binStart && (i === numBins - 1 ? v <= binEnd : v < binEnd)).length;
    // Expected from Boltzmann-Gibbs: P(m)·Δm·N = (λ·e^(-λm))·Δm·N
    const expected = lambda > 0 ? lambda * Math.exp(-lambda * binMid) * binWidth * n : 0;
    histogram.push({ bin: Math.round(binMid), count, expected: Math.round(expected * 10) / 10 });
  }

  // Pareto tail: top ~10% of agents by value (Dragulescu & Yakovenko: top 5-10% follow power law)
  const paretoIdx = Math.floor(n * 0.9);
  const paretoThreshold = sorted[paretoIdx] ?? 0;
  const paretoValues = sorted.slice(paretoIdx);
  const paretoFraction = paretoValues.length / n;
  const paretoRevenueShare = total > 0 ? paretoValues.reduce((s, v) => s + v, 0) / total : 0;

  return { temperature, lambda, histogram, paretoThreshold, paretoFraction, paretoRevenueShare };
}

// ─── Gini Coefficient & Lorenz Curve ─────────────────────────────────────────
// Gini = 1 - 2·∫₀¹ L(x)dx  where L(x) is the Lorenz curve
// For pure Boltzmann-Gibbs exponential: Gini = 0.5
// Ref: Classical Econophysics Ch. 8, 13

export function giniAndLorenz(values: number[]): {
  gini: number;
  lorenz: { population: number; wealthShare: number }[];
  interpretation: string;
} {
  if (values.length === 0) return { gini: 0, lorenz: [], interpretation: "No data" };

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const total = sorted.reduce((s, v) => s + v, 0);

  if (total === 0) return { gini: 0, lorenz: [], interpretation: "All zero" };

  // Lorenz curve: cumulative population share vs cumulative wealth share
  const lorenz: { population: number; wealthShare: number }[] = [{ population: 0, wealthShare: 0 }];
  let cumWealth = 0;
  for (let i = 0; i < n; i++) {
    cumWealth += sorted[i];
    lorenz.push({
      population: Math.round(((i + 1) / n) * 100) / 100,
      wealthShare: Math.round((cumWealth / total) * 1000) / 1000,
    });
  }

  // Gini = (2·Σ(i·x_i) / (n·Σx_i)) - (n+1)/n
  let weightedSum = 0;
  for (let i = 0; i < n; i++) {
    weightedSum += (i + 1) * sorted[i];
  }
  const gini = (2 * weightedSum) / (n * total) - (n + 1) / n;
  const giniRounded = Math.round(gini * 1000) / 1000;

  // Interpretation based on Classical Econophysics thresholds
  let interpretation: string;
  if (giniRounded < 0.3) interpretation = "Low concentration — revenue is broadly distributed";
  else if (giniRounded < 0.5) interpretation = "Moderate concentration — approaching Boltzmann-Gibbs equilibrium (Gini ≈ 0.5)";
  else if (giniRounded < 0.7) interpretation = "High concentration — Pareto dynamics dominating";
  else interpretation = "Very high concentration — power-law tail dominates revenue";

  return { gini: giniRounded, lorenz, interpretation };
}

// ─── Shannon / Boltzmann Entropy ─────────────────────────────────────────────
// S = -Σ p_i · ln(p_i)  where p_i = fraction of total revenue from agent i
// Maximum entropy (uniform distribution) = ln(N)
// Ref: Classical Econophysics Ch. 1 (Boltzmann entropy), Ch. 8
// Higher entropy = more equal distribution of revenue

export function revenueEntropy(values: number[]): {
  entropy: number;
  maxEntropy: number;
  normalizedEntropy: number;  // entropy / maxEntropy ∈ [0,1]
  interpretation: string;
} {
  if (values.length === 0) return { entropy: 0, maxEntropy: 0, normalizedEntropy: 0, interpretation: "No data" };

  const total = values.reduce((s, v) => s + v, 0);
  if (total === 0) return { entropy: 0, maxEntropy: 0, normalizedEntropy: 0, interpretation: "No revenue" };

  const n = values.length;
  const maxEntropy = Math.log(n);

  let entropy = 0;
  for (const v of values) {
    if (v > 0) {
      const p = v / total;
      entropy -= p * Math.log(p);
    }
  }

  const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;

  let interpretation: string;
  if (normalizedEntropy > 0.85) interpretation = "Near-maximum entropy — revenue highly equalised across reps";
  else if (normalizedEntropy > 0.65) interpretation = "Moderate entropy — balanced revenue distribution";
  else if (normalizedEntropy > 0.4) interpretation = "Low entropy — revenue concentrated in few reps";
  else interpretation = "Very low entropy — extreme revenue concentration";

  return {
    entropy: Math.round(entropy * 1000) / 1000,
    maxEntropy: Math.round(maxEntropy * 1000) / 1000,
    normalizedEntropy: Math.round(normalizedEntropy * 1000) / 1000,
    interpretation,
  };
}

// ─── GBM Parameter Estimation ────────────────────────────────────────────────
// From Mathematical Finance (Wallace, Durham):
// S_t = S_0 · exp((μ - σ²/2)t + σW_t)
// Log-returns: r_t = ln(S_t/S_{t-1}) ~ N((μ - σ²/2)h, σ²h)
// Estimate: σ² = Var(r_t)/h,  μ = mean(r_t)/h + σ²/2

export function estimateGBMParams(monthlyRevenue: number[]): {
  mu: number;       // drift rate (annualised)
  sigma: number;    // volatility (annualised)
  muMonthly: number;
  sigmaMonthly: number;
  logReturns: number[];
} {
  if (monthlyRevenue.length < 2) {
    return { mu: 0, sigma: 0, muMonthly: 0, sigmaMonthly: 0, logReturns: [] };
  }

  // Compute log-returns: r_t = ln(S_t / S_{t-1})
  const logReturns: number[] = [];
  for (let i = 1; i < monthlyRevenue.length; i++) {
    const prev = monthlyRevenue[i - 1];
    const curr = monthlyRevenue[i];
    if (prev > 0 && curr > 0) {
      logReturns.push(Math.log(curr / prev));
    }
  }

  if (logReturns.length === 0) {
    return { mu: 0, sigma: 0, muMonthly: 0, sigmaMonthly: 0, logReturns: [] };
  }

  const n = logReturns.length;
  const meanR = logReturns.reduce((s, r) => s + r, 0) / n;
  const varR = logReturns.reduce((s, r) => s + (r - meanR) ** 2, 0) / Math.max(n - 1, 1);

  // h = 1 month = 1/12 year
  // Monthly GBM parameters (Ito's lemma: mu_drift = mean(log-returns) + sigma^2/2)
  const sigmaMonthly = Math.sqrt(varR);                     // std of monthly log-return
  const sigma = sigmaMonthly * Math.sqrt(12);               // annualised volatility
  const muMonthly = meanR + varR / 2;                       // monthly drift (Ito correction)
  const mu = muMonthly * 12;                                // annualised drift

  // Apply reasonable caps when sample is small (< 6 data points) to avoid
  // unrealistic forecasts from sparse seed data
  const sigmaFinal = n < 6 ? Math.min(sigma, 2.0) : sigma;
  const muFinal = n < 6 ? Math.max(Math.min(mu, 3.0), -1.0) : mu;

  return {
    mu: Math.round(muFinal * 10000) / 10000,
    sigma: Math.round(sigmaFinal * 10000) / 10000,
    muMonthly: Math.round((muFinal / 12) * 10000) / 10000,
    sigmaMonthly: Math.round((sigmaFinal / Math.sqrt(12)) * 10000) / 10000,
    logReturns: logReturns.map(r => Math.round(r * 10000) / 10000),
  };
}

// ─── Monte Carlo GBM Revenue Forecast ────────────────────────────────────────
// S_t = S_0 · exp((μ - σ²/2)·t + σ·√t·Z)  where Z ~ N(0,1)
// Generates N paths over H months
// Ref: Mathematical Finance Ch. 6 (Black-Scholes / GBM)

export function monteCarloForecast(
  s0: number,       // starting revenue (last known month)
  mu: number,       // monthly drift
  sigma: number,    // monthly volatility
  horizonMonths: number = 6,
  nPaths: number = 200,
  seed: number = 42
): {
  paths: number[][];           // [nPaths][horizonMonths+1] — sampled paths (subset for display)
  median: number[];            // median path
  p10: number[];               // 10th percentile (pessimistic)
  p90: number[];               // 90th percentile (optimistic)
  p25: number[];               // 25th percentile
  p75: number[];               // 75th percentile
  expectedFinal: number;       // E[S_T] = S_0 · exp(μ·T)
} {
  if (s0 <= 0 || nPaths === 0) {
    const empty = Array(horizonMonths + 1).fill(s0);
    return { paths: [], median: empty, p10: empty, p90: empty, p25: empty, p75: empty, expectedFinal: s0 };
  }

  // Seeded pseudo-random normal using Box-Muller
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

  const h = 1; // 1 month steps
  const drift = (mu - 0.5 * sigma * sigma) * h;
  const diffusion = sigma * Math.sqrt(h);

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

  // Compute percentile bands at each time step
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

  // Return a sample of 20 paths for display
  const step = Math.max(1, Math.floor(nPaths / 20));
  const sampledPaths = allPaths.filter((_, i) => i % step === 0).slice(0, 20);

  const expectedFinal = Math.round(s0 * Math.exp(mu * horizonMonths));

  return { paths: sampledPaths, median, p10, p90, p25, p75, expectedFinal };
}

// ─── Binomial Pipeline Expected Value ────────────────────────────────────────
// Each deal in stage s has win probability p_s (from historical data).
// Expected revenue = Σ_deals (deal.value × p_stage)
// Ref: Mathematical Finance Ch. 2-3 (binomial model, risk-neutral valuation)

export const STAGE_WIN_PROBABILITIES: Record<string, number> = {
  lead: 0.10,
  qualified: 0.25,
  proposal: 0.45,
  negotiation: 0.70,
  closed_won: 1.00,
  closed_lost: 0.00,
};

export function binomialPipelineValue(
  deals: { stage: string; value: number; title: string }[],
  stageProbMap?: Record<string, number>
): {
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
} {
  const stageMap: Record<string, { count: number; faceValue: number; probability: number }> = {};

  for (const deal of deals) {
    const stage = deal.stage.toLowerCase().replace(/ /g, "_");
    const prob = (stageProbMap ? stageProbMap[stage] : STAGE_WIN_PROBABILITIES[stage]) ?? 0.1;
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
// T(t) = M(t)/N(t) = total deal value in period / number of deals in period
// Analogous to temperature of a gas: higher T = more "hot money" per agent
// Ref: Classical Econophysics Ch. 8

export function economicTemperatureTrend(
  periods: { label: string; totalValue: number; dealCount: number }[]
): { label: string; temperature: number }[] {
  return periods.map(p => ({
    label: p.label,
    temperature: p.dealCount > 0 ? Math.round(p.totalValue / p.dealCount) : 0,
  }));
}
