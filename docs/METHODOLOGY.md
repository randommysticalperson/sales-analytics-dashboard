# Econophysics Analytics — Methodology

This document explains, in plain English, the statistical physics and mathematical finance models used in the **Econophysics Analytics** section of the Sales CRM Dashboard. For each model, it describes what the model does, what assumptions it makes, and where those assumptions may break down in a real sales context.

---

## 1. Boltzmann-Gibbs Distribution of Deal Values

### What it does

This model treats the portfolio of deals as a closed thermodynamic system where "money" (deal value) is conserved and randomly exchanged between agents. In equilibrium, the probability of observing a deal of value *m* follows an exponential decay:

> P(m) = (1/T) · exp(−m/T)

where **T** is the *economic temperature* — simply the average deal value. The model fits this curve to the observed histogram of deal values and draws the theoretical exponential on top, so you can see how closely your deal distribution matches the Boltzmann-Gibbs prediction.

### Assumptions

- **Money conservation.** The total deal value in the system is fixed — no new money enters or leaves. In practice, this means the model is most accurate when applied to a stable, mature pipeline over a fixed period, not a rapidly growing one.
- **Random, pairwise exchange.** Deals are treated as if their values were determined by random interactions between agents, like gas molecules colliding. This ignores deliberate pricing strategy, customer segmentation, and sales rep skill.
- **Equilibrium.** The system is assumed to have reached a statistical steady state. A pipeline that is actively being built up or wound down is not in equilibrium and will deviate from the exponential.
- **Exponential body, power-law tail.** The model expects the bulk of deals to follow the exponential, with a small fraction of very large deals (above the 90th percentile threshold) deviating into a Pareto power-law tail. If your deal sizes are highly uniform or bimodally distributed, the fit will be poor.

### Limitations

- With fewer than roughly 30 deals, the histogram bins are too sparse to meaningfully test the exponential fit. The curve will be drawn regardless, but should be treated as illustrative rather than statistically rigorous.
- The model says nothing about *why* deals have the values they do — it is purely descriptive.
- The Pareto threshold is set mechanically at the 90th percentile. In a real portfolio, the crossover point between the exponential body and the power-law tail should ideally be estimated by fitting both distributions and comparing log-likelihoods.

---

## 2. Economic Temperature (T = M/N)

### What it does

Economic temperature is defined as the total deal value in a period divided by the number of deals in that period — in other words, the **average deal size**. Tracking it over time shows whether deals are getting larger or smaller on average, independent of deal volume.

> T(t) = total deal value in period t / number of deals in period t

A rising temperature means the pipeline is shifting toward higher-value deals. A falling temperature may indicate a move toward higher-volume, lower-value business, or a deterioration in deal quality.

### Assumptions

- **Uniform deal mix.** The metric treats all deals as equivalent agents in a gas. It does not distinguish between product lines, customer segments, or deal types. A single very large deal can dramatically inflate the temperature for a period.
- **Consistent period length.** Comparing temperatures across periods only makes sense if each period covers the same time span (e.g., all monthly, all quarterly).

### Limitations

- Temperature is sensitive to outliers. One unusually large or small deal in a low-volume month can make the trend misleading. Consider pairing it with deal count to contextualise the signal.
- It does not capture the *distribution* of deal sizes within a period — two periods can have the same temperature but very different spread.

---

## 3. Gini Coefficient and Lorenz Curve

### What it does

The **Gini coefficient** measures how unequally revenue is distributed across sales reps. A value of 0 means every rep generates exactly the same revenue (perfect equality). A value of 1 means one rep generates all revenue (perfect inequality). The **Lorenz curve** is the visual representation: it plots the cumulative share of revenue (y-axis) against the cumulative share of reps ranked from lowest to highest earner (x-axis). The further the curve bows below the diagonal, the more unequal the distribution.

In a pure Boltzmann-Gibbs (exponential) revenue distribution, the theoretical Gini is exactly 0.5. Values significantly above 0.5 suggest that a small number of reps are generating a disproportionate share of revenue — a Pareto dynamic.

### Assumptions

