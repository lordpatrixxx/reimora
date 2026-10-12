import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Camera, FileText, RotateCw, Trash2, Upload, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { registerAttachment } from "@/lib/evidence.functions";
import { cn } from "@/lib/utils";
import { errMsg } from "./ui-bits";

export type Attachment = {
  id: string; claim_id: string; expense_id: string; storage_path: string; file_name: string;
  mime_type: string; size_bytes: number; kind: string; rotation: number; sha256: string | null;
};

export function useSignedUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["signed", path],
    enabled: !!path,
    staleTime: 4 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("evidence").createSignedUrl(path!, 300);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

export function EvidencePreview({ att, className, scanning }: { att: Attachment; className?: string; scanning?: boolean }) {
  const { data: url } = useSignedUrl(att.storage_path);
  return (
    <div className={cn("relative grid place-items-center overflow-hidden rounded-xl border border-border bg-muted", className)}>
      {scanning && <div className="scan-line z-10" />}
      {!url ? <div className="h-full w-full animate-pulse bg-muted" /> :
        att.mime_type === "application/pdf" ? (
          <iframe title={att.file_name} src={url} className="h-full w-full" />
        ) : (
          <img src={url} alt={att.file_name} className="max-h-full max-w-full object-contain transition-transform duration-300" style={{ transform: `rotate(${att.rotation}deg)` }} />
        )}
    </div>
  );
}

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const kindLabel: Record<string, string> = { receipt: "Itemized receipt", upi_screenshot: "UPI screenshot", supporting: "Supporting" };

type Pending = { key: string; name: string; state: "uploading" | "failed"; error?: string; file: File; kind: string };

export function Uploader({ claimId, expenseId, attachments, editable, onChange }: {
  claimId: string; expenseId: string; attachments: Attachment[]; editable: boolean; onChange: () => void;
}) {
  const register = useServerFn(registerAttachment);
  const [kind, setKind] = useState<"receipt" | "upi_screenshot" | "supporting">("receipt");
  const [pending, setPending] = useState<Pending[]>([]);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  async function uploadOne(file: File, k: string, key: string) {
    setPending((p) => [...p.filter((x) => x.key !== key), { key, name: file.name, state: "uploading", file, kind: k }]);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("Files must be 10 MB or smaller");
      if (!ACCEPT.split(",").includes(file.type)) throw new Error("Only JPG, PNG, WebP or PDF");
      const safe = file.name.replace(/[^\w.-]+/g, "_").slice(-80);
      const path = `${claimId}/${expenseId}/${crypto.randomUUID()}-${safe}`;
      const { error } = await supabase.storage.from("evidence").upload(path, file, { contentType: file.type });
      if (error) throw error;
      await register({ data: { claimId, expenseId, path, fileName: file.name, kind: k as "receipt" } });
      setPending((p) => p.filter((x) => x.key !== key));
      onChange();
    } catch (e) {
      setPending((p) => p.map((x) => (x.key === key ? { ...x, state: "failed", error: errMsg(e) } : x)));
    }
  }
  function handle(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files)) uploadOne(f, kind, crypto.randomUUID());
  }
  async function remove(a: Attachment) {
    await supabase.storage.from("evidence").remove([a.storage_path]);
    const { error } = await supabase.from("attachments").delete().eq("id", a.id);
    if (error) toast.error(errMsg(error));
    onChange();
  }
  async function rotate(a: Attachment) {
    await supabase.from("attachments").update({ rotation: (a.rotation + 90) % 360 }).eq("id", a.id);
    onChange();
  }

  return (
    <div>
      {editable && (
        <>
          <div className="mb-2 flex flex-wrap gap-1">
            {(["receipt", "upi_screenshot", "supporting"] as const).map((k) => (
              <button type="button" key={k} onClick={() => setKind(k)}
                className={cn("rounded-full px-3 py-1 text-xs font-semibold", kind === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                {kindLabel[k]}
              </button>
            ))}
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files); }}
            className={cn("rounded-xl border-2 border-dashed p-5 text-center transition", drag ? "border-primary bg-accent" : "border-border bg-background")}
          >
            <Upload className="mx-auto h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            <p className="mt-2 text-sm">Drop files here as <b>{kindLabel[kind]}</b></p>
            <p className="text-xs text-muted-foreground">JPG, PNG, WebP or PDF · up to 10 MB · PDFs up to 10 pages</p>
            <div className="mt-3 flex justify-center gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold">Browse files</button>
              <button type="button" onClick={() => camRef.current?.click()} className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold sm:hidden"><Camera className="h-3.5 w-3.5" /> Camera</button>
            </div>
            <input ref={fileRef} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { handle(e.target.files); e.target.value = ""; }} />
            <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { handle(e.target.files); e.target.value = ""; }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">A receipt and its UPI screenshot belong to the <b>same</b> expense — they're counted once.</p>
        </>
      )}
      <ul className="mt-3 space-y-2">
        {pending.map((p) => (
          <li key={p.key} className="rounded-xl border border-border bg-card p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">{p.name}</span>
              {p.state === "failed" && (
                <span className="flex gap-2">
                  <button type="button" onClick={() => uploadOne(p.file, p.kind, p.key)} className="flex items-center gap-1 text-xs font-semibold text-primary"><RefreshCw className="h-3 w-3" /> Retry</button>
                  <button type="button" onClick={() => setPending((x) => x.filter((y) => y.key !== p.key))} className="text-xs text-muted-foreground">Dismiss</button>
                </span>
              )}
            </div>
            {p.state === "uploading" ? (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full w-1/3 animate-[scan_1.2s_ease-in-out_infinite] rounded-full bg-primary" style={{ position: "relative", animationName: "none", width: "60%", transition: "width 2s" }} /></div>
            ) : <p className="mt-1 text-xs text-destructive">{p.error}</p>}
          </li>
        ))}
        {attachments.map((a) => (
          <li key={a.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-2">
            <Thumb att={a} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{a.file_name}</p>
              <p className="text-xs text-muted-foreground">{kindLabel[a.kind]} · {(a.size_bytes / 1024).toFixed(0)} KB</p>
            </div>
            {editable && (
              <>
                {a.mime_type !== "application/pdf" && <button type="button" aria-label="Rotate" onClick={() => rotate(a)} className="rounded-lg p-2 hover:bg-muted"><RotateCw className="h-4 w-4" strokeWidth={1.75} /></button>}
                <button type="button" aria-label="Remove" onClick={() => remove(a)} className="rounded-lg p-2 text-destructive hover:bg-destructive-soft"><Trash2 className="h-4 w-4" strokeWidth={1.75} /></button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Thumb({ att }: { att: Attachment }) {
  const { data: url } = useSignedUrl(att.mime_type === "application/pdf" ? null : att.storage_path);
  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
      {att.mime_type === "application/pdf" ? <FileText className="h-5 w-5 text-muted-foreground" /> :
        url ? <img src={url} alt="" className="h-full w-full object-cover" style={{ transform: `rotate(${att.rotation}deg)` }} /> : null}
    </div>
  );
}
