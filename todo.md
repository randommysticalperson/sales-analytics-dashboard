# Sales CRM Dashboard — TODO

## Schema & Backend
- [x] Define Drizzle schema: contacts, accounts, deals, activities, team_members tables
- [x] Generate and apply DB migration SQL
- [x] Seed realistic demo data (contacts, deals, activities, reps)
- [x] tRPC router: KPI summary (revenue, deals closed, win rate, avg deal size)
- [x] tRPC router: revenue trend data (daily/weekly/monthly with date range)
- [x] tRPC router: pipeline board (deals grouped by stage)
- [x] tRPC router: contacts CRUD (list, create, update, delete, search/filter)
- [x] tRPC router: deals CRUD (list, create, update, delete, filter by stage/rep)
- [x] tRPC router: team leaderboard (deals closed + revenue per rep)
- [x] tRPC router: activity feed (per deal, per contact, global)
- [x] tRPC router: reports (revenue by stage, conversion funnel)
- [x] Role-based access: admin delete-only guard via adminProcedure

## Layout & Navigation
- [x] Global elegant theme with CSS variables (indigo/slate palette, Inter font)
- [x] CRMLayout with collapsible sidebar: Overview, Pipeline, Contacts, Deals, Team, Reports
- [x] Sidebar active state, icons, and collapse support
- [x] User avatar with role badge (ADMIN indicator) in sidebar footer
- [x] Responsive layout

## Overview Page
- [x] KPI summary cards: Total Revenue, Deals Closed, Win Rate, Avg Deal Size
- [x] Revenue trend area chart with date range filter (30d/90d/6mo/1yr)
- [x] Pipeline by stage bar chart
- [x] Recent activity feed widget

## Pipeline Page
- [x] Kanban-style pipeline board with columns: Lead, Qualified, Proposal, Negotiation, Closed Won, Closed Lost
- [x] Deal cards with contact name, value, close date, and probability bar
- [x] Click-to-move stage update buttons
- [x] Pipeline summary stats per stage (count + total value)

## Contacts Page
- [x] Contacts table with search and status filter
- [x] Create / Edit / Delete contact modal (delete hidden for non-admins)
- [x] Contact detail with linked account, rep, email, phone

## Deals Page
- [x] Deals table with stage badge, value, contact, rep, and close date
- [x] Create / Edit / Delete deal modal (delete hidden for non-admins)
- [x] Deal detail side panel with activity notes log
- [x] Add activity/note to deal inline

## Team Page
- [x] Top-3 podium cards with gold/silver/bronze styling
- [x] Full leaderboard table: rep name, revenue, deals closed, win rate, avg deal, revenue share bar

## Reports Page
- [x] Revenue over time area chart with date range picker
- [x] Pipeline distribution donut chart with stage breakdown
- [x] Rep revenue comparison bar chart
- [x] Summary stats cards (revenue, deals closed, total pipeline)

## Polish & RBAC
- [x] Role-based access: adminProcedure blocks non-admins from delete operations
- [x] Admin badge displayed in sidebar for admin users
- [x] Delete buttons hidden in UI for non-admin users
- [x] Vitest tests: 7 tests passing (auth, RBAC, admin/user role enforcement)
- [x] Final checkpoint and delivery

