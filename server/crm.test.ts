import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeCtx(role: "admin" | "user" = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("auth.logout", () => {
  it("clears the session cookie and returns success", async () => {
    const cleared: string[] = [];
    const ctx: TrpcContext = {
      ...makeCtx(),
      res: {
        clearCookie: (name: string) => cleared.push(name),
      } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(cleared.length).toBe(1);
  });
});

describe("RBAC — adminProcedure", () => {
  it("allows admin users to call deals.delete", async () => {
    // We only verify the procedure resolves without FORBIDDEN error when
    // called by an admin. The underlying DB call will fail in test env
    // (no real DB), so we catch DB errors but not auth errors.
    const caller = appRouter.createCaller(makeCtx("admin"));
    try {
      await caller.deals.delete({ id: 999999 });
    } catch (err: any) {
      // Accept DB errors (no connection in test), reject FORBIDDEN
      expect(err?.code).not.toBe("FORBIDDEN");
    }
  });

  it("blocks non-admin users from calling deals.delete", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    await expect(caller.deals.delete({ id: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("blocks non-admin users from calling contacts.delete", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    await expect(caller.contacts.delete({ id: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("auth.me", () => {
  it("returns null for unauthenticated users", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns the user object for authenticated users", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const result = await caller.auth.me();
    expect(result?.role).toBe("admin");
    expect(result?.name).toBe("Test User");
  });
});