- **Reps are comparable agents.** The model assumes all reps operate under similar conditions (same territory, product mix, tenure). Structural differences — such as one rep covering enterprise accounts and another covering SMB — will inflate the Gini without reflecting genuine performance inequality.
- **Revenue is the right metric.** The Gini is computed on closed revenue. It ignores pipeline value, activity levels, or deal count, which may be more appropriate measures of effort or potential.

### Limitations

- With a small number of reps (fewer than 5–6), the Gini is highly sensitive to individual performance and may fluctuate dramatically between periods. It is most meaningful for teams of 10 or more.
- The Gini is a single summary number and can be identical for distributions with very different shapes. Always read it alongside the Lorenz curve.
- The model does not account for part-time reps, reps who joined mid-period, or reps on leave.

---

## 4. Shannon / Boltzmann Entropy

### What it does

Entropy measures how evenly revenue is spread across reps. It is computed as:

> S = −Σ pᵢ · ln(pᵢ)

where pᵢ is rep *i*'s share of total revenue. The result is normalised by the maximum possible entropy (which occurs when all reps earn equally), giving a value between 0 and 1. A score near 1 means revenue is broadly distributed; a score near 0 means it is concentrated in very few reps.

Entropy and the Gini coefficient are complementary: Gini measures inequality in terms of the area under the Lorenz curve, while entropy measures it in terms of information content. They often agree, but can diverge for unusual distributions.

### Assumptions

- **All reps are active.** Reps with zero revenue are excluded from the entropy calculation (since 0 · ln(0) is defined as 0 by convention). If many reps have zero revenue, the effective team size is smaller than the headcount.
- **Revenue shares sum to 1.** The calculation requires that all revenue is attributed to a rep. Deals without an assigned rep are excluded and will cause the entropy to be slightly overstated.

### Limitations

- Entropy is not directional — it cannot tell you whether concentration is increasing or decreasing over time without tracking it as a time series.
- Like the Gini, entropy is a summary statistic. It does not identify *which* reps are driving concentration.
- Normalised entropy depends on the number of reps: adding a new rep with zero revenue does not change the entropy, but adding a new rep with significant revenue will.

---

## 5. Pareto Tail Analysis

### What it does

The Pareto principle — informally, the "80/20 rule" — states that a small fraction of inputs (deals, reps, accounts) tends to produce a disproportionately large fraction of outputs (revenue). This model identifies the top 10% of deals by value (the 90th percentile threshold) and reports what fraction of total revenue they represent.

In the Boltzmann-Gibbs framework, the exponential distribution governs the bulk of deals, but deals above a certain threshold deviate from the exponential and follow a power law. The Pareto tail share quantifies how much of your revenue comes from this "heavy tail."

### Assumptions

- **The 90th percentile is a reasonable threshold.** The cutoff is set mechanically. In a rigorous analysis, the crossover point between the exponential body and the power-law tail should be estimated statistically (e.g., using the Clauset-Shalizi-Newman method).
- **The tail is stable.** The model reports a snapshot. Whether the tail is growing or shrinking over time requires tracking the metric across periods.

### Limitations

- With fewer than 20–30 deals, the 90th percentile threshold is based on very few data points and is not statistically reliable.
- The model does not fit a power-law exponent (α). Reporting the tail share is a descriptive first step; a full Pareto analysis would estimate α and test whether a power law is a better fit than the exponential in the tail.
- A high Pareto tail share is not inherently good or bad — it depends on whether large deals are repeatable and whether the business model depends on them.

---

## 6. Geometric Brownian Motion (GBM) — Drift and Volatility

### What it does

Geometric Brownian Motion is the standard model for asset prices in mathematical finance, and here it is applied to monthly revenue. The model assumes that revenue evolves as:

> Sₜ = S₀ · exp((μ − σ²/2)·t + σ·Wₜ)

where **μ** is the annualised drift (expected growth rate), **σ** is the annualised volatility (unpredictability of growth), and Wₜ is a Wiener process (random noise). The drift and volatility are estimated from the log-returns of historical monthly revenue:

> log-return for month t = ln(revenue_t / revenue_{t-1})

