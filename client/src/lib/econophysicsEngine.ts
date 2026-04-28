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

// ─── Actuarial Models (Finan PV2020) ─────────────────────────────────────────
// Source: Marcel B. Finan, "A Probability Course for the Actuaries" (PV2020)
//         Arkansas Tech University, Revised 2020 Edition

// ─── 9. Poisson Deal-Arrival Model ───────────────────────────────────────────
// P(X = k) = e^(-λ) · λ^k / k!   where λ = mean arrivals per period
// E(X) = Var(X) = λ
// Ref: Finan PV2020 §7.4

export interface PoissonResult {
  lambda: number;           // estimated arrival rate (deals/month)
  pmf: { k: number; probability: number; cumulative: number }[];
  mode: number;             // most likely deal count
  ci90Low: number;          // 5th percentile (lower bound of 90% CI)
  ci90High: number;         // 95th percentile (upper bound of 90% CI)
  variance: number;         // = lambda for Poisson
}

export function poissonDealArrival(
  monthlyDealCounts: number[],
  lambdaOverride?: number
): PoissonResult {
  const validCounts = monthlyDealCounts.filter(c => c >= 0 && Number.isFinite(c));
  const lambda = lambdaOverride !== undefined
    ? lambdaOverride
    : (validCounts.length > 0 ? validCounts.reduce((s, c) => s + c, 0) / validCounts.length : 1);

  const safeLambda = Math.max(0.01, lambda);

  // Compute PMF up to k = max(30, 3*lambda)
  const kMax = Math.max(30, Math.ceil(safeLambda * 4));
  const pmf: { k: number; probability: number; cumulative: number }[] = [];
  let cumulative = 0;

  // Use log-factorial for numerical stability
  function logFactorial(n: number): number {
    if (n <= 1) return 0;
    let s = 0;
    for (let i = 2; i <= n; i++) s += Math.log(i);
    return s;
  }

  let modeK = 0;
  let modeProb = 0;
  for (let k = 0; k <= kMax; k++) {
    const logP = k * Math.log(safeLambda) - safeLambda - logFactorial(k);
    const p = Math.exp(logP);
    cumulative = Math.min(1, cumulative + p);
    pmf.push({ k, probability: Math.round(p * 10000) / 10000, cumulative: Math.round(cumulative * 10000) / 10000 });
    if (p > modeProb) { modeProb = p; modeK = k; }
  }

  // 90% CI: find 5th and 95th percentile
  let ci90Low = 0;
  let ci90High = kMax;
  for (const entry of pmf) {
    if (entry.cumulative >= 0.05 && ci90Low === 0) ci90Low = entry.k;
    if (entry.cumulative >= 0.95) { ci90High = entry.k; break; }
  }

  return { lambda: Math.round(safeLambda * 100) / 100, pmf, mode: modeK, ci90Low, ci90High, variance: Math.round(safeLambda * 100) / 100 };
}

// ─── 10. Geometric / Negative-Binomial Sales Cycle Model ─────────────────────
// Geometric: P(X = n) = p·(1-p)^(n-1),  E(X) = 1/p,  Var(X) = (1-p)/p²
// Neg-Binomial: P(Y = n) = C(n-1,r-1)·p^r·(1-p)^(n-r),  E(Y) = r/p
// Ref: Finan PV2020 §7.6, §7.7

export interface GeometricResult {
  closeRatePerPeriod: number;   // p — probability of closing in any given month
  expectedCycleMonths: number;  // E(X) = 1/p
  varianceCycles: number;       // Var(X) = (1-p)/p²
  pmf: { n: number; probability: number; cumulative: number }[];
  // Negative Binomial extension: time to r-th close
  quotaTarget: number;          // r — number of closes required
  expectedMonthsToQuota: number; // E(Y) = r/p
  nbPmf: { n: number; probability: number; cumulative: number }[];
}

