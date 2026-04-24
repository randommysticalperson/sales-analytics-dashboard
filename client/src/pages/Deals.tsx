import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, ChevronRight, X, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Avatar,
  StageBadge,
  PageHeader,
  EmptyState,
  formatCurrency,
  formatCurrencyFull,
  formatDate,
  ActivityIcon,
  timeAgo,
} from "@/components/crm/shared";
import { Building2 } from "lucide-react";

type DealForm = {
  title: string;
  contactId: string;
  accountId: string;
  assignedRepId: string;
  value: string;
  stage: string;
  probability: string;
  expectedCloseDate: string;
  notes: string;
};

const EMPTY_FORM: DealForm = {
  title: "", contactId: "", accountId: "", assignedRepId: "",
  value: "", stage: "lead", probability: "10", expectedCloseDate: "", notes: "",
};

const STAGES = ["lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"];
const STAGE_LABELS: Record<string, string> = {
  lead: "Lead", qualified: "Qualified", proposal: "Proposal",
  negotiation: "Negotiation", closed_won: "Closed Won", closed_lost: "Closed Lost",
};

function DealModal({
  open, onClose, initial, contacts, accounts, reps, onSave, loading,
}: {
  open: boolean; onClose: () => void; initial?: DealForm;
  contacts: any[]; accounts: any[]; reps: any[];
  onSave: (data: DealForm) => void; loading: boolean;
}) {
  const [form, setForm] = useState<DealForm>(initial ?? EMPTY_FORM);
  const set = (k: keyof DealForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Deal" : "New Deal"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="col-span-2 space-y-1.5">
            <Label>Deal Title *</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Enterprise License Q2" />
          </div>
          <div className="space-y-1.5">
            <Label>Value ($)</Label>
            <Input type="number" value={form.value} onChange={(e) => set("value", e.target.value)} placeholder="50000" />
          </div>
          <div className="space-y-1.5">
            <Label>Stage</Label>
            <Select value={form.stage} onValueChange={(v) => set("stage", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Probability (%)</Label>
            <Input type="number" min="0" max="100" value={form.probability} onChange={(e) => set("probability", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Expected Close</Label>
            <Input type="date" value={form.expectedCloseDate} onChange={(e) => set("expectedCloseDate", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Contact</Label>
            <Select value={form.contactId} onValueChange={(v) => set("contactId", v)}>
              <SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger>
              <SelectContent>
                {contacts.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.firstName} {c.lastName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Account</Label>
            <Select value={form.accountId} onValueChange={(v) => set("accountId", v)}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Assigned Rep</Label>
            <Select value={form.assignedRepId} onValueChange={(v) => set("assignedRepId", v)}>
              <SelectTrigger><SelectValue placeholder="Select rep" /></SelectTrigger>
              <SelectContent>
                {reps.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={loading || !form.title.trim()}>
            {loading ? "Saving..." : "Save Deal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DealDetailPanel({ dealId, onClose }: { dealId: number; onClose: () => void }) {
  const [noteText, setNoteText] = useState("");
  const utils = trpc.useUtils();
  const dealQuery = trpc.deals.byId.useQuery({ id: dealId });
  const activitiesQuery = trpc.activities.list.useQuery({ dealId, limit: 30 });
  const repsQuery = trpc.reps.list.useQuery();
  const createActivity = trpc.activities.create.useMutation({
    onSuccess: () => { utils.activities.list.invalidate(); setNoteText(""); toast.success("Note added"); },
  });

  const deal = dealQuery.data;
  const activities = activitiesQuery.data ?? [];
  const reps = repsQuery.data ?? [];

  return (
    <div className="w-96 flex-shrink-0 border-l border-border bg-card flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Deal Details</h3>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-muted transition-colors">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {deal && (
        <div className="p-5 border-b border-border space-y-3">
          <div>
            <p className="text-base font-semibold text-foreground">{deal.title}</p>
            <p className="text-xl font-bold text-primary mt-1">{formatCurrencyFull(Number(deal.value))}</p>
          </div>
          <div className="flex items-center gap-2">
            <StageBadge stage={deal.stage} />
            {deal.probability != null && (
              <span className="text-xs text-muted-foreground">{deal.probability}% probability</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {deal.contactFirstName && (
              <div>
                <p className="text-muted-foreground">Contact</p>
                <p className="font-medium text-foreground">{deal.contactFirstName} {deal.contactLastName}</p>
              </div>
            )}
            {deal.accountName && (
              <div>
                <p className="text-muted-foreground">Account</p>
                <p className="font-medium text-foreground">{deal.accountName}</p>
              </div>
            )}
            {deal.expectedCloseDate && (
              <div>
                <p className="text-muted-foreground">Expected Close</p>
                <p className="font-medium text-foreground">{formatDate(deal.expectedCloseDate)}</p>
              </div>
            )}
            {deal.repName && (
              <div>
                <p className="text-muted-foreground">Rep</p>
                <p className="font-medium text-foreground">{deal.repName}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Activity feed */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Activity</p>
        {activities.length === 0 ? (
          <p className="text-xs text-muted-foreground">No activity yet</p>
        ) : (
          activities.map((a) => (
            <div key={a.id} className="flex gap-2.5">
              <ActivityIcon type={a.type} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">{a.title}</p>
                {a.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.description}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(a.createdAt)}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add note */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note..."
            rows={2}
            className="text-xs resize-none"
          />
          <Button
            size="sm"
            className="self-end"
            disabled={!noteText.trim() || createActivity.isPending}
            onClick={() => {
              if (!noteText.trim()) return;
              const rep = reps[0];
              createActivity.mutate({
                type: "note",
                title: noteText.slice(0, 60),
                description: noteText,
                dealId,
                repId: rep?.id,
              });
            }}
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Deals() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editDeal, setEditDeal] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<number | null>(null);

  const dealsQuery = trpc.deals.list.useQuery({ search: search || undefined, stage: stageFilter && stageFilter !== "all" ? stageFilter : undefined, limit: 100 });
  const contactsQuery = trpc.contacts.list.useQuery({ limit: 200 });
  const accountsQuery = trpc.accounts.list.useQuery();
  const repsQuery = trpc.reps.list.useQuery();

  const createMutation = trpc.deals.create.useMutation({
    onSuccess: () => { utils.deals.list.invalidate(); setModalOpen(false); toast.success("Deal created"); },
    onError: () => toast.error("Failed to create deal"),
  });
  const updateMutation = trpc.deals.update.useMutation({
    onSuccess: () => { utils.deals.list.invalidate(); setEditDeal(null); toast.success("Deal updated"); },
    onError: () => toast.error("Failed to update deal"),
  });
  const deleteMutation = trpc.deals.delete.useMutation({
    onSuccess: () => { utils.deals.list.invalidate(); setDeleteId(null); toast.success("Deal deleted"); },
    onError: () => toast.error("Failed to delete deal"),
  });

  const deals = dealsQuery.data?.rows ?? [];
  const contacts = contactsQuery.data?.rows ?? [];
  const accounts = accountsQuery.data ?? [];
  const reps = repsQuery.data ?? [];

  const handleSave = (form: DealForm) => {
    const payload = {
      title: form.title,
      contactId: form.contactId ? Number(form.contactId) : undefined,
      accountId: form.accountId ? Number(form.accountId) : undefined,
      assignedRepId: form.assignedRepId ? Number(form.assignedRepId) : undefined,
      value: form.value ? Number(form.value) : 0,
      stage: form.stage,
      probability: form.probability ? Number(form.probability) : undefined,
      expectedCloseDate: form.expectedCloseDate || undefined,
      notes: form.notes || undefined,
    };
    if (editDeal) {
      updateMutation.mutate({ id: editDeal.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openEdit = (d: any) => {
    setEditDeal({
      ...d,
      form: {
        title: d.title ?? "",
        contactId: d.contactId ? String(d.contactId) : "",
        accountId: d.accountId ? String(d.accountId) : "",
        assignedRepId: d.assignedRepId ? String(d.assignedRepId) : "",
        value: d.value ? String(Number(d.value)) : "",
        stage: d.stage ?? "lead",
        probability: d.probability != null ? String(d.probability) : "10",
        expectedCloseDate: d.expectedCloseDate ? String(d.expectedCloseDate).split("T")[0] : "",
        notes: d.notes ?? "",
      },
    });
  };

  const totalValue = deals.reduce((s, d) => s + Number(d.value), 0);

  return (
    <div className="flex h-full">
      <div className="flex-1 p-6 overflow-y-auto min-w-0">
        <PageHeader
          title="Deals"
          subtitle={`${deals.length} deals · ${formatCurrency(totalValue)} total value`}
          actions={
            <Button onClick={() => setModalOpen(true)} size="sm" className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              New Deal
            </Button>
          }
        />

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input className="pl-9 h-9 text-sm" placeholder="Search deals..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-40 h-9 text-sm">
              <SelectValue placeholder="All stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {STAGES.map((s) => <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deal</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Value</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stage</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rep</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Close Date</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody>
              {dealsQuery.isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-border animate-pulse">
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : deals.length === 0 ? (
                <tr><td colSpan={7}><EmptyState icon={Building2} title="No deals found" description="Create your first deal or adjust your filters." /></td></tr>
              ) : (
                deals.map((d) => (
                  <tr
                    key={d.id}
                    className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer ${selectedDealId === d.id ? "bg-accent/30" : ""}`}
                    onClick={() => setSelectedDealId(selectedDealId === d.id ? null : d.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${selectedDealId === d.id ? "rotate-90" : ""}`} />
                        <span className="font-medium text-foreground">{d.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">{formatCurrency(Number(d.value))}</td>
                    <td className="px-4 py-3"><StageBadge stage={d.stage} /></td>
                    <td className="px-4 py-3 text-muted-foreground text-sm">
                      {d.contactFirstName ? `${d.contactFirstName} ${d.contactLastName ?? ""}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {d.repInitials ? (
                        <div className="flex items-center gap-1.5">
                          <Avatar initials={d.repInitials} color={d.repColor} size="xs" />
                          <span className="text-xs text-muted-foreground">{d.repName}</span>
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(d.expectedCloseDate)}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(d)} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {isAdmin && (
                          <button onClick={() => setDeleteId(d.id)} className="p-1.5 rounded-md hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Panel */}
      {selectedDealId && (
        <DealDetailPanel dealId={selectedDealId} onClose={() => setSelectedDealId(null)} />
      )}

      {/* Modals */}
      {modalOpen && (
        <DealModal open={modalOpen} onClose={() => setModalOpen(false)} contacts={contacts} accounts={accounts} reps={reps} onSave={handleSave} loading={createMutation.isPending} />
      )}
      {editDeal && (
        <DealModal open={!!editDeal} onClose={() => setEditDeal(null)} initial={editDeal.form} contacts={contacts} accounts={accounts} reps={reps} onSave={handleSave} loading={updateMutation.isPending} />
      )}
      <Dialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete Deal</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete the deal and all associated activities.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId !== null && deleteMutation.mutate({ id: deleteId })} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
