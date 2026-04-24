/**
 * Vitest tests for the client-side econophysics computation engine.
 * Covers all 8 exported model functions and key edge cases.
 */
import { describe, expect, it } from "vitest";
import {
  boltzmannGibbs,
  giniAndLorenz,
  revenueEntropy,
  estimateGBMParams,
  monteCarloForecast,
  binomialPipelineValue,
  economicTemperatureTrend,
  DEFAULT_STAGE_PROBS,
} from "./econophysicsEngine";

// ─── Boltzmann-Gibbs ──────────────────────────────────────────────────────────
describe("boltzmannGibbs", () => {
  it("returns zero-state for empty input", () => {
    const r = boltzmannGibbs([]);
    expect(r.temperature).toBe(0);
    expect(r.lambda).toBe(0);
    expect(r.histogram).toHaveLength(0);
  });

  it("computes temperature as mean of values", () => {
    const values = [100, 200, 300];
    const r = boltzmannGibbs(values);
    expect(r.temperature).toBeCloseTo(200, 1);
  });

  it("computes lambda as 1/temperature", () => {
    const values = [100, 200, 300];
    const r = boltzmannGibbs(values);
    expect(r.lambda).toBeCloseTo(1 / 200, 6);
  });

  it("produces 10 histogram bins", () => {
    const values = Array.from({ length: 50 }, (_, i) => (i + 1) * 1000);
    const r = boltzmannGibbs(values);
    expect(r.histogram).toHaveLength(10);
  });

  it("computes Pareto threshold at the given percentile", () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    const r = boltzmannGibbs(values, 0.9);
    // 90th percentile of 1..100 is around 90
    expect(r.paretoThreshold).toBeGreaterThanOrEqual(88);
    expect(r.paretoThreshold).toBeLessThanOrEqual(92);
  });

  it("Pareto revenue share is between 0 and 1", () => {
    const values = [10, 50, 100, 200, 500, 1000, 5000, 10000];
    const r = boltzmannGibbs(values, 0.75);
    expect(r.paretoRevenueShare).toBeGreaterThanOrEqual(0);
    expect(r.paretoRevenueShare).toBeLessThanOrEqual(1);
  });
});

// ─── Gini & Lorenz ───────────────────────────────────────────────────────────
describe("giniAndLorenz", () => {
  it("returns zero Gini for perfectly equal distribution", () => {
    const r = giniAndLorenz([100, 100, 100, 100]);
    expect(r.gini).toBeCloseTo(0, 2);
  });

  it("returns Gini close to 1 for maximally unequal distribution", () => {
    const r = giniAndLorenz([0, 0, 0, 1000]);
    expect(r.gini).toBeGreaterThan(0.7);
  });

  it("Lorenz curve starts at (0,0) and ends at (1,1)", () => {
    const r = giniAndLorenz([100, 200, 300, 400]);
    const first = r.lorenz[0];
    const last = r.lorenz[r.lorenz.length - 1];
    expect(first.population).toBeCloseTo(0, 2);
    expect(first.wealthShare).toBeCloseTo(0, 2);
    expect(last.population).toBeCloseTo(1, 2);
    expect(last.wealthShare).toBeCloseTo(1, 2);
  });

  it("returns zero-state for empty input", () => {
    const r = giniAndLorenz([]);
    expect(r.gini).toBe(0);
    expect(r.lorenz).toHaveLength(0);
  });

  it("Gini for Boltzmann-Gibbs exponential distribution is ~0.5", () => {
    // For a pure exponential distribution, Gini = 0.5
    const n = 1000;
    const T = 100;
    let seed = 42;
    const values = Array.from({ length: n }, () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      const u = Math.max((seed >>> 0) / 0xffffffff, 1e-10);
      return -T * Math.log(u);
    });
    const r = giniAndLorenz(values);
    expect(r.gini).toBeGreaterThan(0.4);
    expect(r.gini).toBeLessThan(0.6);
  });
});

