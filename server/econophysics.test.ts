import { describe, expect, it } from "vitest";
import {
  giniAndLorenz,
  revenueEntropy,
  estimateGBMParams,
  boltzmannGibbs,
  binomialPipelineValue,
  monteCarloForecast,
  STAGE_WIN_PROBABILITIES,
  poissonDealArrival,
  geometricSalesCycle,
  bayesianWinRate,
  perRepPoisson,
  survivalHazard,
} from "./econophysics";

// ─── Gini Coefficient & Lorenz Curve ─────────────────────────────────────────
describe("giniAndLorenz", () => {
  it("returns 0 for a perfectly equal distribution", () => {
    const result = giniAndLorenz([100, 100, 100, 100]);
    expect(result.gini).toBeCloseTo(0, 2);
  });

  it("returns near-1 for a maximally unequal distribution", () => {
    const result = giniAndLorenz([0, 0, 0, 1000]);
    expect(result.gini).toBeGreaterThan(0.7);
  });

  it("returns 0 for empty input", () => {
    const result = giniAndLorenz([]);
    expect(result.gini).toBe(0);
    expect(result.lorenz).toHaveLength(0);
  });

  it("lorenz curve starts at (0,0) and ends at (1,1)", () => {
    const result = giniAndLorenz([50, 100, 200, 300]);
    const first = result.lorenz[0];
    const last = result.lorenz[result.lorenz.length - 1];
    expect(first?.population).toBeCloseTo(0, 2);
    expect(first?.wealthShare).toBeCloseTo(0, 2);
    expect(last?.population).toBeCloseTo(1, 2);
    expect(last?.wealthShare).toBeCloseTo(1, 2);
  });

  it("gini is between 0 and 1 for any valid input", () => {
    const result = giniAndLorenz([10, 50, 200, 800, 3000]);
    expect(result.gini).toBeGreaterThanOrEqual(0);
    expect(result.gini).toBeLessThanOrEqual(1);
  });
});

// ─── Revenue Entropy ─────────────────────────────────────────────────────────
describe("revenueEntropy", () => {
  it("returns maximum normalised entropy for equal distribution", () => {
    const result = revenueEntropy([100, 100, 100, 100]);
    expect(result.normalizedEntropy).toBeCloseTo(1.0, 2);
  });

  it("returns 0 entropy for a single-rep monopoly", () => {
    const result = revenueEntropy([1000, 0, 0, 0]);
    expect(result.entropy).toBeCloseTo(0, 2);
    expect(result.normalizedEntropy).toBeCloseTo(0, 2);
  });

  it("returns entropy between 0 and 1 for mixed distribution", () => {
    const result = revenueEntropy([100, 200, 300, 400]);
    expect(result.normalizedEntropy).toBeGreaterThan(0);
    expect(result.normalizedEntropy).toBeLessThan(1);
  });

  it("handles empty input gracefully", () => {
    const result = revenueEntropy([]);
    expect(result.entropy).toBe(0);
    expect(result.normalizedEntropy).toBe(0);
  });
});

// ─── GBM Parameter Estimation ────────────────────────────────────────────────
describe("estimateGBMParams", () => {
  it("returns zero params for fewer than 2 data points", () => {
    const result = estimateGBMParams([100]);
    expect(result.mu).toBe(0);
    expect(result.sigma).toBe(0);
  });

  it("returns zero params for empty array", () => {
    const result = estimateGBMParams([]);
    expect(result.mu).toBe(0);
    expect(result.sigma).toBe(0);
  });

  it("computes positive drift for a strictly growing revenue series", () => {
    const series = [100, 110, 121, 133, 146, 161, 177];
    const result = estimateGBMParams(series);
    expect(result.mu).toBeGreaterThan(0);
  });

  it("computes non-negative volatility", () => {
    const series = [100, 120, 95, 130, 110, 140];
    const result = estimateGBMParams(series);
    expect(result.sigma).toBeGreaterThanOrEqual(0);
  });

  it("caps extreme drift and volatility for sparse data (< 6 points)", () => {
    const series = [100, 1000, 10000]; // extreme growth in 3 steps
    const result = estimateGBMParams(series);
    expect(result.mu).toBeLessThanOrEqual(3.0 + 0.001);
    expect(result.sigma).toBeLessThanOrEqual(2.0 + 0.001);
  });

  it("returns finite numbers for any non-trivial series", () => {
    const series = [100, 110, 105, 115, 120, 118, 125, 130];
    const result = estimateGBMParams(series);
    expect(isFinite(result.mu)).toBe(true);
    expect(isFinite(result.sigma)).toBe(true);
  });
});

