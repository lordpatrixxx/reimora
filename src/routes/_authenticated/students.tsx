import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";
import { useStudents } from "@/lib/queries";
import { maskAccount } from "@/lib/money";
import { Card, Empty, Field, PageHeader, btn, errMsg, inputCls } from "@/components/app/ui-bits";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({ meta: [{ title: "Students & beneficiaries — CampusSettle" }, { name: "description", content: "Student and beneficiary records." }] }),
  component: Students,
});

function Students() {
  const { data: me } = useMe();
  const { data: students = [] } = useStudents();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const list = students.filter((s) => `${s.full_name} ${s.prn}`.toLowerCase().includes(q.toLowerCase()));
  const s = students.find((x) => x.id === sel);

  return (
    <div>
      <PageHeader title="Students & beneficiaries" sub="Demonstration mode: only fictional bank details are accepted, and only the last 4 digits are stored."
        action={me?.isFinance && <button onClick={() => setAdding(true)} className={btn.primary}><Plus className="h-4 w-4" /> Add student</button>} />
      <input className={inputCls + " mb-4 max-w-sm"} placeholder="Search name or PRN" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.length === 0 ? <Empty title="No students yet" body="Students appear when they set up a profile, or when finance adds them." /> : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {list.map((x) => (
              <li key={x.id}>
                <button onClick={() => setSel(x.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50">
                  <div><p className="font-semibold">{x.full_name}</p><p className="text-xs text-muted-foreground">{x.prn} · {x.department} {x.year} {x.division && `· Div ${x.division}`}</p></div>
                  <span className="text-xs text-muted-foreground">{x.beneficiaries.filter((b) => b.is_active).length} beneficiary</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {adding && <AddStudent onClose={() => setAdding(false)} />}
      {s && <StudentDrawer student={s} canEdit={!!me?.isFinance} onClose={() => setSel(null)} />}
    </div>
  );
}

function Drawer({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-foreground/30" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 w-full max-w-md animate-rise overflow-auto bg-card p-6 shadow-float">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-primary">{title}</h2><button onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button></div>
        {children}
      </div>
    </div>
  );
}

function AddStudent({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ full_name: "", prn: "", department: "Information Technology", year: "", division: "", email: "" });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("students").insert({ ...f, prn: f.prn.trim().toUpperCase() });
    if (error) return toast.error(errMsg(error));
    qc.invalidateQueries({ queryKey: ["students"] }); onClose();
  }
  return (
    <Drawer title="Add student" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        {(["full_name", "prn", "department", "year", "division", "email"] as const).map((k) => (
          <Field key={k} label={k === "email" ? "Notification email" : k.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase())}>
            <input required={["full_name", "prn", "email"].includes(k)} type={k === "email" ? "email" : "text"} className={inputCls} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          </Field>
        ))}
        <button className={btn.primary + " w-full"}>Save student</button>
      </form>
    </Drawer>
  );
}

function StudentDrawer({ student, canEdit, onClose }: { student: NonNullable<ReturnType<typeof useStudents>["data"]>[number]; canEdit: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ holder_name: student.full_name, bank_name: "", account_last4: "", ifsc: "", is_default: student.beneficiaries.length === 0 });
  const { data: history = [] } = useQuery({
    queryKey: ["ben-history", student.id], enabled: canEdit,
    queryFn: async () => (await supabase.from("beneficiary_history").select("*").in("beneficiary_id", student.beneficiaries.map((b) => b.id)).order("created_at", { ascending: false })).data ?? [],
  });
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("beneficiaries").insert({ ...f, ifsc: f.ifsc.toUpperCase(), student_id: student.id, is_fictional: true });
    if (error) return toast.error(error.message.includes("check") ? "Use 4 digits and a valid IFSC (e.g. DEMO0001234)" : errMsg(error));
    qc.invalidateQueries({ queryKey: ["students"] });
    setF({ ...f, bank_name: "", account_last4: "", ifsc: "" });
  }
  async function update(id: string, patch: { is_default?: boolean; is_active?: boolean }) {
    const { error } = await supabase.from("beneficiaries").update(patch).eq("id", id);
    if (error) toast.error(errMsg(error));
    qc.invalidateQueries({ queryKey: ["students"] });
  }
  return (
    <Drawer title={student.full_name} onClose={onClose}>
      <p className="text-sm text-muted-foreground">{student.prn} · {student.email}</p>
      <h3 className="mt-5 text-sm font-semibold text-primary">Beneficiary profiles</h3>
      <ul className="mt-2 space-y-2">
        {student.beneficiaries.map((b) => (
          <li key={b.id} className={`rounded-xl border p-3 text-sm ${b.is_active ? "border-border" : "border-dashed opacity-60"}`}>
            <div className="flex justify-between"><b>{b.holder_name}</b>{b.is_fictional && <span className="rounded-full bg-warning-soft px-2 text-[10px] font-bold uppercase text-warning">Fictional</span>}</div>
            <p className="text-muted-foreground">{b.bank_name} · {b.ifsc}</p>
            <p className="tabular">{maskAccount(b.account_last4)}</p>
            {canEdit && (
              <div className="mt-2 flex gap-3 text-xs font-semibold">
                {!b.is_default && b.is_active && <button onClick={() => update(b.id, { is_default: true })} className="text-primary">Make default</button>}
                {b.is_default && <span className="text-primary">Default</span>}
                <button onClick={() => update(b.id, { is_active: !b.is_active })} className="text-muted-foreground">{b.is_active ? "Deactivate" : "Reactivate"}</button>
              </div>
            )}
          </li>
        ))}
        {student.beneficiaries.length === 0 && <li className="text-sm text-muted-foreground">None yet.</li>}
      </ul>
      {canEdit && (
        <form onSubmit={add} className="mt-5 space-y-2 rounded-xl bg-muted p-4">
          <p className="text-xs font-semibold">Add fictional beneficiary (demonstration only)</p>
          <input required className={inputCls} placeholder="Account holder" value={f.holder_name} onChange={(e) => setF({ ...f, holder_name: e.target.value })} />
          <input required className={inputCls} placeholder="Bank name" value={f.bank_name} onChange={(e) => setF({ ...f, bank_name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input required maxLength={4} inputMode="numeric" className={inputCls} placeholder="Last 4 digits" value={f.account_last4} onChange={(e) => setF({ ...f, account_last4: e.target.value.replace(/\D/g, "") })} />
            <input required className={inputCls} placeholder="IFSC" value={f.ifsc} onChange={(e) => setF({ ...f, ifsc: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_default} onChange={(e) => setF({ ...f, is_default: e.target.checked })} /> Default</label>
          <button className={btn.primary + " w-full"}>Add beneficiary</button>
        </form>
      )}
      {canEdit && history.length > 0 && (
        <>
          <h3 className="mt-5 text-sm font-semibold text-primary">Change history</h3>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {history.map((h) => <li key={h.id}>{new Date(h.created_at).toLocaleString("en-IN")} · {h.old_values ? "Updated" : "Created"} {(h.new_values as { bank_name?: string })?.bank_name}</li>)}
          </ul>
        </>
      )}
    </Drawer>
  );
}