export function geometricSalesCycle(
  closedDeals: number,
  totalPeriods: number,
  quotaTarget = 3,
  pOverride?: number
): GeometricResult {
  const p = pOverride !== undefined
    ? Math.max(0.001, Math.min(0.999, pOverride))
    : Math.max(0.001, Math.min(0.999, totalPeriods > 0 ? closedDeals / totalPeriods : 0.2));

  const q = 1 - p;
  const expectedCycleMonths = 1 / p;
  const varianceCycles = q / (p * p);

  // Geometric PMF up to 3× expected cycle or 48 months
  const nMax = Math.min(48, Math.ceil(expectedCycleMonths * 4));
  const pmf: { n: number; probability: number; cumulative: number }[] = [];
  let cumGeo = 0;
  for (let n = 1; n <= nMax; n++) {
    const prob = p * Math.pow(q, n - 1);
    cumGeo = Math.min(1, cumGeo + prob);
    pmf.push({ n, probability: Math.round(prob * 10000) / 10000, cumulative: Math.round(cumGeo * 10000) / 10000 });
  }

  // Negative Binomial PMF: number of trials to get r successes
  const r = Math.max(1, Math.round(quotaTarget));
  const expectedMonthsToQuota = r / p;
  const nbMax = Math.min(120, Math.ceil(expectedMonthsToQuota * 4));
  const nbPmf: { n: number; probability: number; cumulative: number }[] = [];
  let cumNB = 0;

  function logBinomCoeff(n: number, k: number): number {
    if (k < 0 || k > n) return -Infinity;
    let s = 0;
    for (let i = 0; i < k; i++) {
      s += Math.log(n - i) - Math.log(i + 1);
    }
    return s;
  }

  for (let n = r; n <= nbMax; n++) {
    const logP = logBinomCoeff(n - 1, r - 1) + r * Math.log(p) + (n - r) * Math.log(q);
    const prob = Math.exp(logP);
    cumNB = Math.min(1, cumNB + prob);
    nbPmf.push({ n, probability: Math.round(prob * 10000) / 10000, cumulative: Math.round(cumNB * 10000) / 10000 });
  }

  return {
    closeRatePerPeriod: Math.round(p * 1000) / 1000,
    expectedCycleMonths: Math.round(expectedCycleMonths * 10) / 10,
    varianceCycles: Math.round(varianceCycles * 100) / 100,
    pmf,
    quotaTarget: r,
    expectedMonthsToQuota: Math.round(expectedMonthsToQuota * 10) / 10,
    nbPmf,
  };
}

// ─── 11. Bayesian Win-Rate Updater ────────────────────────────────────────────
// Prior: Beta(α₀, β₀)   Posterior: Beta(α₀+W, β₀+L)
// Posterior mean: (α₀+W) / (α₀+β₀+W+L)
// 90% credible interval via Beta quantile approximation
// Ref: Finan PV2020 §5.2 (Bayes' formula, Law of Total Probability)

export interface BayesianResult {
  priorAlpha: number;
  priorBeta: number;
  wins: number;
  losses: number;
  posteriorAlpha: number;
  posteriorBeta: number;
  posteriorMean: number;          // posterior mean win rate
  posteriorMode: number;          // MAP estimate
  ci90Low: number;                // 5th percentile of posterior
  ci90High: number;               // 95th percentile of posterior
  priorCurve: { p: number; density: number }[];
  posteriorCurve: { p: number; density: number }[];
  // Law of Total Probability decomposition
  stageDecomposition: { stage: string; stageShare: number; stageWinRate: number; contribution: number }[];
  totalProbabilityWin: number;    // P(Win) = Σ P(Win|Stage) · P(Stage)
}

// Beta distribution PDF: f(x; α, β) = x^(α-1)·(1-x)^(β-1) / B(α,β)
// We use log-gamma for numerical stability
function logGamma(n: number): number {
  // Stirling approximation for large n; exact for small integers
  if (n <= 0) return 0;
  if (n < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * n)) - logGamma(1 - n);
  let x = n - 1;
  const coeffs = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let ser = 1.000000000190015;
  for (const c of coeffs) { x++; ser += c / x; }
  return (n + 0.5) * Math.log(n + 5.5) - (n + 5.5) + Math.log(2.5066282746310005 * ser / n);
}