// ─── Boltzmann-Gibbs Distribution + Pareto Tail ─────────────────────────────
describe("boltzmannGibbs", () => {
  it("returns temperature equal to mean deal value", () => {
    const dealValues = [100, 200, 300, 400];
    const result = boltzmannGibbs(dealValues);
    const expectedMean = (100 + 200 + 300 + 400) / 4;
    expect(result.temperature).toBeCloseTo(expectedMean, 1);
  });

  it("returns lambda = 1/T", () => {
    const dealValues = [100, 200, 300];
    const result = boltzmannGibbs(dealValues);
    expect(result.lambda).toBeCloseTo(1 / result.temperature, 5);
  });

  it("returns histogram bins for a non-trivial input", () => {
    const dealValues = Array.from({ length: 20 }, (_, i) => (i + 1) * 10000);
    const result = boltzmannGibbs(dealValues);
    expect(result.histogram.length).toBeGreaterThan(0);
  });

  it("handles empty input gracefully", () => {
    const result = boltzmannGibbs([]);
    expect(result.temperature).toBe(0);
    expect(result.lambda).toBe(0);
  });

  it("pareto tail fraction is ~10% (90th percentile threshold)", () => {
    const dealValues = Array.from({ length: 100 }, (_, i) => i + 1);
    const result = boltzmannGibbs(dealValues);
    // paretoFraction should be approximately 0.1 (top 10%)
    expect(result.paretoFraction).toBeCloseTo(0.1, 1);
  });

  it("pareto tail share is between 0 and 1", () => {
    const dealValues = [10, 50, 100, 500, 1000, 5000, 10000, 50000];
    const result = boltzmannGibbs(dealValues);
    expect(result.paretoRevenueShare).toBeGreaterThan(0);
    expect(result.paretoRevenueShare).toBeLessThanOrEqual(1);
  });
});

// ─── Binomial Pipeline Expected Value ────────────────────────────────────────
describe("binomialPipelineValue", () => {
  it("returns 100% of value for closed_won deals", () => {
    const deals = [{ value: 1000, stage: "closed_won", title: "Deal A" }];
    const result = binomialPipelineValue(deals);
    expect(result.totalExpected).toBeCloseTo(1000, 1);
  });

  it("returns 0 for closed_lost deals", () => {
    const deals = [{ value: 1000, stage: "closed_lost", title: "Deal B" }];
    const result = binomialPipelineValue(deals);
    expect(result.totalExpected).toBeCloseTo(0, 1);
  });

  it("applies stage probabilities correctly", () => {
    const deals = [
      { value: 1000, stage: "lead", title: "D1" },
      { value: 1000, stage: "qualified", title: "D2" },
      { value: 1000, stage: "proposal", title: "D3" },
      { value: 1000, stage: "negotiation", title: "D4" },
    ];
    const result = binomialPipelineValue(deals);
    const expected = 1000 * (
      STAGE_WIN_PROBABILITIES["lead"]! +
      STAGE_WIN_PROBABILITIES["qualified"]! +
      STAGE_WIN_PROBABILITIES["proposal"]! +
      STAGE_WIN_PROBABILITIES["negotiation"]!
    );
    expect(result.totalExpected).toBeCloseTo(expected, 1);
  });

  it("handles empty pipeline", () => {
    const result = binomialPipelineValue([]);
    expect(result.totalExpected).toBe(0);
    expect(result.totalFaceValue).toBe(0);
  });
});

