import { describe, expect, it } from "vitest";
import {
  giniAndLorenz,
  revenueEntropy,
  estimateGBMParams,
  boltzmannGibbs,
  binomialPipelineValue,
  monteCarloForecast,
  STAGE_WIN_PROBABILITIES,
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