function betaPDF(x: number, alpha: number, beta: number): number {
  if (x <= 0 || x >= 1) return 0;
  const logB = logGamma(alpha) + logGamma(beta) - logGamma(alpha + beta);
  return Math.exp((alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x) - logB);
}

// Approximate Beta quantile using Newton-Raphson on the regularised incomplete beta
function betaQuantile(p: number, alpha: number, beta: number): number {
  // Initial guess using normal approximation
  let x = alpha / (alpha + beta);
  for (let iter = 0; iter < 50; iter++) {
    const fx = regularisedIncompleteBeta(x, alpha, beta) - p;
    const dfx = betaPDF(x, alpha, beta);
    if (Math.abs(dfx) < 1e-12) break;
    const dx = fx / dfx;
    x = Math.max(1e-6, Math.min(1 - 1e-6, x - dx));
    if (Math.abs(dx) < 1e-8) break;
  }
  return x;
}

// Regularised incomplete beta I_x(a,b) via continued fraction (Lentz method)
function regularisedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  // Use symmetry relation for better convergence
  if (x > (a + 1) / (a + b + 2)) return 1 - regularisedIncompleteBeta(1 - x, b, a);
  const logBeta = logGamma(a) + logGamma(b) - logGamma(a + b);
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - logBeta) / a;
  // Lentz continued fraction
  let f = 1, C = 1, D = 1 - (a + b) * x / (a + 1);
  if (Math.abs(D) < 1e-30) D = 1e-30;
  D = 1 / D; f = D;
  for (let m = 1; m <= 200; m++) {
    let d = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m));
    D = 1 + d * D; if (Math.abs(D) < 1e-30) D = 1e-30; D = 1 / D;
    C = 1 + d / C; if (Math.abs(C) < 1e-30) C = 1e-30;
    f *= C * D;
    d = -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1));
    D = 1 + d * D; if (Math.abs(D) < 1e-30) D = 1e-30; D = 1 / D;
    C = 1 + d / C; if (Math.abs(C) < 1e-30) C = 1e-30;
    const delta = C * D; f *= delta;
    if (Math.abs(delta - 1) < 1e-10) break;
  }
  return front * f;
}

export function bayesianWinRate(
  wins: number,
  losses: number,
  priorAlpha = 1,
  priorBeta = 1,
  stageData?: { stage: string; stageShare: number; stageWinRate: number }[]
): BayesianResult {
  const W = Math.max(0, Math.round(wins));
  const L = Math.max(0, Math.round(losses));
  const a0 = Math.max(0.1, priorAlpha);
  const b0 = Math.max(0.1, priorBeta);

  const postAlpha = a0 + W;
  const postBeta = b0 + L;
  const posteriorMean = postAlpha / (postAlpha + postBeta);
  const posteriorMode = postAlpha > 1 && postBeta > 1
    ? (postAlpha - 1) / (postAlpha + postBeta - 2)
    : (postAlpha >= postBeta ? 1 : 0);

  // 90% credible interval
  const ci90Low = betaQuantile(0.05, postAlpha, postBeta);
  const ci90High = betaQuantile(0.95, postAlpha, postBeta);

  // Build prior and posterior density curves (101 points from 0.00 to 1.00)
  const points = Array.from({ length: 101 }, (_, i) => i / 100);
  const priorCurve = points.map(p => ({ p, density: Math.round(betaPDF(p, a0, b0) * 1000) / 1000 }));
  const posteriorCurve = points.map(p => ({ p, density: Math.round(betaPDF(p, postAlpha, postBeta) * 1000) / 1000 }));

  // Law of Total Probability decomposition
  const defaultStages = [
    { stage: 'Lead', stageShare: 0.30, stageWinRate: 0.10 },
    { stage: 'Qualified', stageShare: 0.25, stageWinRate: 0.25 },
    { stage: 'Proposal', stageShare: 0.25, stageWinRate: 0.45 },
    { stage: 'Negotiation', stageShare: 0.20, stageWinRate: 0.70 },
  ];
  const stages = stageData && stageData.length > 0 ? stageData : defaultStages;
  const stageDecomposition = stages.map(s => ({
    stage: s.stage,
    stageShare: s.stageShare,
    stageWinRate: s.stageWinRate,
    contribution: Math.round(s.stageShare * s.stageWinRate * 1000) / 1000,
  }));
  const totalProbabilityWin = Math.round(stageDecomposition.reduce((s, d) => s + d.contribution, 0) * 1000) / 1000;

  return {
    priorAlpha: a0,
    priorBeta: b0,
    wins: W,
    losses: L,
    posteriorAlpha: postAlpha,
    posteriorBeta: postBeta,
    posteriorMean: Math.round(posteriorMean * 1000) / 1000,
    posteriorMode: Math.round(posteriorMode * 1000) / 1000,
    ci90Low: Math.round(ci90Low * 1000) / 1000,
    ci90High: Math.round(ci90High * 1000) / 1000,
    priorCurve,
    posteriorCurve,
    stageDecomposition,
    totalProbabilityWin,
  };
}