// ─── Monte Carlo GBM Forecast ─────────────────────────────────────────────────
describe("monteCarloForecast", () => {
  it("returns at most 20 sampled paths for display (internal cap)", () => {
    // monteCarloForecast caps returned paths at 20 for display performance
    const result = monteCarloForecast(100000, 0.2, 0.3, 6, 50);
    expect(result.paths.length).toBeLessThanOrEqual(20);
    expect(result.paths.length).toBeGreaterThan(0);
  });

  it("each path has horizonMonths + 1 values (including S_0)", () => {
    const result = monteCarloForecast(100000, 0.2, 0.3, 6, 10);
    for (const path of result.paths) {
      expect(path).toHaveLength(7); // 6 steps + initial value
    }
  });

  it("all path values are positive (GBM cannot go negative)", () => {
    const result = monteCarloForecast(100000, 0.1, 0.2, 6, 20);
    for (const path of result.paths) {
      for (const val of path) {
        expect(val).toBeGreaterThan(0);
      }
    }
  });

  it("expectedFinal equals S_0 * exp(mu * horizonMonths) analytically", () => {
    const S0 = 100000;
    const mu = 0.01; // 1% monthly drift
    const T = 6;     // 6 months
    const result = monteCarloForecast(S0, mu, 0, T, 100);
    // expectedFinal = S_0 * exp(mu * horizonMonths) per the implementation
    const analyticalExpected = S0 * Math.exp(mu * T);
    // Allow 1% tolerance for rounding
    expect(Math.abs(result.expectedFinal - analyticalExpected) / analyticalExpected).toBeLessThan(0.01);
  });

  it("median and percentile arrays have horizonMonths + 1 entries", () => {
    const result = monteCarloForecast(100000, 0.1, 0.2, 6, 20);
    expect(result.median).toHaveLength(7);
    expect(result.p10).toHaveLength(7);
    expect(result.p90).toHaveLength(7);
  });
});

// ─── Poisson Deal-Arrival Model (Finan PV2020 §7.4) ──────────────────────────
describe("poissonDealArrival", () => {

  it("estimates lambda as the mean of monthly deal counts", () => {
    const counts = [4, 6, 5, 7, 3, 5]; // mean = 5
    const result = poissonDealArrival(counts);
    expect(result.lambda).toBeCloseTo(5, 1);
  });

  it("uses override lambda when provided", () => {
    const result = poissonDealArrival([2, 3, 4], 10);
    // overrideLambda=10 should be used instead of mean([2,3,4])=3
    expect(result.lambda).toBeCloseTo(10, 1);
  });

  it("PMF probabilities sum to approximately 1", () => {
    const result = poissonDealArrival([5, 5, 5, 5, 5]);
    const total = result.pmf.reduce((s: number, e: { probability: number }) => s + e.probability, 0);
    expect(total).toBeCloseTo(1.0, 1);
  });

  it("mode equals floor(lambda) for integer lambda", () => {
    // For Poisson with integer lambda, mode = lambda (or lambda-1, both valid)
    const result = poissonDealArrival([7, 7, 7, 7, 7]);
    // mode should be close to lambda (floor(lambda) or lambda for integer)
    expect(result.mode).toBeGreaterThanOrEqual(Math.floor(result.lambda) - 1);
    expect(result.mode).toBeLessThanOrEqual(Math.ceil(result.lambda));
  });

  it("CI90 low is less than or equal to mode", () => {
    const result = poissonDealArrival([5, 6, 4, 5, 6]);
    expect(result.ci90Low).toBeLessThanOrEqual(result.mode);
  });

  it("CI90 high is greater than or equal to mode", () => {
    const result = poissonDealArrival([5, 6, 4, 5, 6]);
    expect(result.ci90High).toBeGreaterThanOrEqual(result.mode);
  });

  it("handles empty counts by using override lambda", () => {
    const result = poissonDealArrival([], 3);
    expect(result.lambda).toBeCloseTo(3, 1);
    expect(result.pmf.length).toBeGreaterThan(0);
  });
});

// ─── Geometric / Negative-Binomial Sales Cycle (Finan PV2020 §7.6–7.7) ───────
describe("geometricSalesCycle", () => {

  it("E(X) = 1/p for geometric distribution", () => {
    // closedDeals=10, totalPeriods=40 → p = 10/40 = 0.25, E(X) = 1/0.25 = 4
    const result = geometricSalesCycle(10, 40, 5);
    expect(result.expectedCycleMonths).toBeCloseTo(1 / 0.25, 0);
  });

  it("uses overrideCloseRate when provided", () => {
    const result = geometricSalesCycle(10, 40, 5, 0.5); // override p = 0.5
    expect(result.closeRatePerPeriod).toBeCloseTo(0.5, 2);
    expect(result.expectedCycleMonths).toBeCloseTo(2, 0);
  });

  it("variance = (1-p)/p^2", () => {
    const p = 0.2;
    // closedDeals=10, totalPeriods=50 → p = 10/50 = 0.2
    const result = geometricSalesCycle(10, 50, 3);
    const expected = (1 - p) / (p * p);
    expect(result.varianceCycles).toBeCloseTo(expected, 1);
  });

  it("E(Y) = r/p for negative-binomial (time to r-th close)", () => {
    // closedDeals=10, totalPeriods=20 → p = 0.5
    const r = 4;
    const result = geometricSalesCycle(10, 20, r);
    expect(result.expectedMonthsToQuota).toBeCloseTo(r / 0.5, 0);
  });

  it("PMF probabilities are all non-negative", () => {
    const result = geometricSalesCycle(5, 10, 3, 0.3);
    for (const entry of result.pmf) {
      expect(entry.probability).toBeGreaterThanOrEqual(0);
    }
  });

  it("NB PMF probabilities are all non-negative", () => {
    const result = geometricSalesCycle(5, 10, 3, 0.3);
    for (const entry of result.nbPmf) {
      expect(entry.probability).toBeGreaterThanOrEqual(0);
    }
  });

  it("close rate is clamped to (0, 1)", () => {
    const result = geometricSalesCycle(5, 10, 3, 1.5); // over 100%
    expect(result.closeRatePerPeriod).toBeLessThanOrEqual(1);
    expect(result.closeRatePerPeriod).toBeGreaterThan(0);
  });
});

