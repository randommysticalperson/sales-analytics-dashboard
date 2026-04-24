# Reference Materials

This directory contains the academic source materials used to implement the **Econophysics Analytics** section of the Sales CRM Dashboard.

## Documents

| File | Title | Authors | Relevance |
|------|-------|---------|-----------|
| `classical_econophysics.pdf` | *Classical Econophysics* | Cockshott, Cottrell, Michaelson, Wright, Yakovenko | Boltzmann-Gibbs money distribution (Ch. 8), Gini coefficient & Lorenz curve (Ch. 8, 13), Shannon/Boltzmann entropy (Ch. 1), Pareto-Zipf power-law tail (Ch. 8), economic temperature T = M/N |
| `mathematical_finance_wallace_durham.pdf` | *Mathematical Finance* (lecture notes) | Clare Wallace, Durham University | Geometric Brownian Motion / Black-Scholes (Ch. 6), GBM drift μ and volatility σ estimation, Monte Carlo simulation, binomial model & risk-neutral valuation (Ch. 2–3) |

## Key Formulas Implemented

| Model | Formula | Source |
|-------|---------|--------|
| Boltzmann-Gibbs distribution | P(m) = (1/T) · exp(−m/T) | Classical Econophysics Ch. 8 |
| Economic temperature | T = M/N (mean money per agent) | Classical Econophysics Ch. 8 |
| Gini coefficient | G = 1 − 2∫L(x)dx | Classical Econophysics Ch. 8, 13 |
| Boltzmann entropy | S = −Σ pᵢ · ln(pᵢ) | Classical Econophysics Ch. 1 |
| GBM (revenue process) | Sₜ = S₀ · exp((μ − σ²/2)t + σWₜ) | Mathematical Finance Ch. 6 |
| GBM drift estimate | μ = E[ln(Sₜ/Sₜ₋₁)] · 12 + σ²/2 | Mathematical Finance Ch. 6 |
| GBM volatility estimate | σ = std(log-returns) · √12 | Mathematical Finance Ch. 6 |
| Binomial pipeline EV | E[R] = Σ vᵢ · p(stageᵢ) | Mathematical Finance Ch. 2–3 |
| Pareto tail | P(m) ~ m^(−α) for m > m₀ | Classical Econophysics Ch. 8 |