// ─── Extended WhatIfParams ────────────────────────────────────────────────────
// Extend the existing WhatIfParams interface with actuarial model parameters

export interface ActuarialWhatIfParams {
  // Poisson
  poissonLambda: number;         // override arrival rate (deals/month)
  // Geometric / Negative Binomial
  closeRatePerPeriod: number;    // p — per-period close probability (0.01–0.99)
  quotaTarget: number;           // r — target number of closes for NB model
  // Bayesian
  bayesPriorAlpha: number;       // α₀ — prior successes (belief strength)
  bayesPriorBeta: number;        // β₀ — prior failures (belief strength)
}

export const DEFAULT_ACTUARIAL_PARAMS: ActuarialWhatIfParams = {
  poissonLambda: 5,
  closeRatePerPeriod: 0.20,
  quotaTarget: 3,
  bayesPriorAlpha: 1,
  bayesPriorBeta: 1,
};

// ─── 12. Per-Rep Poisson λ Breakdown ─────────────────────────────────────────
// Ref: Finan PV2020 §7.4

export interface RepPoissonEntry {
  repName: string;
  lambda: number;
  mode: number;
  ci90Low: number;
  ci90High: number;
  variance: number;
  share: number;
}

export interface RepPoissonResult {
  reps: RepPoissonEntry[];
  totalLambda: number;
  topRep: string;
  bottomRep: string;
  lambdaCV: number;
}

export function perRepPoisson(repData: { repName: string; monthlyCounts: number[]; lambda: number }[]): RepPoissonResult {
  if (repData.length === 0) {
    return { reps: [], totalLambda: 0, topRep: "", bottomRep: "", lambdaCV: 0 };
  }

  const totalLambda = repData.reduce((s, r) => s + r.lambda, 0);

  function logFactorial(n: number): number {
    if (n <= 1) return 0;
    let s = 0;
    for (let i = 2; i <= n; i++) s += Math.log(i);
    return s;
  }

  const reps: RepPoissonEntry[] = repData.map(r => {
    const lam = Math.max(0.01, r.lambda);
    const kMax = Math.max(20, Math.ceil(lam * 4));
    let modeK = 0, modeProb = 0;
    let cumulative = 0;
    let ci90Low = 0, ci90High = kMax;
    for (let k = 0; k <= kMax; k++) {
      const logP = k * Math.log(lam) - lam - logFactorial(k);
      const p = Math.exp(logP);
      cumulative = Math.min(1, cumulative + p);
      if (p > modeProb) { modeProb = p; modeK = k; }
      if (cumulative >= 0.05 && ci90Low === 0) ci90Low = k;
      if (cumulative >= 0.95 && ci90High === kMax) ci90High = k;
    }
    return {
      repName: r.repName,
      lambda: Math.round(lam * 100) / 100,
      mode: modeK,
      ci90Low,
      ci90High,
      variance: Math.round(lam * 100) / 100,
      share: totalLambda > 0 ? Math.round((lam / totalLambda) * 1000) / 1000 : 0,
    };
  });

  const sorted = [...reps].sort((a, b) => b.lambda - a.lambda);
  const mean = totalLambda / reps.length;
  const variance = reps.reduce((s, r) => s + (r.lambda - mean) ** 2, 0) / reps.length;
  const lambdaCV = mean > 0 ? Math.round((Math.sqrt(variance) / mean) * 1000) / 1000 : 0;

  return {
    reps,
    totalLambda: Math.round(totalLambda * 100) / 100,
    topRep: sorted[0]?.repName ?? "",
    bottomRep: sorted[sorted.length - 1]?.repName ?? "",
    lambdaCV,
  };
}

