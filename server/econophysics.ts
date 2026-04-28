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

// ─── Actuarial Models (Finan PV2020) ─────────────────────────────────────────
// Source: Marcel B. Finan, "A Probability Course for the Actuaries" (PV2020)
//         Arkansas Tech University, Revised 2020 Edition

// ─── 9. Poisson Deal-Arrival Model ───────────────────────────────────────────
// P(X = k) = e^(-λ) · λ^k / k!   where λ = mean arrivals per period
// E(X) = Var(X) = λ
// Ref: Finan PV2020 §7.4

export function poissonDealArrival(monthlyDealCounts: number[], overrideLambda?: number): {
  lambda: number;
  pmf: { k: number; probability: number; cumulative: number }[];
  mode: number;
  ci90Low: number;
  ci90High: number;
  variance: number;
} {
  const valid = monthlyDealCounts.filter(c => c >= 0 && Number.isFinite(c));
  const estimatedLambda = valid.length > 0 ? valid.reduce((s, c) => s + c, 0) / valid.length : 1;
  const lambda = overrideLambda !== undefined && overrideLambda > 0 ? overrideLambda : estimatedLambda;
  const safeLambda = Math.max(0.01, lambda);

  function logFactorial(n: number): number {
    if (n <= 1) return 0;
    let s = 0;
    for (let i = 2; i <= n; i++) s += Math.log(i);
    return s;
  }

  const kMax = Math.max(30, Math.ceil(safeLambda * 4));
  const pmf: { k: number; probability: number; cumulative: number }[] = [];
  let cumulative = 0;
  let modeK = 0;
  let modeProb = 0;

  for (let k = 0; k <= kMax; k++) {
    const logP = k * Math.log(safeLambda) - safeLambda - logFactorial(k);
    const p = Math.exp(logP);
    cumulative = Math.min(1, cumulative + p);
    pmf.push({ k, probability: Math.round(p * 10000) / 10000, cumulative: Math.round(cumulative * 10000) / 10000 });
    if (p > modeProb) { modeProb = p; modeK = k; }
  }

  let ci90Low = 0;
  let ci90High = kMax;
  for (const entry of pmf) {
    if (entry.cumulative >= 0.05 && ci90Low === 0) ci90Low = entry.k;
    if (entry.cumulative >= 0.95) { ci90High = entry.k; break; }
  }

  return {
    lambda: Math.round(safeLambda * 100) / 100,
    pmf,
    mode: modeK,
    ci90Low,
    ci90High,
    variance: Math.round(safeLambda * 100) / 100,
  };
}

// ─── 10. Geometric / Negative-Binomial Sales Cycle Model ─────────────────────
// Geometric: P(X = n) = p·(1-p)^(n-1),  E(X) = 1/p,  Var(X) = (1-p)/p²
// Neg-Binomial: P(Y = n) = C(n-1,r-1)·p^r·(1-p)^(n-r),  E(Y) = r/p
// Ref: Finan PV2020 §7.6, §7.7

export function geometricSalesCycle(
  closedDeals: number,
  totalPeriods: number,
  quotaTarget = 3,
  overrideCloseRate?: number
): {
  closeRatePerPeriod: number;
  expectedCycleMonths: number;
  varianceCycles: number;
  pmf: { n: number; probability: number; cumulative: number }[];
  quotaTarget: number;
  expectedMonthsToQuota: number;
  nbPmf: { n: number; probability: number; cumulative: number }[];
} {
  const estimatedP = totalPeriods > 0 ? closedDeals / totalPeriods : 0.2;
  const p = Math.max(0.001, Math.min(0.999, overrideCloseRate !== undefined ? overrideCloseRate : estimatedP));
  const q = 1 - p;
  const expectedCycleMonths = 1 / p;
  const varianceCycles = q / (p * p);

  const nMax = Math.min(48, Math.ceil(expectedCycleMonths * 4));
  const pmf: { n: number; probability: number; cumulative: number }[] = [];
  let cumGeo = 0;
  for (let n = 1; n <= nMax; n++) {
    const prob = p * Math.pow(q, n - 1);
    cumGeo = Math.min(1, cumGeo + prob);
    pmf.push({ n, probability: Math.round(prob * 10000) / 10000, cumulative: Math.round(cumGeo * 10000) / 10000 });
  }

  const r = Math.max(1, Math.round(quotaTarget));
  const expectedMonthsToQuota = r / p;
  const nbMax = Math.min(120, Math.ceil(expectedMonthsToQuota * 4));
  const nbPmf: { n: number; probability: number; cumulative: number }[] = [];
  let cumNB = 0;

  function logBinomCoeff(n: number, k: number): number {
    if (k < 0 || k > n) return -Infinity;
    let s = 0;
    for (let i = 0; i < k; i++) s += Math.log(n - i) - Math.log(i + 1);
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
// Ref: Finan PV2020 §5.2 (Bayes' formula, Law of Total Probability)

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

function betaPDF(x: number, alpha: number, beta: number): number {
  if (x <= 0 || x >= 1) return 0;
  const logB = logGamma(alpha) + logGamma(beta) - logGamma(alpha + beta);
  return Math.exp((alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x) - logB);
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

function betaQuantile(p: number, alpha: number, beta: number): number {
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

export function bayesianWinRate(
  wins: number,
  losses: number,
  priorAlpha = 1,
  priorBeta = 1,
  stageData?: { stage: string; stageShare: number; stageWinRate: number }[]
): {
  priorAlpha: number;
  priorBeta: number;
  wins: number;
  losses: number;
  posteriorAlpha: number;
  posteriorBeta: number;
  posteriorMean: number;
  posteriorMode: number;
  ci90Low: number;
  ci90High: number;
  priorCurve: { p: number; density: number }[];
  posteriorCurve: { p: number; density: number }[];
  stageDecomposition: { stage: string; stageShare: number; stageWinRate: number; contribution: number }[];
  totalProbabilityWin: number;
} {
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

  const ci90Low = betaQuantile(0.05, postAlpha, postBeta);
  const ci90High = betaQuantile(0.95, postAlpha, postBeta);

  const points = Array.from({ length: 101 }, (_, i) => i / 100);
  const priorCurve = points.map(p => ({ p, density: Math.round(betaPDF(p, a0, b0) * 1000) / 1000 }));
  const posteriorCurve = points.map(p => ({ p, density: Math.round(betaPDF(p, postAlpha, postBeta) * 1000) / 1000 }));

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
    priorAlpha: a0, priorBeta: b0, wins: W, losses: L,
    posteriorAlpha: postAlpha, posteriorBeta: postBeta,
    posteriorMean: Math.round(posteriorMean * 1000) / 1000,
    posteriorMode: Math.round(posteriorMode * 1000) / 1000,
    ci90Low: Math.round(ci90Low * 1000) / 1000,
    ci90High: Math.round(ci90High * 1000) / 1000,
    priorCurve, posteriorCurve, stageDecomposition, totalProbabilityWin,
  };
}