// ─── Revenue Entropy ─────────────────────────────────────────────────────────
describe("revenueEntropy", () => {
  it("returns zero entropy for single-value input", () => {
    const r = revenueEntropy([1000]);
    expect(r.entropy).toBeCloseTo(0, 2);
    expect(r.normalizedEntropy).toBeCloseTo(0, 2);
  });

  it("returns maximum entropy for uniform distribution", () => {
    const r = revenueEntropy([100, 100, 100, 100]);
    expect(r.normalizedEntropy).toBeCloseTo(1, 2);
  });

  it("normalizedEntropy is between 0 and 1", () => {
    const r = revenueEntropy([10, 50, 200, 500, 1000]);
    expect(r.normalizedEntropy).toBeGreaterThanOrEqual(0);
    expect(r.normalizedEntropy).toBeLessThanOrEqual(1);
  });

  it("returns zero-state for empty input", () => {
    const r = revenueEntropy([]);
    expect(r.entropy).toBe(0);
    expect(r.normalizedEntropy).toBe(0);
  });
});

// ─── GBM Parameter Estimation ────────────────────────────────────────────────
describe("estimateGBMParams", () => {
  it("returns zero-state for fewer than 2 data points", () => {
    const r = estimateGBMParams([100]);
    expect(r.mu).toBe(0);
    expect(r.sigma).toBe(0);
  });

  it("returns finite mu and sigma for valid input", () => {
    const series = [100, 110, 105, 120, 130, 125];
    const r = estimateGBMParams(series);
    expect(isFinite(r.mu)).toBe(true);
    expect(isFinite(r.sigma)).toBe(true);
    expect(r.sigma).toBeGreaterThanOrEqual(0);
  });

  it("caps sigma at 3.0 (300%/yr) for sparse/volatile data", () => {
    // Extreme series that would produce very high volatility
    const series = [100, 10000, 1, 50000, 2];
    const r = estimateGBMParams(series);
    expect(r.sigma).toBeLessThanOrEqual(3.0);
  });

  it("caps mu at 5.0 (500%/yr) for extreme growth series", () => {
    const series = [1, 10, 100, 1000, 10000, 100000];
    const r = estimateGBMParams(series);
    expect(r.mu).toBeLessThanOrEqual(5.0);
  });
});

// ─── Monte Carlo Forecast ─────────────────────────────────────────────────────
describe("monteCarloForecast", () => {
  it("returns arrays of length horizonMonths + 1", () => {
    const r = monteCarloForecast(100_000, 0.3, 0.2, 6, 50);
    expect(r.median).toHaveLength(7);
    expect(r.p10).toHaveLength(7);
    expect(r.p90).toHaveLength(7);
  });

  it("median[0] equals s0", () => {
    const s0 = 250_000;
    const r = monteCarloForecast(s0, 0.2, 0.1, 3, 100);
    expect(r.median[0]).toBe(s0);
  });

  it("p10 <= median <= p90 at all time steps", () => {
    const r = monteCarloForecast(100_000, 0.2, 0.15, 6, 200);
    for (let i = 0; i < r.median.length; i++) {
      expect(r.p10[i]).toBeLessThanOrEqual(r.median[i] + 1);
      expect(r.median[i]).toBeLessThanOrEqual(r.p90[i] + 1);
    }
  });

  it("returns paths array of length <= nPaths", () => {
    const r = monteCarloForecast(100_000, 0.2, 0.15, 6, 50);
    expect(r.paths.length).toBeLessThanOrEqual(50);
  });

  it("expectedFinal follows GBM formula: S0 * exp(mu * T)", () => {
    const s0 = 100_000;
    const mu = 0.3;
    const T = 6;
    const r = monteCarloForecast(s0, mu, 0.1, T, 100);
    const expected = Math.round(s0 * Math.exp((mu / 12) * T));
    // Allow 10% tolerance due to monthly mu conversion
    expect(Math.abs(r.expectedFinal - expected) / expected).toBeLessThan(0.1);
  });
});

