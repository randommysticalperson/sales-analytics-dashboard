import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, ChevronDown, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, StatusBadge, PageHeader, EmptyState, formatDate } from "@/components/crm/shared";
import { cn } from "@/lib/utils";
import { Users } from "lucide-react";

type ContactForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  accountId: string;
  assignedRepId: string;
  status: string;
  source: string;
  notes: string;
};

const EMPTY_FORM: ContactForm = {
  firstName: "", lastName: "", email: "", phone: "", title: "",
  accountId: "", assignedRepId: "", status: "prospect", source: "other", notes: "",
};

function ContactModal({
  open,
  onClose,
  initial,
  accounts,
  reps,
  onSave,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  initial?: ContactForm;
  accounts: { id: number; name: string }[];
  reps: { id: number; name: string }[];
  onSave: (data: ContactForm) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<ContactForm>(initial ?? EMPTY_FORM);
  const set = (k: keyof ContactForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("First and last name are required");
      return;
    }
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Contact" : "New Contact"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="space-y-1.5">
            <Label>First Name *</Label>
            <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="Jane" />
          </div>
          <div className="space-y-1.5">
            <Label>Last Name *</Label>
            <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="Smith" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="jane@company.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+1 555 000 0000" />
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="VP of Sales" />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="prospect">Prospect</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
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
          <div className="space-y-1.5">
            <Label>Assigned Rep</Label>
            <Select value={form.assignedRepId} onValueChange={(v) => set("assignedRepId", v)}>
              <SelectTrigger><SelectValue placeholder="Select rep" /></SelectTrigger>
              <SelectContent>
                {reps.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Source</Label>
            <Select value={form.source} onValueChange={(v) => set("source", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="inbound">Inbound</SelectItem>
                <SelectItem value="outbound">Outbound</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
                <SelectItem value="event">Event</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Any notes..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Contact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Contacts() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editContact, setEditContact] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const contactsQuery = trpc.contacts.list.useQuery({ search: search || undefined, status: statusFilter && statusFilter !== "all" ? statusFilter : undefined, limit: 100 });
  const accountsQuery = trpc.accounts.list.useQuery();
  const repsQuery = trpc.reps.list.useQuery();

  const createMutation = trpc.contacts.create.useMutation({
    onSuccess: () => { utils.contacts.list.invalidate(); setModalOpen(false); toast.success("Contact created"); },
    onError: () => toast.error("Failed to create contact"),
  });
  const updateMutation = trpc.contacts.update.useMutation({
    onSuccess: () => { utils.contacts.list.invalidate(); setEditContact(null); toast.success("Contact updated"); },
    onError: () => toast.error("Failed to update contact"),
  });
  const deleteMutation = trpc.contacts.delete.useMutation({
    onSuccess: () => { utils.contacts.list.invalidate(); setDeleteId(null); toast.success("Contact deleted"); },
    onError: () => toast.error("Failed to delete contact"),
  });

  const contacts = contactsQuery.data?.rows ?? [];
  const accounts = accountsQuery.data ?? [];
  const reps = repsQuery.data ?? [];

  const handleSave = (form: ContactForm) => {
    const payload = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email || undefined,
      phone: form.phone || undefined,
      title: form.title || undefined,
      accountId: form.accountId ? Number(form.accountId) : undefined,
      assignedRepId: form.assignedRepId ? Number(form.assignedRepId) : undefined,
      status: form.status,
      source: form.source,
      notes: form.notes || undefined,
    };
    if (editContact) {
      updateMutation.mutate({ id: editContact.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openEdit = (c: any) => {
    setEditContact({
      ...c,
      form: {
        firstName: c.firstName ?? "",
        lastName: c.lastName ?? "",
        email: c.email ?? "",
        phone: c.phone ?? "",
        title: c.title ?? "",
        accountId: c.accountId ? String(c.accountId) : "",
        assignedRepId: c.assignedRepId ? String(c.assignedRepId) : "",
        status: c.status ?? "prospect",
        source: c.source ?? "other",
        notes: c.notes ?? "",
      },
    });
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Contacts"
        subtitle={`${contacts.length} contacts`}
        actions={
          <Button onClick={() => setModalOpen(true)} size="sm" className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            New Contact
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            className="pl-9 h-9 text-sm"
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="prospect">Prospect</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Account</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rep</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Added</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody>
            {contactsQuery.isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-border animate-pulse">
                  <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-32" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-40" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-24" /></td>
                  <td className="px-4 py-3"><div className="h-5 bg-muted rounded w-16" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-20" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-20" /></td>
                  <td className="px-4 py-3" />
                </tr>
              ))
            ) : contacts.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <EmptyState icon={Users} title="No contacts found" description="Create your first contact or adjust your filters." />
                </td>
              </tr>
            ) : (
              contacts.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
                        {(c.firstName?.[0] ?? "") + (c.lastName?.[0] ?? "")}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{c.firstName} {c.lastName}</p>
                        {c.title && <p className="text-xs text-muted-foreground">{c.title}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-0.5">
                      {c.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{c.email}</span>
                        </div>
                      )}
                      {c.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{c.phone}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-foreground">{c.accountName ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3">
                    {c.repName ? (
                      <div className="flex items-center gap-1.5">
                        <Avatar initials={c.repInitials} color={c.repColor} size="xs" />
                        <span className="text-xs text-muted-foreground">{c.repName}</span>
                      </div>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(c.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => openEdit(c)}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteId(c.id)}
                         className="p-1.5 rounded-md hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
                         style={{ display: isAdmin ? undefined : 'none' }}
                       >
                         <Trash2 className="w-3.5 h-3.5" />
                       </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {modalOpen && (
        <ContactModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          accounts={accounts}
          reps={reps}
          onSave={handleSave}
          loading={createMutation.isPending}
        />
      )}

      {/* Edit Modal */}
      {editContact && (
        <ContactModal
          open={!!editContact}
          onClose={() => setEditContact(null)}
          initial={editContact.form}
          accounts={accounts}
          reps={reps}
          onSave={handleSave}
          loading={updateMutation.isPending}
        />
      )}

      {/* Delete Confirm */}
      <Dialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Contact</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete the contact and all associated activities. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteId !== null && deleteMutation.mutate({ id: deleteId })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
