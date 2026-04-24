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
