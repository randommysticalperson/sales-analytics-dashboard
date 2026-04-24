import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createActivity,
  createContact,
  createDeal,
  deleteContact,
  deleteDeal,
  getAccounts,
  getActivities,
  getContactById,
  getContacts,
  getDealById,
  getDeals,
  getDealsByStage,
  getKpiSummary,
  getPipelineDeals,
  getRecentActivities,
  getRevenueTrend,
  getTeamLeaderboard,
  getAllReps,
  updateContact,
  updateDeal,
  getClosedWonDealValues,
  getAllDealValues,
  getRepRevenueForEntropy,
  getMonthlyRevenueSeries,
  getStageProbabilities,
  updateStageProbability,
} from "./db";
import {
  boltzmannGibbs,
  giniAndLorenz,
  revenueEntropy,
  estimateGBMParams,
  monteCarloForecast,
  binomialPipelineValue,
  economicTemperatureTrend,
} from "./econophysics";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── CRM: Sales Reps ──────────────────────────────────────────────────────
  reps: router({
    list: protectedProcedure.query(() => getAllReps()),
  }),

  // ─── CRM: Accounts ────────────────────────────────────────────────────────
  accounts: router({
    list: protectedProcedure.query(() => getAccounts()),
  }),

  // ─── CRM: KPI Summary ─────────────────────────────────────────────────────
  kpi: router({
    summary: protectedProcedure
      .input(
        z.object({
          repId: z.number().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        })
      )
      .query(({ input, ctx }) => {
        const effectiveRepId = ctx.user?.role === "user"
          ? undefined // will be filtered by user's linked rep in future
          : input.repId;
        return getKpiSummary(
          effectiveRepId,
          input.startDate ? new Date(input.startDate) : undefined,
          input.endDate ? new Date(input.endDate) : undefined
        );
      }),
  }),

  // ─── CRM: Revenue Trend ───────────────────────────────────────────────────
  revenue: router({
    trend: protectedProcedure
      .input(
        z.object({
          granularity: z.enum(["daily", "weekly", "monthly"]).default("monthly"),
          startDate: z.string(),
          endDate: z.string(),
          repId: z.number().optional(),
        })
      )
      .query(({ input }) =>
        getRevenueTrend(
          input.granularity,
          new Date(input.startDate),
          new Date(input.endDate),
          input.repId
        )
      ),
  }),

  // ─── CRM: Pipeline ────────────────────────────────────────────────────────
  pipeline: router({
    deals: protectedProcedure
      .input(z.object({ repId: z.number().optional() }))
      .query(({ input }) => getPipelineDeals(input.repId)),
  }),

  // ─── CRM: Deals ───────────────────────────────────────────────────────────
  deals: router({
    list: protectedProcedure
      .input(
        z.object({
          repId: z.number().optional(),
          stage: z.string().optional(),
          search: z.string().optional(),
          limit: z.number().default(50),
          offset: z.number().default(0),
        })
      )
      .query(({ input }) => getDeals(input)),

    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getDealById(input.id)),

    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1),
          contactId: z.number().optional(),
          accountId: z.number().optional(),
          assignedRepId: z.number().optional(),
          value: z.number().min(0),
          stage: z.string().default("lead"),
          probability: z.number().min(0).max(100).optional(),
          expectedCloseDate: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(({ input }) => createDeal(input)),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().optional(),
          contactId: z.number().optional(),
          accountId: z.number().optional(),
          assignedRepId: z.number().optional(),
          value: z.number().optional(),
          stage: z.string().optional(),
          probability: z.number().optional(),
          expectedCloseDate: z.string().optional(),
          actualCloseDate: z.string().optional(),
          lostReason: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateDeal(id, data);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteDeal(input.id)),
  }),

  // ─── CRM: Contacts ────────────────────────────────────────────────────────
  contacts: router({
    list: protectedProcedure
      .input(
        z.object({
          repId: z.number().optional(),
          status: z.string().optional(),
          search: z.string().optional(),
          limit: z.number().default(50),
          offset: z.number().default(0),
        })
      )
      .query(({ input }) => getContacts(input)),

    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getContactById(input.id)),

    create: protectedProcedure
      .input(
        z.object({
          firstName: z.string().min(1),
          lastName: z.string().min(1),
          email: z.string().email().optional().or(z.literal("")),
          phone: z.string().optional(),
          title: z.string().optional(),
          accountId: z.number().optional(),
          assignedRepId: z.number().optional(),
          status: z.string().optional(),
          source: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(({ input }) => createContact(input)),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          email: z.string().optional(),
          phone: z.string().optional(),
          title: z.string().optional(),
          accountId: z.number().optional(),
          assignedRepId: z.number().optional(),
          status: z.string().optional(),
          source: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateContact(id, data);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteContact(input.id)),
  }),

  // ─── CRM: Activities ──────────────────────────────────────────────────────
  activities: router({
    list: protectedProcedure
      .input(
        z.object({
          dealId: z.number().optional(),
          contactId: z.number().optional(),
          limit: z.number().default(50),
        })
      )
      .query(({ input }) => getActivities(input)),

    recent: protectedProcedure
      .input(z.object({ limit: z.number().default(20) }))
      .query(({ input }) => getRecentActivities(input.limit)),

    create: protectedProcedure
      .input(
        z.object({
          type: z.enum(["note", "call", "email", "meeting", "task"]),
          title: z.string().min(1),
          description: z.string().optional(),
          dealId: z.number().optional(),
          contactId: z.number().optional(),
          repId: z.number().optional(),
        })
      )
      .mutation(({ input }) => createActivity(input)),
  }),

  // ─── CRM: Team Leaderboard ────────────────────────────────────────────────
  team: router({
    leaderboard: protectedProcedure
      .input(
        z.object({
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        })
      )
      .query(({ input }) =>
        getTeamLeaderboard(
          input.startDate ? new Date(input.startDate) : undefined,
          input.endDate ? new Date(input.endDate) : undefined
        )
      ),
  }),

  // ─── CRM: Reports ─────────────────────────────────────────────────────────
  reports: router({
    dealsByStage: protectedProcedure
      .input(z.object({ repId: z.number().optional() }))
      .query(({ input }) => getDealsByStage(input.repId)),
  }),
  // ─── Stage Probabilities ─────────────────────────────────────────────────
  stageProbabilities: router({
    get: protectedProcedure.query(() => getStageProbabilities()),
    update: adminProcedure
      .input(z.object({
        stage: z.enum(["lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"]),
        probability: z.number().min(0).max(1),
      }))
      .mutation(({ input, ctx }) =>
        updateStageProbability(input.stage, input.probability, ctx.user.id)
      ),
  }),
  // ─── Econophysics Analytics ───────────────────────────────────────────────
  econophysics: router({
    full: protectedProcedure.query(async () => {
      const [closedWonValues, allDeals, repRevenues, monthlySeries] = await Promise.all([
        getClosedWonDealValues(),
        getAllDealValues(),
        getRepRevenueForEntropy(),
        getMonthlyRevenueSeries(),
      ]);

      const bg = boltzmannGibbs(closedWonValues);
      const repRevenueValues = repRevenues.map(r => r.revenue);
      const giniData = giniAndLorenz(repRevenueValues);
      const entropyData = revenueEntropy(repRevenueValues);
      const monthlyValues = monthlySeries.map(m => m.totalValue);
      const gbmParams = estimateGBMParams(monthlyValues);
      const lastRevenue = monthlyValues[monthlyValues.length - 1] ?? 100000;
      const forecast = monteCarloForecast(lastRevenue, gbmParams.muMonthly, gbmParams.sigmaMonthly, 6, 200);
      const stageProbMap = await getStageProbabilities();
      const pipelineValue = binomialPipelineValue(allDeals, stageProbMap);
      const tempTrend = economicTemperatureTrend(monthlySeries);

      return {
        boltzmannGibbs: bg,
        gini: giniData,
        entropy: entropyData,
        gbmParams,
        forecast: {
          median: forecast.median,
          p10: forecast.p10,
          p90: forecast.p90,
          p25: forecast.p25,
          p75: forecast.p75,
          expectedFinal: forecast.expectedFinal,
          paths: forecast.paths,
        },
        pipelineValue,
        temperatureTrend: tempTrend,
        repRevenues,
        monthlySeries,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
