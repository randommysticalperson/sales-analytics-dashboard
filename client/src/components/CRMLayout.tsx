import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Building2,
  ChevronRight,
  FlaskConical,
  Kanban,
  LayoutDashboard,
  LogOut,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const NAV_ITEMS = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Pipeline", href: "/pipeline", icon: Kanban },
  { label: "Contacts", href: "/contacts", icon: Users },
  { label: "Deals", href: "/deals", icon: Building2 },
  { label: "Team", href: "/team", icon: TrendingUp },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Econophysics", href: "/econophysics", icon: FlaskConical },
];

function UserAvatar({ name, role }: { name?: string | null; role?: string }) {
  const initials = name
    ? name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary-foreground flex-shrink-0"
        style={{ background: "oklch(0.49 0.18 264 / 0.25)", color: "oklch(0.88 0.06 264)" }}>
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-sidebar-foreground truncate">{name ?? "User"}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <p className="text-xs text-sidebar-foreground/50 capitalize">{role ?? "user"}</p>
          {role === "admin" && (
            <span className="text-[10px] font-semibold px-1 py-0 rounded bg-amber-500/20 text-amber-400 leading-4">ADMIN</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CRMLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, loading, isAuthenticated } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = "/";
    },
    onError: () => toast.error("Logout failed"),
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Zap className="w-8 h-8 text-primary animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-sm mx-auto px-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Zap className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold mb-2 text-foreground">Sales CRM</h1>
          <p className="text-muted-foreground text-sm mb-8">
            Sign in to access your sales analytics dashboard.
          </p>
          <a
            href={getLoginUrl()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Sign in to continue
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ─── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "flex flex-col h-full transition-all duration-300 flex-shrink-0",
          "bg-sidebar border-r border-sidebar-border",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-sidebar-foreground leading-tight">Sales CRM</p>
              <p className="text-xs text-sidebar-foreground/40 leading-tight">Analytics</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "ml-auto p-1 rounded-md hover:bg-sidebar-accent transition-colors flex-shrink-0",
              collapsed && "mx-auto"
            )}
          >
            <ChevronRight
              className={cn(
                "w-4 h-4 text-sidebar-foreground/50 transition-transform duration-300",
                !collapsed && "rotate-180"
              )}
            />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const isActive = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
                title={collapsed ? label : undefined}
              >
                <Icon className={cn("w-4 h-4 flex-shrink-0", isActive && "text-primary")} />
                {!collapsed && <span>{label}</span>}
                {!collapsed && isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-sidebar-border p-3 flex-shrink-0">
          {!collapsed ? (
            <div className="flex items-center gap-2">
              <UserAvatar name={user?.name} role={user?.role} />
              <button
                onClick={() => logoutMutation.mutate()}
                className="ml-auto p-1.5 rounded-md hover:bg-sidebar-accent transition-colors flex-shrink-0"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5 text-sidebar-foreground/50" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => logoutMutation.mutate()}
              className="w-full flex items-center justify-center p-2 rounded-md hover:bg-sidebar-accent transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4 text-sidebar-foreground/50" />
            </button>
          )}
        </div>
      </aside>

      {/* ─── Main content ─────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto min-w-0">
        {children}
      </main>
    </div>
  );
}
