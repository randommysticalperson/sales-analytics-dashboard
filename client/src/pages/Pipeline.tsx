import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Building2, Calendar, TrendingUp } from "lucide-react";
import { Avatar, formatCurrency, formatDate, PageHeader, StageBadge } from "@/components/crm/shared";
import { toast } from "sonner";

const STAGES = [
  { key: "lead", label: "Lead", color: "#94a3b8" },
  { key: "qualified", label: "Qualified", color: "#3b82f6" },
  { key: "proposal", label: "Proposal", color: "#8b5cf6" },
  { key: "negotiation", label: "Negotiation", color: "#f59e0b" },
  { key: "closed_won", label: "Closed Won", color: "#10b981" },
  { key: "closed_lost", label: "Closed Lost", color: "#ef4444" },
];

type Deal = {
  id: number;
  title: string;
  value: string | number;
  stage: string;
  probability?: number | null;
  expectedCloseDate?: string | Date | null;
  contactFirstName?: string | null;
  contactLastName?: string | null;
  accountName?: string | null;
  repName?: string | null;
  repInitials?: string | null;
  repColor?: string | null;
};

function DealCard({ deal, onStageChange }: { deal: Deal; onStageChange: (id: number, stage: string) => void }) {
  const contactName = [deal.contactFirstName, deal.contactLastName].filter(Boolean).join(" ");
  return (
    <div className="bg-card border border-border rounded-lg p-3.5 shadow-sm hover:shadow-md transition-all duration-150 cursor-default group">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-foreground leading-tight line-clamp-2">{deal.title}</p>
        <p className="text-sm font-bold text-primary flex-shrink-0">{formatCurrency(Number(deal.value))}</p>
      </div>

      {deal.accountName && (
        <div className="flex items-center gap-1.5 mb-2">
          <Building2 className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground truncate">{deal.accountName}</span>
        </div>
      )}

      {deal.expectedCloseDate && (
        <div className="flex items-center gap-1.5 mb-2">
          <Calendar className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground">{formatDate(deal.expectedCloseDate)}</span>
        </div>
      )}

      {deal.probability != null && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Probability</span>
            <span className="text-xs font-medium text-foreground">{deal.probability}%</span>
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${deal.probability}%`, background: "oklch(0.49 0.18 264)" }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        {contactName ? (
          <span className="text-xs text-muted-foreground truncate">{contactName}</span>
        ) : <span />}
        {deal.repInitials && (
          <Avatar initials={deal.repInitials} color={deal.repColor} size="xs" name={deal.repName ?? ""} />
        )}
      </div>

      {/* Stage move buttons */}
      <div className="flex gap-1 mt-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {STAGES.filter((s) => s.key !== deal.stage).slice(0, 3).map((s) => (
          <button
            key={s.key}
            onClick={() => onStageChange(deal.id, s.key)}
            className="text-xs px-2 py-0.5 rounded border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            → {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Pipeline() {
  const utils = trpc.useUtils();
  const pipelineQuery = trpc.pipeline.deals.useQuery({});
  const updateDeal = trpc.deals.update.useMutation({
    onSuccess: () => {
      utils.pipeline.deals.invalidate();
      toast.success("Deal stage updated");
    },
    onError: () => toast.error("Failed to update stage"),
  });

  const deals = pipelineQuery.data ?? [];

  const stageDeals = STAGES.reduce<Record<string, Deal[]>>((acc, s) => {
    acc[s.key] = deals.filter((d) => d.stage === s.key);
    return acc;
  }, {});

  const stageValue = (key: string) =>
    stageDeals[key]?.reduce((sum, d) => sum + Number(d.value), 0) ?? 0;

  const handleStageChange = (id: number, stage: string) => {
    updateDeal.mutate({ id, stage });
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <PageHeader
        title="Pipeline"
        subtitle={`${deals.length} active deals · ${formatCurrency(deals.reduce((s, d) => s + Number(d.value), 0))} total pipeline`}
      />

      {pipelineQuery.isLoading ? (
        <div className="flex gap-4 flex-1 overflow-x-auto pb-4">
          {STAGES.map((s) => (
            <div key={s.key} className="w-64 flex-shrink-0 bg-muted/50 rounded-xl h-48 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex gap-3 flex-1 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const stageDealList = stageDeals[stage.key] ?? [];
            return (
              <div key={stage.key} className="w-64 flex-shrink-0 flex flex-col">
                {/* Column header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                    <span className="text-xs font-semibold text-foreground">{stage.label}</span>
                    <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
                      {stageDealList.length}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {formatCurrency(stageValue(stage.key))}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {stageDealList.length === 0 ? (
                    <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                      <p className="text-xs text-muted-foreground">No deals</p>
                    </div>
                  ) : (
                    stageDealList.map((deal) => (
                      <DealCard key={deal.id} deal={deal} onStageChange={handleStageChange} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