Drift is the annualised mean of these log-returns; volatility is the annualised standard deviation.

### Assumptions

- **Log-normal revenue.** GBM assumes that revenue is always positive and that its log-returns are normally distributed. In practice, revenue can have fat tails (unusually good or bad months) that the normal distribution underestimates.
- **Constant drift and volatility.** The model assumes μ and σ are stable over time. In reality, both change with market conditions, team size, product launches, and seasonality.
- **Independent increments.** Each month's log-return is assumed to be independent of the previous month's. Revenue often has autocorrelation (a good quarter tends to follow a good quarter), which GBM ignores.
- **Continuous compounding.** The model uses continuous-time mathematics. The discrete monthly approximation introduces small errors that are negligible for planning purposes.

### Limitations

- **Sparse data.** With fewer than 6 months of revenue history, the drift and volatility estimates are unreliable. The dashboard caps them at 300%/yr and 200%/yr respectively when fewer than 6 data points are available, and flags this to the user. These caps are conservative defaults, not calibrated estimates.
- **GBM cannot model structural breaks.** A product pivot, a major new hire, or a market downturn will cause the historical parameters to be misleading for forward projections.
- **Negative revenue is impossible in GBM.** This is realistic for revenue, but means the model cannot capture scenarios where revenue drops to zero (e.g., company shutdown, complete churn).

---

## 7. Monte Carlo Revenue Forecast

### What it does

Using the GBM parameters estimated above, the model simulates 200 independent revenue trajectories over a 6-month horizon. Each path represents one possible future, generated by drawing random shocks from a normal distribution at each monthly step. The dashboard displays:

- **20 sampled paths** (a representative subset for visual clarity)
- **Median path** — the 50th percentile outcome
- **10th and 90th percentile bands** — the pessimistic and optimistic range
- **25th and 75th percentile bands** — the central range
- **Expected final value** — E[S_T] = S₀ · exp(μ · T), the analytical mean

### Assumptions

All assumptions from the GBM model above apply. Additionally:

- **200 paths is sufficient.** For a 6-month, single-variable simulation, 200 paths gives stable percentile estimates. For longer horizons or multi-variable models, more paths would be needed.
- **The random number generator is seeded.** The simulation uses a fixed seed (42) for reproducibility — the same data will always produce the same fan chart. This is intentional for consistency, not a limitation.

### Limitations

- The forecast inherits all limitations of the GBM parameter estimates. If the drift and volatility are poorly estimated (due to sparse or non-stationary data), the forecast bands will be misleading.
- The fan chart widens rapidly with time because GBM volatility compounds. For horizons beyond 6–12 months, the bands become so wide as to be uninformative.
- The model does not incorporate external information (pipeline size, headcount changes, market forecasts). It is a purely statistical extrapolation of past revenue behaviour.
- **This is not a financial forecast.** It is a statistical scenario tool. It should be used to understand the range of plausible outcomes given historical volatility, not as a basis for financial commitments.

---

## 8. Binomial Pipeline Expected Value

### What it does

Each deal in the pipeline is modelled as a binary outcome: it either closes (win) or does not (loss). The probability of winning depends on the deal's current stage:

| Stage | Win Probability |
|-------|----------------|
| Lead | 10% |
| Qualified | 25% |
| Proposal | 45% |
| Negotiation | 70% |
| Closed Won | 100% |
| Closed Lost | 0% |

The expected value of the pipeline is the sum of each deal's value multiplied by its stage probability:

> E[Revenue] = Σ deal_value_i × P(win | stage_i)

This is the standard binomial (risk-neutral) valuation approach from mathematical finance, applied to a sales pipeline.

### Assumptions

- **Stage probabilities are fixed and universal.** The probabilities above are reasonable industry benchmarks, but they do not reflect your specific product, market, sales cycle length, or rep performance. A deal in "Negotiation" with a strategic enterprise customer may have a very different win probability than one with a small SMB prospect.
- **Deals are independent.** The model assumes the outcome of one deal does not affect another. In practice, deals can be correlated — losing one deal to a competitor may signal broader market headwinds.
- **Deal value is certain.** The model uses the stated deal value as if it were fixed. In reality, deal values often change during negotiation.
- **Stage is an accurate signal.** The model assumes that the assigned stage reflects the true state of the deal. Inaccurate CRM hygiene (deals left in the wrong stage) will distort the expected value.