// ─── 13. Survival / Hazard Function for Deal Age-in-Stage ────────────────────
// Kaplan-Meier estimator: S(t) = Π_{t_i ≤ t} (1 − d_i / n_i)
// Ref: Finan PV2020 §13

export interface KMEntry {
  t: number;
  survival: number;
  hazard: number;
  atRisk: number;
  events: number;
}

export interface AtRiskEntry {
  stage: string;
  count: number;
  medianAge: number;
  pctAtRisk: number;
}

export interface SurvivalResult {
  kmCurve: KMEntry[];
  medianSurvival: number;
  meanSurvival: number;
  atRiskTable: AtRiskEntry[];
}

export function survivalHazard(dealAges: { stage: string; ageMonths: number; isEvent: boolean }[]): SurvivalResult {
  if (dealAges.length === 0) {
    return { kmCurve: [], medianSurvival: 0, meanSurvival: 0, atRiskTable: [] };
  }

  const maxT = Math.max(...dealAges.map(d => d.ageMonths), 1);
  const kmCurve: KMEntry[] = [];
  let S = 1;

  for (let t = 0; t <= maxT; t++) {
    const atRisk = dealAges.filter(d => d.ageMonths >= t).length;
    const died = dealAges.filter(d => d.ageMonths === t && d.isEvent).length;
    if (atRisk === 0) continue;
    const h = died / atRisk;
    S = S * (1 - h);
    kmCurve.push({ t, survival: Math.round(S * 1000) / 1000, hazard: Math.round(h * 1000) / 1000, atRisk, events: died });
  }

  const medianEntry = kmCurve.find(e => e.survival <= 0.5);
  const medianSurvival = medianEntry?.t ?? maxT;

  let meanSurvival = 0;
  for (let i = 1; i < kmCurve.length; i++) {
    const dt = kmCurve[i].t - kmCurve[i - 1].t;
    meanSurvival += kmCurve[i - 1].survival * dt;
  }

  const stageMap = new Map<string, number[]>();
  for (const d of dealAges) {
    if (!stageMap.has(d.stage)) stageMap.set(d.stage, []);
    stageMap.get(d.stage)!.push(d.ageMonths);
  }
  const total = dealAges.length;
  const atRiskTable: AtRiskEntry[] = Array.from(stageMap.entries()).map(([stage, ages]) => {
    const sorted = [...ages].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0
      ? ((sorted[sorted.length / 2 - 1] ?? 0) + (sorted[sorted.length / 2] ?? 0)) / 2
      : sorted[Math.floor(sorted.length / 2)] ?? 0;
    return { stage, count: ages.length, medianAge: Math.round(median * 10) / 10, pctAtRisk: Math.round((ages.length / total) * 1000) / 1000 };
  }).sort((a, b) => b.count - a.count);

  return { kmCurve, medianSurvival, meanSurvival: Math.round(meanSurvival * 10) / 10, atRiskTable };
}

// ─── 14. Bayesian Prior Calibration ──────────────────────────────────────────
// Converts a plain-English belief (win rate + confidence) into Beta(α, β) parameters.
// Method of moments: α = μ·κ,  β = (1−μ)·κ  where κ = concentration (effective sample size)
// Confidence levels map to κ: low=5, medium=20, high=50, very_high=100

export type ConfidenceLevel = "low" | "medium" | "high" | "very_high";

export interface BayesPriorCalibrationResult {
  alpha: number;
  beta: number;
  priorMean: number;
  priorMode: number;
  ci90Low: number;
  ci90High: number;
  concentration: number;
  curve: { p: number; density: number }[];
}