// ─── Binomial Pipeline EV ─────────────────────────────────────────────────────
describe("binomialPipelineValue", () => {
  const deals = [
    { stage: "lead", value: 10_000 },
    { stage: "qualified", value: 20_000 },
    { stage: "proposal", value: 50_000 },
    { stage: "closed_won", value: 100_000 },
    { stage: "closed_lost", value: 30_000 },
  ];

  it("computes totalFaceValue as sum of all deal values including closed_lost", () => {
    const r = binomialPipelineValue(deals as any, DEFAULT_STAGE_PROBS);
    // totalFaceValue includes all deals (closed_lost contributes face value but 0 EV)
    const expected = 10_000 + 20_000 + 50_000 + 100_000 + 30_000;
    expect(r.totalFaceValue).toBe(expected);
  });

  it("closed_won deals contribute 100% to expected value", () => {
    const wonOnly = [{ stage: "closed_won", value: 100_000 }];
    const r = binomialPipelineValue(wonOnly as any, DEFAULT_STAGE_PROBS);
    expect(r.totalExpected).toBe(100_000);
  });

  it("closed_lost deals contribute 0% to expected value", () => {
    const lostOnly = [{ stage: "closed_lost", value: 100_000 }];
    const r = binomialPipelineValue(lostOnly as any, DEFAULT_STAGE_PROBS);
    expect(r.totalExpected).toBe(0);
  });

  it("returns zero-state for empty deal list", () => {
    const r = binomialPipelineValue([], DEFAULT_STAGE_PROBS);
    expect(r.totalExpected).toBe(0);
    expect(r.totalFaceValue).toBe(0);
  });

  it("weightedConversionRate is between 0 and 1", () => {
    const r = binomialPipelineValue(deals as any, DEFAULT_STAGE_PROBS);
    expect(r.weightedConversionRate).toBeGreaterThanOrEqual(0);
    expect(r.weightedConversionRate).toBeLessThanOrEqual(1);
  });
});

// ─── Economic Temperature Trend ───────────────────────────────────────────────
describe("economicTemperatureTrend", () => {
  const series = [
    { label: "2026-01", totalValue: 300_000, dealCount: 3 },
    { label: "2026-02", totalValue: 400_000, dealCount: 4 },
    { label: "2026-03", totalValue: 200_000, dealCount: 2 },
  ];

  it("computes temperature as totalValue / dealCount per period", () => {
    const r = economicTemperatureTrend(series);
    expect(r[0].temperature).toBeCloseTo(100_000, 0);
    expect(r[1].temperature).toBeCloseTo(100_000, 0);
    expect(r[2].temperature).toBeCloseTo(100_000, 0);
  });

  it("returns empty array for empty input", () => {
    const r = economicTemperatureTrend([]);
    expect(r).toHaveLength(0);
  });

  it("handles zero dealCount gracefully (returns 0 temperature)", () => {
    const r = economicTemperatureTrend([{ label: "2026-01", totalValue: 100_000, dealCount: 0 }]);
    expect(r[0].temperature).toBe(0);
  });
});

// ─── DEFAULT_STAGE_PROBS ──────────────────────────────────────────────────────
describe("DEFAULT_STAGE_PROBS", () => {
  it("has all required stages", () => {
    const required = ["lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"];
    for (const stage of required) {
      expect(DEFAULT_STAGE_PROBS).toHaveProperty(stage);
    }
  });

  it("closed_won = 1.0 and closed_lost = 0.0", () => {
    expect(DEFAULT_STAGE_PROBS.closed_won).toBe(1.0);
    expect(DEFAULT_STAGE_PROBS.closed_lost).toBe(0.0);
  });

  it("all probabilities are between 0 and 1", () => {
    for (const [, prob] of Object.entries(DEFAULT_STAGE_PROBS)) {
      expect(prob).toBeGreaterThanOrEqual(0);
      expect(prob).toBeLessThanOrEqual(1);
    }
  });
});