### Limitations

- The stage probabilities should be calibrated to your own historical win rates by stage. The defaults are starting points, not empirically validated numbers. If your team has historical data on conversion rates by stage, those should replace the defaults in `server/econophysics.ts` under `STAGE_WIN_PROBABILITIES`.
- The model does not account for deal age (a deal that has been in "Proposal" for 6 months is less likely to close than one that entered the stage last week).
- Expected value is a mean, not a guarantee. The actual outcome will be either higher or lower — the binomial model does not provide confidence intervals around the pipeline estimate.

---

## General Caveats

All models in this section are **descriptive and exploratory**. They are intended to surface patterns and prompt questions, not to replace human judgment or serve as the sole basis for business decisions. The quality of every output depends directly on the quality and completeness of the underlying CRM data. Incomplete deal records, missing rep assignments, or inconsistent stage updates will degrade all metrics simultaneously.

The econophysics framework is most powerful when applied to a **large, stable dataset** — ideally several years of closed deals with consistent data entry. With the seed data currently in the dashboard (a few months of synthetic records), the models are illustrative. As real data accumulates, the estimates will become progressively more reliable.

---

## 9. Poisson Deal-Arrival Model

*Source: Finan, "A Probability Course for the Actuaries" (PV2020), §7.4 — Poisson Random Variable*

### What it does

The Poisson distribution models the number of events that occur in a fixed time interval when each event is rare and independent of all others. Applied to sales, it models the number of **new deals entering the pipeline per month**. Given a historical average arrival rate λ (deals per month), the model computes the probability of observing exactly k new deals in the next month:

> P(X = k) = e^(−λ) · λ^k / k!

The dashboard plots the full probability mass function as a bar chart, highlights the most likely outcome (the mode), and computes a 90 % confidence interval for next-month deal volume. It also shows the **Poisson mean** (λ) and **variance** (also λ — a distinctive property of the Poisson distribution).

### Assumptions

- **Stationarity.** The arrival rate λ is assumed constant over time. If the business is growing rapidly or has strong seasonality, a single λ will underestimate variance.
- **Independence.** Each deal arrives independently of all others. In practice, a marketing campaign or trade show can cause a burst of correlated arrivals that violates this assumption.
- **Rare events.** The Poisson approximation to the binomial is most accurate when the probability of any single prospect converting in a given month is small and the prospect pool is large (n ≥ 20, p ≤ 0.05 per Finan §7.5).

### Limitations

- The model estimates λ from the observed monthly average. With fewer than 6 months of data, this estimate is unreliable.
- It does not distinguish between deal types, rep territories, or lead sources — all arrivals are treated as equivalent.
- The Poisson model is symmetric in the sense that mean equals variance. If your observed variance is substantially higher than the mean (overdispersion), a Negative Binomial model is more appropriate.

---

## 10. Geometric / Negative-Binomial Sales Cycle Model

*Source: Finan, "A Probability Course for the Actuaries" (PV2020), §7.6 — Geometric Random Variable; §7.7 — Negative Binomial Random Variable*

### What it does

The **Geometric distribution** models the number of monthly follow-up attempts (trials) needed before a deal closes for the first time, given a constant per-period close probability *p*:

> P(X = n) = p · (1 − p)^(n−1),  E(X) = 1/p,  Var(X) = (1−p)/p²

The **Negative Binomial** generalises this to the number of attempts needed to achieve *r* closures (e.g., to close the 3rd deal of the quarter):

> P(Y = n) = C(n−1, r−1) · p^r · (1−p)^(n−r),  E(Y) = r/p

The dashboard uses the Geometric model to estimate the **expected sales cycle length** (in months) from the observed historical close rate, and plots the probability mass function so managers can see the distribution of cycle lengths. The Negative Binomial extension shows the distribution of time to reach a quota target of *r* closed deals.