## Econophysics Analytics
- [x] Backend: Boltzmann-Gibbs distribution fit to deal values (λ = 1/T, T = mean deal value)
- [x] Backend: Gini coefficient and Lorenz curve data for revenue concentration across reps
- [x] Backend: Pareto tail analysis (power-law tail in top deals; 80/20 breakdown)
- [x] Backend: Revenue entropy (Shannon entropy of revenue distribution across reps)
- [x] Backend: GBM parameters (drift μ, volatility σ) estimated from historical monthly revenue
- [x] Backend: Monte Carlo revenue forecast (N=200 paths, 6-month horizon using GBM)
- [x] Backend: Binomial pipeline expected value (each deal × stage probability)
- [x] Backend: Economic temperature trend (T = mean deal value per period)
- [x] Frontend: Econophysics page with sidebar nav entry
- [x] Frontend: Boltzmann-Gibbs histogram chart with exponential fit overlay and Pareto threshold
- [x] Frontend: Lorenz curve chart with Gini coefficient annotation
- [x] Frontend: GBM Monte Carlo fan chart (200 paths + 10th/25th/75th/90th percentile bands)
- [x] Frontend: Economic temperature trend chart + monthly revenue history
- [x] Frontend: Binomial pipeline expected value breakdown
- [x] Frontend: 8 KPI cards (Economic Temp, Gini, Entropy, Pareto Tail, GBM Drift, GBM Volatility, Pipeline EV, GBM Forecast)
- [x] Frontend: Model reference table with formulas and source citations
- [x] Fix: GBM estimation caps for sparse seed data (< 6 months)
- [x] Fix: Monthly revenue query using raw SQL to avoid Drizzle DATE_FORMAT issue

## Follow-up Features (Econophysics Page)
- [x] DB table `stage_probabilities` to persist admin-overridden stage win rates
- [x] tRPC procedures: getStageProbabilities, updateStageProbability (admin only)
- [x] Admin stage probability editor UI (inline editable table, admin-only)
- [x] Data quality warning banner (< 30 deals or < 6 months history)
- [x] Methodology modal with rendered METHODOLOGY.md sections
- [x] PDF links in methodology modal (Classical Econophysics + Mathematical Finance)
- [x] "Read the methodology" button in Econophysics page header

## What-If Analysis Tool

- [x] Client-side computation engine: port all 8 model formulas to TypeScript (no server round-trips)
- [x] WhatIfPanel component: collapsible sidebar/drawer with parameter sliders and inputs
- [x] GBM parameters: drift μ slider (−100% to +500%/yr), volatility σ slider (0–300%/yr)
- [x] Monte Carlo: forecast horizon slider (1–24 months), number of paths selector (50/100/200/500)
- [x] Stage probabilities: inline sliders for Lead, Qualified, Proposal, Negotiation (0–100%)
- [x] Deal assumptions: average deal value input, total deal count input
- [x] Pareto threshold: percentile slider (80th–99th) for Pareto tail cutoff
- [x] Economic temperature: override T directly or derive from deal value/count inputs
- [x] Live KPI cards: all 8 KPI values update instantly as parameters change
- [x] Live charts: GBM Monte Carlo fan chart, Binomial pipeline bar, Boltzmann histogram all re-render on parameter change
- [x] Baseline vs. what-if comparison: show delta badges (▲/▼) on each KPI card vs. the server-computed baseline
- [x] Reset to baseline button: restores all parameters to server-computed values
- [x] Scenario presets: "Optimistic", "Pessimistic", "Conservative" preset buttons
- [x] What-If mode indicator: clear visual signal when the page is showing what-if vs. live data
- [x] Vitest tests for the client-side computation engine

## Actuarial Probability Models (Finan PV2020)

- [x] Commit finan_probability_actuaries_pv2020.pdf to docs/
- [x] Add Poisson Deal-Arrival model (engine + chart + KPI card)
- [x] Add Geometric/Negative-Binomial Sales Cycle model (engine + chart + KPI card)
- [x] Add Bayesian Win-Rate Updater model (engine + chart + KPI card)
- [x] Extend WhatIfPanel with sliders for three new actuarial models
- [x] Add three new models to methodology modal PDF links section
- [x] Write Vitest tests for three new actuarial model functions

## Follow-up Actuarial Features (Round 2)

- [ ] Per-rep Poisson λ breakdown: DB helper getRepDealCounts, tRPC procedure, engine function, UI table below Poisson PMF chart
- [ ] Survival/hazard function for deal age-in-stage: DB helper getDealAgeInStage, engine survivalHazard function, KM-style chart + at-risk table
- [ ] Bayesian prior calibration wizard: modal with belief win-rate + confidence inputs, Beta parameter conversion, live posterior preview, "Apply" button updates WhatIfPanel sliders