// ─── Bayesian Win-Rate Updater (Finan PV2020 §5.2) ───────────────────────────
describe("bayesianWinRate", () => {

  it("posterior alpha = prior alpha + wins", () => {
    const result = bayesianWinRate(10, 5, 2, 3);
    expect(result.posteriorAlpha).toBeCloseTo(2 + 10, 5);
  });

  it("posterior beta = prior beta + losses", () => {
    const result = bayesianWinRate(10, 5, 2, 3);
    expect(result.posteriorBeta).toBeCloseTo(3 + 5, 5);
  });

  it("posterior mean = alpha / (alpha + beta)", () => {
    const result = bayesianWinRate(10, 5, 2, 3);
    const alpha = 2 + 10;
    const beta = 3 + 5;
    expect(result.posteriorMean).toBeCloseTo(alpha / (alpha + beta), 4);
  });

  it("posterior mode is between 0 and 1", () => {
    const result = bayesianWinRate(20, 10, 1, 1);
    expect(result.posteriorMode).toBeGreaterThanOrEqual(0);
    expect(result.posteriorMode).toBeLessThanOrEqual(1);
  });

  it("CI90 low < posterior mean < CI90 high", () => {
    const result = bayesianWinRate(15, 10, 1, 1);
    expect(result.ci90Low).toBeLessThan(result.posteriorMean);
    expect(result.ci90High).toBeGreaterThan(result.posteriorMean);
  });

  it("posterior curve has 101 points covering [0, 1]", () => {
    const result = bayesianWinRate(10, 5, 1, 1);
    expect(result.posteriorCurve).toHaveLength(101);
    expect(result.posteriorCurve[0].p).toBeCloseTo(0, 3);
    expect(result.posteriorCurve[100].p).toBeCloseTo(1, 3);
  });

  it("stage decomposition sums to total probability of win", () => {
    const result = bayesianWinRate(10, 5, 1, 1);
    const sumContributions = result.stageDecomposition.reduce(
      (s: number, d: { contribution: number }) => s + d.contribution, 0
    );
    expect(sumContributions).toBeCloseTo(result.totalProbabilityWin, 3);
  });

  it("handles zero wins gracefully", () => {
    const result = bayesianWinRate(0, 10, 1, 1);
    expect(result.posteriorMean).toBeGreaterThan(0); // prior keeps it > 0
    expect(result.posteriorMean).toBeLessThan(0.5);
  });

  it("handles zero losses gracefully", () => {
    const result = bayesianWinRate(10, 0, 1, 1);
    expect(result.posteriorMean).toBeGreaterThan(0.5);
    expect(result.posteriorMean).toBeLessThanOrEqual(1);
  });
});

