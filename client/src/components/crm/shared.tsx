import { cn } from "@/lib/utils";
import { FileText, Mail, Phone, Calendar, MessageSquare, CheckSquare } from "lucide-react";

// ─── Stage Badge ─────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

export function StageBadge({ stage }: { stage: string }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium", `stage-${stage}`)}>
      {STAGE_LABELS[stage] ?? stage}
    </span>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  inactive: "bg-slate-100 text-slate-500 border border-slate-200",
  prospect: "bg-blue-50 text-blue-700 border border-blue-100",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium capitalize", STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600")}>
      {status}
    </span>
  );
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

export function Avatar({
  initials,
  color,
  size = "sm",
  name,
}: {
  initials?: string | null;
  color?: string | null;
  size?: "xs" | "sm" | "md";
  name?: string;
}) {
  const sizeClasses = { xs: "w-6 h-6 text-xs", sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm" };
  const bg = color ?? "#6366f1";
  return (
    <div
      className={cn("rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0", sizeClasses[size])}
      style={{ backgroundColor: bg }}
      title={name}
    >
      {initials ?? "?"}
    </div>
  );
}

// ─── Currency formatter ───────────────────────────────────────────────────────

export function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

export function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

// ─── Activity Icon ────────────────────────────────────────────────────────────

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  note: FileText,
  call: Phone,
  email: Mail,
  meeting: Calendar,
  task: CheckSquare,
};

export function ActivityIcon({ type }: { type: string }) {
  const Icon = ACTIVITY_ICONS[type] ?? MessageSquare;
  return (
    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0", `activity-${type}`)}>
      <Icon className="w-3.5 h-3.5" />
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

export function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">{title}</p>
      {description && <p className="text-xs text-muted-foreground max-w-xs">{description}</p>}
    </div>
  );
}

// ─── Page header ──────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}

// ─── Date formatter ───────────────────────────────────────────────────────────

export function formatDate(dateStr?: string | Date | null): string {
  if (!dateStr) return "—";
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function timeAgo(dateStr?: string | Date | null): string {
  if (!dateStr) return "";
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}