const CONCENTRATION_MAP: Record<ConfidenceLevel, number> = {
  low: 5,
  medium: 20,
  high: 50,
  very_high: 100,
};

export function bayesPriorCalibration(
  beliefWinRate: number,   // 0–1, e.g. 0.30 for "I believe ~30% win rate"
  confidence: ConfidenceLevel
): BayesPriorCalibrationResult {
  const mu = Math.max(0.01, Math.min(0.99, beliefWinRate));
  const kappa = CONCENTRATION_MAP[confidence];
  const alpha = Math.round(mu * kappa * 100) / 100;
  const beta = Math.round((1 - mu) * kappa * 100) / 100;

  // Reuse betaPDF and betaQuantile from bayesianWinRate closure — inline here
  function logGamma(n: number): number {
    if (n <= 0) return 0;
    if (n < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * n)) - logGamma(1 - n);
    let x = n - 1;
    const coeffs = [76.18009172947146, -86.50532032941677, 24.01409824083091,
      -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let ser = 1.000000000190015;
    for (const c of coeffs) { x++; ser += c / x; }
    return (n + 0.5) * Math.log(n + 5.5) - (n + 5.5) + Math.log(2.5066282746310005 * ser / n);
  }

  function betaPDF(x: number, a: number, b: number): number {
    if (x <= 0 || x >= 1) return 0;
    const logB = logGamma(a) + logGamma(b) - logGamma(a + b);
    return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - logB);
  }

  function regularisedIncompleteBeta(x: number, a: number, b: number): number {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    if (x > (a + 1) / (a + b + 2)) return 1 - regularisedIncompleteBeta(1 - x, b, a);
    const logBeta = logGamma(a) + logGamma(b) - logGamma(a + b);
    const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - logBeta) / a;
    let f = 1, C = 1, D = 1 - (a + b) * x / (a + 1);
    if (Math.abs(D) < 1e-30) D = 1e-30;
    D = 1 / D; f = D;
    for (let m = 1; m <= 200; m++) {
      let d = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m));
      D = 1 + d * D; if (Math.abs(D) < 1e-30) D = 1e-30; D = 1 / D;
      C = 1 + d / C; if (Math.abs(C) < 1e-30) C = 1e-30;
      f *= C * D;
      d = -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1));
      D = 1 + d * D; if (Math.abs(D) < 1e-30) D = 1e-30; D = 1 / D;
      C = 1 + d / C; if (Math.abs(C) < 1e-30) C = 1e-30;
      const delta = C * D; f *= delta;
      if (Math.abs(delta - 1) < 1e-10) break;
    }
    return front * f;
  }

  function betaQuantile(p: number, a: number, b: number): number {
    let x = a / (a + b);
    for (let iter = 0; iter < 50; iter++) {
      const fx = regularisedIncompleteBeta(x, a, b) - p;
      const dfx = betaPDF(x, a, b);
      if (Math.abs(dfx) < 1e-12) break;
      const dx = fx / dfx;
      x = Math.max(1e-6, Math.min(1 - 1e-6, x - dx));
      if (Math.abs(dx) < 1e-8) break;
    }
    return x;
  }

  const priorMean = alpha / (alpha + beta);
  const priorMode = alpha > 1 && beta > 1 ? (alpha - 1) / (alpha + beta - 2) : (alpha >= beta ? 1 : 0);
  const ci90Low = betaQuantile(0.05, alpha, beta);
  const ci90High = betaQuantile(0.95, alpha, beta);
  const curve = Array.from({ length: 101 }, (_, i) => i / 100).map(p => ({
    p,
    density: Math.round(betaPDF(p, alpha, beta) * 1000) / 1000,
  }));

  return {
    alpha,
    beta,
    priorMean: Math.round(priorMean * 1000) / 1000,
    priorMode: Math.round(priorMode * 1000) / 1000,
    ci90Low: Math.round(ci90Low * 1000) / 1000,
    ci90High: Math.round(ci90High * 1000) / 1000,
    concentration: kappa,
    curve,
  };
}