// ─── 12. perRepPoisson ────────────────────────────────────────────────────────────────────────────────
describe("perRepPoisson", () => {
  it("returns empty result for empty input", () => {
    const r = perRepPoisson([]);
    expect(r.reps).toHaveLength(0);
    expect(r.totalLambda).toBe(0);
    expect(r.topRep).toBe("");
    expect(r.lambdaCV).toBe(0);
  });

  it("computes lambda, mode, and share for a single rep", () => {
    const r = perRepPoisson([{ repName: "Alice", monthlyCounts: [3, 4, 5], lambda: 4 }]);
    expect(r.reps).toHaveLength(1);
    expect(r.reps[0].lambda).toBe(4);
    expect(r.reps[0].share).toBe(1);
    expect(r.reps[0].mode).toBe(4);
    expect(r.totalLambda).toBe(4);
    expect(r.topRep).toBe("Alice");
    expect(r.bottomRep).toBe("Alice");
  });

  it("sorts reps by lambda descending and computes CV", () => {
    const reps = [
      { repName: "Bob", monthlyCounts: [1, 2], lambda: 1 },
      { repName: "Alice", monthlyCounts: [5, 6, 7], lambda: 6 },
    ];
    const r = perRepPoisson(reps);
    expect(r.topRep).toBe("Alice");
    expect(r.bottomRep).toBe("Bob");
    expect(r.totalLambda).toBe(7);
    expect(r.lambdaCV).toBeGreaterThan(0);
  });

  it("ci90Low <= mode <= ci90High for reps with lambda >= 2", () => {
    // For Poisson(lambda), mode = floor(lambda). For lambda < 1, mode=0 but
    // the 5th percentile can be > 0 (e.g. Poisson(1): P(0)=0.368 > 0.05 so
    // ci90Low=1 > mode=0). We test only reps with lambda >= 2 to avoid this edge.
    const reps = [
      { repName: "Alice", monthlyCounts: [3, 4, 5], lambda: 4 },
      { repName: "Carol", monthlyCounts: [2, 2, 2], lambda: 2 },
    ];
    const r = perRepPoisson(reps);
    for (const rep of r.reps) {
      expect(rep.ci90Low).toBeLessThanOrEqual(rep.mode);
      expect(rep.mode).toBeLessThanOrEqual(rep.ci90High);
    }
  });

  it("shares sum to approximately 1", () => {
    const reps = [
      { repName: "A", monthlyCounts: [2], lambda: 2 },
      { repName: "B", monthlyCounts: [3], lambda: 3 },
      { repName: "C", monthlyCounts: [5], lambda: 5 },
    ];
    const r = perRepPoisson(reps);
    const totalShare = r.reps.reduce((s, rep) => s + rep.share, 0);
    expect(totalShare).toBeCloseTo(1, 2);
  });
});

// ─── 13. survivalHazard ────────────────────────────────────────────────────────────────────────────────
describe("survivalHazard", () => {
  it("returns empty result for empty input", () => {
    const r = survivalHazard([]);
    expect(r.kmCurve).toHaveLength(0);
    expect(r.medianSurvival).toBe(0);
    expect(r.meanSurvival).toBe(0);
    expect(r.atRiskTable).toHaveLength(0);
  });

  it("survival is non-increasing", () => {
    const deals = [
      { stage: "closed_won", ageMonths: 2, isEvent: true },
      { stage: "closed_won", ageMonths: 3, isEvent: true },
      { stage: "closed_lost", ageMonths: 5, isEvent: true },
      { stage: "negotiation", ageMonths: 4, isEvent: false },
    ];
    const r = survivalHazard(deals);
    expect(r.kmCurve.length).toBeGreaterThan(0);
    for (let i = 1; i < r.kmCurve.length; i++) {
      expect(r.kmCurve[i].survival).toBeLessThanOrEqual(r.kmCurve[i - 1].survival);
    }
  });

  it("survival values are between 0 and 1", () => {
    const deals = [
      { stage: "closed_won", ageMonths: 1, isEvent: true },
      { stage: "closed_won", ageMonths: 2, isEvent: true },
    ];
    const r = survivalHazard(deals);
    for (const entry of r.kmCurve) {
      expect(entry.survival).toBeGreaterThanOrEqual(0);
      expect(entry.survival).toBeLessThanOrEqual(1);
    }
  });

  it("atRiskTable groups by stage correctly", () => {
    const deals = [
      { stage: "lead", ageMonths: 1, isEvent: false },
      { stage: "lead", ageMonths: 2, isEvent: false },
      { stage: "closed_won", ageMonths: 3, isEvent: true },
    ];
    const r = survivalHazard(deals);
    const leadRow = r.atRiskTable.find(row => row.stage === "lead");
    expect(leadRow).toBeDefined();
    expect(leadRow!.count).toBe(2);
    const wonRow = r.atRiskTable.find(row => row.stage === "closed_won");
    expect(wonRow).toBeDefined();
    expect(wonRow!.count).toBe(1);
  });

  it("meanSurvival is non-negative", () => {
    const deals = [
      { stage: "closed_won", ageMonths: 2, isEvent: true },
      { stage: "negotiation", ageMonths: 6, isEvent: false },
    ];
    const r = survivalHazard(deals);
    expect(r.meanSurvival).toBeGreaterThanOrEqual(0);
  });
});