### Assumptions

- **Constant close probability.** Each period is an independent Bernoulli trial with the same probability *p* of closing. In reality, close probability typically increases as a deal ages and progresses through stages.
- **Memoryless property.** The Geometric distribution is memoryless: P(X > m + n | X > m) = P(X > n). A deal that has been open for 3 months is no more or less likely to close next month than a brand-new deal with the same stage probability. This is a strong simplification.
- **Single close per deal.** The Geometric model counts the first success. It does not model renewals or upsells.

### Limitations

- The memoryless assumption is violated in most real sales cycles, where older deals in a given stage are less likely to close than newer ones. A survival analysis approach (using the Exponential or Weibull hazard function) would be more accurate for aged pipelines.
- The model requires a reliable estimate of *p* (the per-period close rate). With fewer than 30 closed deals, the estimate is noisy.
- The Negative Binomial quota model assumes all deals are equivalent. In practice, quota attainment depends on deal mix and rep assignment.

---

## 11. Bayesian Win-Rate Updater

*Source: Finan, "A Probability Course for the Actuaries" (PV2020), §5.2 — Bayes' Formula and the Law of Total Probability*

### What it does

Bayes' theorem provides a principled way to update a prior belief about win rate in the light of new evidence. The dashboard implements a **Beta-Binomial Bayesian model**:

1. **Prior:** Start with a Beta(α₀, β₀) prior distribution over the win rate *p*. The default is α₀ = β₀ = 1 (uniform — no prior knowledge), but the user can set an informative prior.
2. **Likelihood:** Given *W* wins and *L* losses observed in the current period, the likelihood is Binomial(W + L, p).
3. **Posterior:** By conjugacy, the posterior is Beta(α₀ + W, β₀ + L), with posterior mean:

> E(p | data) = (α₀ + W) / (α₀ + β₀ + W + L)

The dashboard plots the prior and posterior Beta distributions side by side, shows the posterior mean win rate, and computes a 90 % credible interval (the range containing 90 % of the posterior probability mass). As more deals close, the posterior narrows and converges on the true win rate.

Extended Bayes' formula (Law of Total Probability) is used to decompose the overall win rate into stage-conditional win rates, weighting each stage by its share of the pipeline:

> P(Win) = Σᵢ P(Win | Stage i) · P(Stage i)

### Assumptions

- **Exchangeability.** All deals are treated as independent draws from the same Bernoulli process. Deals from different reps, products, or customer segments are pooled.
- **Stationarity.** The true win rate *p* is assumed constant over the observation window. A business undergoing rapid change (new product, new market) will have a non-stationary *p*.
- **Beta prior is appropriate.** The Beta distribution is the conjugate prior for the Binomial likelihood, making the posterior analytically tractable. It is a flexible family that can represent a wide range of prior beliefs.

### Limitations

- Pooling all deals into a single Bayesian update ignores heterogeneity across reps, products, and segments. A hierarchical Bayesian model would be more appropriate for large teams.
- The credible interval is only as meaningful as the prior. With a strongly informative prior and few data points, the interval will be dominated by the prior rather than the data.
- The model updates on closed deals only. Open deals in the pipeline carry information about future win rates that is not captured here.

---

## General Caveats (updated)

The three actuarial models above (Poisson, Geometric/Negative Binomial, Bayesian) are grounded in the rigorous probability theory developed in Marcel B. Finan's *"A Probability Course for the Actuaries"* (PV2020, Arkansas Tech University). They complement the econophysics models from Cockshott et al. and Wallace/Durham by providing a frequentist and Bayesian statistical lens alongside the statistical-mechanics perspective.

Together, the eleven models form a multi-paradigm analytics framework: statistical mechanics (Boltzmann-Gibbs, temperature, Gini, entropy, Pareto), stochastic finance (GBM, Monte Carlo), decision-theoretic probability (Binomial pipeline EV), and actuarial probability (Poisson arrival, Geometric cycle, Bayesian win-rate). Each paradigm makes different assumptions and surfaces different aspects of pipeline risk.
