import type { ClientPhase } from "@/lib/types";
import { CLIENT_PHASES } from "@/lib/types";

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-slate-100 bg-white p-5 sm:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-baseline justify-between gap-4">
          {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>;
}

export function PhaseBar({ phase }: { phase: ClientPhase }) {
  const current = CLIENT_PHASES.findIndex((p) => p.key === phase);
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Fases do projeto">
      {CLIENT_PHASES.map((p, i) => {
        const done = current > i || phase === "offboarding" || phase === "arquivado";
        const active = current === i;
        return (
          <li
            key={p.key}
            aria-current={active ? "step" : undefined}
            className={`rounded-md border px-3.5 py-3 ${
              active
                ? "border-navy bg-navy text-white"
                : done
                  ? "border-slate-200 bg-slate-50 text-slate-700"
                  : "border-slate-100 bg-white text-slate-400"
            }`}
          >
            <span className="block text-[11px] font-bold tracking-[0.08em] uppercase opacity-80">
              {done ? "Concluído" : active ? "Agora" : `Fase ${i + 1}`}
            </span>
            <span className="mt-0.5 block font-bold">{p.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function StatusPill({
  tone,
  children,
}: {
  tone: "neutral" | "wait" | "ok";
  children: React.ReactNode;
}) {
  const styles = {
    neutral: "bg-slate-50 text-slate-700",
    wait: "bg-yellow-50 text-navy",
    ok: "bg-[#e8f4ee] text-positive",
  }[tone];
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[12px] font-bold ${styles}`}>
      {children}
    </span>
  );
}

export const inputClass =
  "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[14px] text-navy placeholder:text-slate-400 focus:border-slate-500 focus:outline-none";
export const buttonClass =
  "rounded-md bg-navy px-4 py-2 text-[14px] font-bold text-white hover:bg-navy-500 disabled:opacity-60";
export const ghostButtonClass =
  "rounded-md border border-slate-200 px-3 py-1.5 text-[13px] text-slate-700 hover:border-slate-400 hover:text-navy";

export const formatDate = (d: string | null) =>
  d ? new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "short" }).format(new Date(d)) : "";
