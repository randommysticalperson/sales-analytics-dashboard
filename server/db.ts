import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { accounts, activities, contacts, deals, salesReps, users, type InsertUser } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  for (const field of textFields) {
    const value = user[field];
    if (value !== undefined) {
      values[field] = value ?? null;
      updateSet[field] = value ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ─── Sales Reps ──────────────────────────────────────────────────────────────

export async function getAllReps() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(salesReps).orderBy(salesReps.name);
}

// ─── KPI Summary ─────────────────────────────────────────────────────────────

export async function getKpiSummary(repId?: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return { totalRevenue: 0, dealsClosed: 0, winRate: 0, avgDealSize: 0 };

  const conditions = [];
  if (repId) conditions.push(eq(deals.assignedRepId, repId));
  if (startDate) conditions.push(sql`${deals.actualCloseDate} >= ${startDate.toISOString().split("T")[0]}`);
  if (endDate) conditions.push(sql`${deals.actualCloseDate} <= ${endDate.toISOString().split("T")[0]}`);

  const wonConditions = [...conditions, eq(deals.stage, "closed_won")];
  const lostConditions = [...conditions, eq(deals.stage, "closed_lost")];

  const [wonRows] = await db
    .select({ count: sql<number>`count(*)`, revenue: sql<number>`coalesce(sum(value), 0)` })
    .from(deals)
    .where(and(...wonConditions));

  const [lostRows] = await db
    .select({ count: sql<number>`count(*)` })
    .from(deals)
    .where(and(...lostConditions));

  const totalClosed = (wonRows?.count ?? 0) + (lostRows?.count ?? 0);
  const winRate = totalClosed > 0 ? Math.round(((wonRows?.count ?? 0) / totalClosed) * 100) : 0;
  const avgDealSize =
    (wonRows?.count ?? 0) > 0
      ? Math.round(Number(wonRows?.revenue ?? 0) / (wonRows?.count ?? 1))
      : 0;

  return {
    totalRevenue: Number(wonRows?.revenue ?? 0),
    dealsClosed: wonRows?.count ?? 0,
    winRate,
    avgDealSize,
  };
}

// ─── Revenue Trend ───────────────────────────────────────────────────────────

export async function getRevenueTrend(
  granularity: "daily" | "weekly" | "monthly",
  startDate: Date,
  endDate: Date,
  repId?: number
) {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [
    eq(deals.stage, "closed_won"),
    sql`${deals.actualCloseDate} >= ${startDate.toISOString().split("T")[0]}`,
    sql`${deals.actualCloseDate} <= ${endDate.toISOString().split("T")[0]}`,
  ];
  if (repId) conditions.push(eq(deals.assignedRepId, repId));

  let dateFormat: string;
  if (granularity === "daily") dateFormat = "%Y-%m-%d";
  else if (granularity === "weekly") dateFormat = "%Y-%u";
  else dateFormat = "%Y-%m";

  const rows = await db
    .select({
      period: sql<string>`DATE_FORMAT(actualCloseDate, ${dateFormat})`,
      revenue: sql<number>`coalesce(sum(value), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(deals)
    .where(and(...conditions))
    .groupBy(sql`DATE_FORMAT(actualCloseDate, ${dateFormat})`)
    .orderBy(sql`DATE_FORMAT(actualCloseDate, ${dateFormat})`);

  return rows;
}

// ─── Pipeline ────────────────────────────────────────────────────────────────

export async function getPipelineDeals(repId?: number) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (repId) conditions.push(eq(deals.assignedRepId, repId));

  const rows = await db
    .select({
      id: deals.id,
      title: deals.title,
      value: deals.value,
      stage: deals.stage,
      probability: deals.probability,
      expectedCloseDate: deals.expectedCloseDate,
      contactId: deals.contactId,
      accountId: deals.accountId,
      assignedRepId: deals.assignedRepId,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
      accountName: accounts.name,
      repName: salesReps.name,
      repInitials: salesReps.avatarInitials,
      repColor: salesReps.avatarColor,
    })
    .from(deals)
    .leftJoin(contacts, eq(deals.contactId, contacts.id))
    .leftJoin(accounts, eq(deals.accountId, accounts.id))
    .leftJoin(salesReps, eq(deals.assignedRepId, salesReps.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(deals.value));

  return rows;
}

// ─── Deals CRUD ──────────────────────────────────────────────────────────────

export async function getDeals(opts: {
  repId?: number;
  stage?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { rows: [], total: 0 };

  const conditions = [];
  if (opts.repId) conditions.push(eq(deals.assignedRepId, opts.repId));
  if (opts.stage) conditions.push(eq(deals.stage, opts.stage as any));
  if (opts.search) conditions.push(like(deals.title, `%${opts.search}%`));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(deals)
    .where(where);

  const rows = await db
    .select({
      id: deals.id,
      title: deals.title,
      value: deals.value,
      stage: deals.stage,
      probability: deals.probability,
      expectedCloseDate: deals.expectedCloseDate,
      actualCloseDate: deals.actualCloseDate,
      lostReason: deals.lostReason,
      notes: deals.notes,
      createdAt: deals.createdAt,
      updatedAt: deals.updatedAt,
      contactId: deals.contactId,
      accountId: deals.accountId,
      assignedRepId: deals.assignedRepId,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
      accountName: accounts.name,
      repName: salesReps.name,
      repInitials: salesReps.avatarInitials,
      repColor: salesReps.avatarColor,
    })
    .from(deals)
    .leftJoin(contacts, eq(deals.contactId, contacts.id))
    .leftJoin(accounts, eq(deals.accountId, accounts.id))
    .leftJoin(salesReps, eq(deals.assignedRepId, salesReps.id))
    .where(where)
    .orderBy(desc(deals.updatedAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);

  return { rows, total: countRow?.count ?? 0 };
}

export async function getDealById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({
      id: deals.id,
      title: deals.title,
      value: deals.value,
      stage: deals.stage,
      probability: deals.probability,
      expectedCloseDate: deals.expectedCloseDate,
      actualCloseDate: deals.actualCloseDate,
      lostReason: deals.lostReason,
      notes: deals.notes,
      createdAt: deals.createdAt,
      updatedAt: deals.updatedAt,
      contactId: deals.contactId,
      accountId: deals.accountId,
      assignedRepId: deals.assignedRepId,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
      accountName: accounts.name,
      repName: salesReps.name,
      repInitials: salesReps.avatarInitials,
      repColor: salesReps.avatarColor,
    })
    .from(deals)
    .leftJoin(contacts, eq(deals.contactId, contacts.id))
    .leftJoin(accounts, eq(deals.accountId, accounts.id))
    .leftJoin(salesReps, eq(deals.assignedRepId, salesReps.id))
    .where(eq(deals.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createDeal(data: {
  title: string;
  contactId?: number;
  accountId?: number;
  assignedRepId?: number;
  value: number;
  stage: string;
  probability?: number;
  expectedCloseDate?: string;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await (db.insert(deals) as any).values({
    title: data.title,
    contactId: data.contactId,
    accountId: data.accountId,
    assignedRepId: data.assignedRepId,
    value: String(data.value),
    stage: data.stage,
    probability: data.probability ?? 10,
    expectedCloseDate: data.expectedCloseDate,
    notes: data.notes,
  });
  return result;
}

export async function updateDeal(
  id: number,
  data: Partial<{
    title: string;
    contactId: number;
    accountId: number;
    assignedRepId: number;
    value: number;
    stage: string;
    probability: number;
    expectedCloseDate: string;
    actualCloseDate: string;
    lostReason: string;
    notes: string;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const updateData: Record<string, unknown> = { ...data };
  if (data.value !== undefined) updateData.value = String(data.value);
  await db.update(deals).set(updateData).where(eq(deals.id, id));
}

export async function deleteDeal(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(activities).where(eq(activities.dealId, id));
  await db.delete(deals).where(eq(deals.id, id));
}

// ─── Contacts CRUD ───────────────────────────────────────────────────────────

export async function getContacts(opts: {
  repId?: number;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { rows: [], total: 0 };

  const conditions = [];
  if (opts.repId) conditions.push(eq(contacts.assignedRepId, opts.repId));
  if (opts.status) conditions.push(eq(contacts.status, opts.status as any));
  if (opts.search) {
    conditions.push(
      or(
        like(contacts.firstName, `%${opts.search}%`),
        like(contacts.lastName, `%${opts.search}%`),
        like(contacts.email, `%${opts.search}%`)
      )
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(contacts)
    .where(where);

  const rows = await db
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      email: contacts.email,
      phone: contacts.phone,
      title: contacts.title,
      status: contacts.status,
      source: contacts.source,
      notes: contacts.notes,
      createdAt: contacts.createdAt,
      accountId: contacts.accountId,
      assignedRepId: contacts.assignedRepId,
      accountName: accounts.name,
      repName: salesReps.name,
      repInitials: salesReps.avatarInitials,
      repColor: salesReps.avatarColor,
    })
    .from(contacts)
    .leftJoin(accounts, eq(contacts.accountId, accounts.id))
    .leftJoin(salesReps, eq(contacts.assignedRepId, salesReps.id))
    .where(where)
    .orderBy(contacts.firstName)
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);

  return { rows, total: countRow?.count ?? 0 };
}

export async function getContactById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      email: contacts.email,
      phone: contacts.phone,
      title: contacts.title,
      status: contacts.status,
      source: contacts.source,
      notes: contacts.notes,
      createdAt: contacts.createdAt,
      accountId: contacts.accountId,
      assignedRepId: contacts.assignedRepId,
      accountName: accounts.name,
      repName: salesReps.name,
    })
    .from(contacts)
    .leftJoin(accounts, eq(contacts.accountId, accounts.id))
    .leftJoin(salesReps, eq(contacts.assignedRepId, salesReps.id))
    .where(eq(contacts.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createContact(data: {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  accountId?: number;
  assignedRepId?: number;
  status?: string;
  source?: string;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await (db.insert(contacts) as any).values({
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
    title: data.title,
    accountId: data.accountId,
    assignedRepId: data.assignedRepId,
    status: data.status ?? "prospect",
    source: data.source ?? "other",
    notes: data.notes,
  });
}

export async function updateContact(id: number, data: Partial<{
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  accountId: number;
  assignedRepId: number;
  status: string;
  source: string;
  notes: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(contacts).set(data as any).where(eq(contacts.id, id));
}

export async function deleteContact(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(activities).where(eq(activities.contactId, id));
  await db.delete(contacts).where(eq(contacts.id, id));
}

// ─── Activities ──────────────────────────────────────────────────────────────

export async function getActivities(opts: { dealId?: number; contactId?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (opts.dealId) conditions.push(eq(activities.dealId, opts.dealId));
  if (opts.contactId) conditions.push(eq(activities.contactId, opts.contactId));

  return db
    .select({
      id: activities.id,
      type: activities.type,
      title: activities.title,
      description: activities.description,
      dealId: activities.dealId,
      contactId: activities.contactId,
      repId: activities.repId,
      createdAt: activities.createdAt,
      repName: salesReps.name,
      repInitials: salesReps.avatarInitials,
      repColor: salesReps.avatarColor,
    })
    .from(activities)
    .leftJoin(salesReps, eq(activities.repId, salesReps.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(activities.createdAt))
    .limit(opts.limit ?? 50);
}

export async function getRecentActivities(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: activities.id,
      type: activities.type,
      title: activities.title,
      description: activities.description,
      dealId: activities.dealId,
      contactId: activities.contactId,
      repId: activities.repId,
      createdAt: activities.createdAt,
      repName: salesReps.name,
      repInitials: salesReps.avatarInitials,
      repColor: salesReps.avatarColor,
      dealTitle: deals.title,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
    })
    .from(activities)
    .leftJoin(salesReps, eq(activities.repId, salesReps.id))
    .leftJoin(deals, eq(activities.dealId, deals.id))
    .leftJoin(contacts, eq(activities.contactId, contacts.id))
    .orderBy(desc(activities.createdAt))
    .limit(limit);
}

export async function createActivity(data: {
  type: string;
  title: string;
  description?: string;
  dealId?: number;
  contactId?: number;
  repId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(activities).values({
    type: data.type as any,
    title: data.title,
    description: data.description,
    dealId: data.dealId,
    contactId: data.contactId,
    repId: data.repId,
  });
}

// ─── Team Leaderboard ────────────────────────────────────────────────────────

export async function getTeamLeaderboard(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];

  const wonConditions: any[] = [eq(deals.stage, "closed_won")];
  if (startDate) wonConditions.push(sql`${deals.actualCloseDate} >= ${startDate.toISOString().split("T")[0]}`);
  if (endDate) wonConditions.push(sql`${deals.actualCloseDate} <= ${endDate.toISOString().split("T")[0]}`);

  const wonRows = await db
    .select({
      repId: deals.assignedRepId,
      revenue: sql<number>`coalesce(sum(value), 0)`,
      dealsClosed: sql<number>`count(*)`,
    })
    .from(deals)
    .where(and(...wonConditions))
    .groupBy(deals.assignedRepId);

  const lostConditions: any[] = [eq(deals.stage, "closed_lost")];
  if (startDate) lostConditions.push(sql`${deals.actualCloseDate} >= ${startDate.toISOString().split("T")[0]}`);
  if (endDate) lostConditions.push(sql`${deals.actualCloseDate} <= ${endDate.toISOString().split("T")[0]}`);

  const lostRows = await db
    .select({
      repId: deals.assignedRepId,
      dealsLost: sql<number>`count(*)`,
    })
    .from(deals)
    .where(and(...lostConditions))
    .groupBy(deals.assignedRepId);

  const reps = await db.select().from(salesReps).where(eq(salesReps.isActive, "yes"));

  return reps.map((rep) => {
    const won = wonRows.find((r: any) => r.repId === rep.id);
    const lost = lostRows.find((r: any) => r.repId === rep.id);
    const totalClosed = (won?.dealsClosed ?? 0) + (lost?.dealsLost ?? 0);
    const winRate = totalClosed > 0 ? Math.round(((won?.dealsClosed ?? 0) / totalClosed) * 100) : 0;
    return {
      id: rep.id,
      name: rep.name,
      email: rep.email,
      title: rep.title,
      avatarInitials: rep.avatarInitials,
      avatarColor: rep.avatarColor,
      revenue: Number(won?.revenue ?? 0),
      dealsClosed: won?.dealsClosed ?? 0,
      dealsLost: lost?.dealsLost ?? 0,
      winRate,
    };
  }).sort((a, b) => b.revenue - a.revenue);
}

// ─── Accounts ────────────────────────────────────────────────────────────────

export async function getAccounts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(accounts).orderBy(accounts.name);
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export async function getDealsByStage(repId?: number) {
  const db = await getDb();
  if (!db) return [];

  const conditions = repId ? [eq(deals.assignedRepId, repId)] : [];

  return db
    .select({
      stage: deals.stage,
      count: sql<number>`count(*)`,
      totalValue: sql<number>`coalesce(sum(value), 0)`,
    })
    .from(deals)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(deals.stage);
}

// ─── Econophysics Data Queries ────────────────────────────────────────────────

/** Returns all closed-won deal values for Boltzmann-Gibbs / Gini / Pareto analysis */
export async function getClosedWonDealValues(): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ value: deals.value })
    .from(deals)
    .where(eq(deals.stage, "closed_won"));
  return rows.map(r => Number(r.value)).filter(v => v > 0);
}

/** Returns all deal values (any stage) for pipeline analysis */
export async function getAllDealValues(): Promise<{ stage: string; value: number; title: string }[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ stage: deals.stage, value: deals.value, title: deals.title })
    .from(deals);
  return rows.map(r => ({ stage: r.stage, value: Number(r.value), title: r.title }));
}

/** Returns per-rep revenue totals for entropy / Gini analysis */
export async function getRepRevenueForEntropy(): Promise<{ repName: string; revenue: number }[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      repName: salesReps.name,
      revenue: sql<number>`coalesce(sum(${deals.value}), 0)`,
    })
    .from(salesReps)
    .leftJoin(deals, and(eq(deals.assignedRepId, salesReps.id), eq(deals.stage, "closed_won")))
    .groupBy(salesReps.id, salesReps.name);
  return rows.map(r => ({ repName: r.repName, revenue: Number(r.revenue) }));
}

/** Returns monthly revenue totals for GBM parameter estimation */
export async function getMonthlyRevenueSeries(): Promise<{ label: string; totalValue: number; dealCount: number }[]> {
  const db = await getDb();
  if (!db) return [];
  // Use raw SQL to avoid Drizzle template issues with DATE_FORMAT in GROUP BY
  const rows = await db.execute(sql`
    SELECT
      DATE_FORMAT(actualCloseDate, '%Y-%m') AS month,
      COALESCE(SUM(value), 0) AS totalValue,
      COUNT(*) AS dealCount
    FROM deals
    WHERE stage = 'closed_won' AND actualCloseDate IS NOT NULL
    GROUP BY DATE_FORMAT(actualCloseDate, '%Y-%m')
    ORDER BY DATE_FORMAT(actualCloseDate, '%Y-%m') ASC
  `);
  const result = Array.isArray(rows) ? rows[0] : rows;
  if (!Array.isArray(result)) return [];
  return (result as any[]).map((r: any) => ({
    label: r.month ?? "",
    totalValue: Number(r.totalValue ?? 0),
    dealCount: Number(r.dealCount ?? 0),
  }));
}

/** Returns all stage win probabilities (from DB, falling back to defaults) */
export async function getStageProbabilities(): Promise<Record<string, number>> {
  const db = await getDb();
  const defaults: Record<string, number> = {
    lead: 0.10, qualified: 0.25, proposal: 0.45,
    negotiation: 0.70, closed_won: 1.00, closed_lost: 0.00,
  };
  if (!db) return defaults;
  try {
    const rows = await db.execute(sql`SELECT stage, probability FROM stage_probabilities`);
    const result = Array.isArray(rows) ? rows[0] : rows;
    if (!Array.isArray(result) || result.length === 0) return defaults;
    const out: Record<string, number> = { ...defaults };
    for (const r of result as any[]) {
      out[r.stage] = Number(r.probability);
    }
    return out;
  } catch {
    return defaults;
  }
}

/** Updates a single stage win probability */
export async function updateStageProbability(
  stage: string,
  probability: number,
  userId: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.execute(sql`
    INSERT INTO stage_probabilities (stage, probability, updatedByUserId)
    VALUES (${stage}, ${probability}, ${userId})
    ON DUPLICATE KEY UPDATE probability = ${probability}, updatedByUserId = ${userId}
  `);
}
