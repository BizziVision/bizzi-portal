import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, Empty, StatusPill, formatDate } from "@/components/ui";
import { PHASE_LABEL, type Client } from "@/lib/types";

export default async function AdminHome() {
  const me = await requireStaff();
  const supabase = await createClient();

  const [{ data: clients }, { data: pending }, { data: alerts }] = await Promise.all([
    supabase.from("clients").select("*").order("name"),
    supabase.from("client_requests").select("client_id").eq("status", "pendente"),
    me.role === "admin"
      ? supabase.from("retention_alerts").select("*")
      : Promise.resolve({ data: [] as { client_id: string; name: string; review_on: string }[] }),
  ]);

  const pendingByClient = new Map<string, number>();
  pending?.forEach((r) => pendingByClient.set(r.client_id, (pendingByClient.get(r.client_id) ?? 0) + 1));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="bv-eyebrow">Backoffice</p>
          <h1 className="mt-1 text-[26px] font-semibold">Clientes</h1>
        </div>
        {me.role === "admin" && (
          <Link
            href="/admin/clientes/novo"
            className="rounded-md bg-navy px-4 py-2 text-[14px] font-bold text-white hover:bg-navy-500"
          >
            Novo cliente
          </Link>
        )}
      </div>

      {alerts && alerts.length > 0 && (
        <Card title="Retenção de dados: rever">
          <p className="mb-3 text-sm text-slate-700">
            Passaram 6 meses desde o offboarding destes clientes. Reveja o que apagar; nada é apagado
            automaticamente.
          </p>
          <ul className="space-y-1.5 text-sm">
            {alerts.map((a) => (
              <li key={a.client_id}>
                <Link className="font-bold underline-offset-2 hover:underline" href={`/admin/clientes/${a.client_id}`}>
                  {a.name}
                </Link>{" "}
                <span className="text-slate-500">· desde {formatDate(a.review_on)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        {!clients || clients.length === 0 ? (
          <Empty>Ainda não há clientes.</Empty>
        ) : (
          <div className="-mx-5 overflow-x-auto sm:-mx-6">
            <table className="w-full min-w-[520px] text-left text-[14px]">
              <thead className="text-[12px] tracking-[0.06em] text-slate-500 uppercase">
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-2 font-bold sm:px-6">Cliente</th>
                  <th className="px-3 py-2 font-bold">Fase</th>
                  <th className="px-3 py-2 font-bold">Pendentes do cliente</th>
                  <th className="px-5 py-2 font-bold sm:px-6">Desde</th>
                </tr>
              </thead>
              <tbody>
                {(clients as Client[]).map((c) => {
                  const n = pendingByClient.get(c.id) ?? 0;
                  return (
                    <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="px-5 py-3 sm:px-6">
                        <Link href={`/admin/clientes/${c.id}`} className="font-bold hover:underline">
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-3 py-3">{PHASE_LABEL[c.phase]}</td>
                      <td className="px-3 py-3">
                        {n > 0 ? <StatusPill tone="wait">{n} em falta</StatusPill> : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-5 py-3 text-slate-500 sm:px-6">{formatDate(c.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
