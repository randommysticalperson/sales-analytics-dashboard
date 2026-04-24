import {
  bigint,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  date,
} from "drizzle-orm/mysql-core";

// ─── Users / Auth ───────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Sales Reps ─────────────────────────────────────────────────────────────

export const salesReps = mysqlTable("sales_reps", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  name: varchar("name", { length: 128 }).notNull(),
  email: varchar("email", { length: 320 }),
  avatarInitials: varchar("avatarInitials", { length: 4 }),
  avatarColor: varchar("avatarColor", { length: 32 }),
  title: varchar("title", { length: 128 }),
  isActive: mysqlEnum("isActive", ["yes", "no"]).default("yes").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SalesRep = typeof salesReps.$inferSelect;

// ─── Accounts ────────────────────────────────────────────────────────────────

export const accounts = mysqlTable("accounts", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  industry: varchar("industry", { length: 128 }),
  website: varchar("website", { length: 256 }),
  size: mysqlEnum("size", ["1-10", "11-50", "51-200", "201-1000", "1000+"]).default("1-10"),
  annualRevenue: decimal("annualRevenue", { precision: 15, scale: 2 }),
  country: varchar("country", { length: 128 }),
  city: varchar("city", { length: 128 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Account = typeof accounts.$inferSelect;

// ─── Contacts ────────────────────────────────────────────────────────────────

export const contacts = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
  firstName: varchar("firstName", { length: 128 }).notNull(),
  lastName: varchar("lastName", { length: 128 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 64 }),
  title: varchar("title", { length: 128 }),
  accountId: int("accountId"),
  assignedRepId: int("assignedRepId"),
  status: mysqlEnum("status", ["active", "inactive", "prospect"]).default("prospect").notNull(),
  source: mysqlEnum("source", ["inbound", "outbound", "referral", "event", "other"]).default("other"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Contact = typeof contacts.$inferSelect;

// ─── Deals ───────────────────────────────────────────────────────────────────

export const deals = mysqlTable("deals", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 256 }).notNull(),
  contactId: int("contactId"),
  accountId: int("accountId"),
  assignedRepId: int("assignedRepId"),
  value: decimal("value", { precision: 15, scale: 2 }).notNull().default("0"),
  stage: mysqlEnum("stage", [
    "lead",
    "qualified",
    "proposal",
    "negotiation",
    "closed_won",
    "closed_lost",
  ])
    .default("lead")
    .notNull(),
  probability: int("probability").default(10),
  expectedCloseDate: date("expectedCloseDate"),
  actualCloseDate: date("actualCloseDate"),
  lostReason: varchar("lostReason", { length: 256 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Deal = typeof deals.$inferSelect;

// ─── Activities ──────────────────────────────────────────────────────────────

export const activities = mysqlTable("activities", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["note", "call", "email", "meeting", "task"]).default("note").notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  dealId: int("dealId"),
  contactId: int("contactId"),
  repId: int("repId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Activity = typeof activities.$inferSelect;
