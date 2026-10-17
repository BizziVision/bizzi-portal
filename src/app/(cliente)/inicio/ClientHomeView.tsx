import Link from "next/link";
import { Card, Empty, PhaseBar, StatusPill, formatDate, ghostButtonClass } from "@/components/ui";
import { formatEUR } from "@/lib/pricing";
import { REQUEST_KIND_LABEL, type Client, type ClientRequest } from "@/lib/types";
import { markRequestSentAction } from "../actions";

const nf = new Intl.NumberFormat("pt-PT");

export interface Kpis {
  spend: number | null;
  leads: number | null;
  cpl: number | null;
  impressions: number | null;
  updated_at: string;
}

export function ClientHomeView({
  client,
  firstName,
  canAct,
  requests,
  kpis,
  tasks,
  report,
  proposalTitle,
}: {
  client: Client;
  firstName?: string;
  canAct: boolean;
  requests: ClientRequest[];
  kpis: Kpis | null;
  tasks: { id: string; name: string; status: string }[];
  report: { month: string; summary: string | null } | null;
  proposalTitle: string | null;
}) {
  const pending = requests.filter((r) => r.status === "pendente");

  const kpiTiles = kpis
    ? [
        { label: "Investimento", value: kpis.spend != null ? formatEUR(Number(kpis.spend)) : "—" },
        { label: "Leads", value: kpis.leads != null ? nf.format(kpis.leads) : "—" },
        { label: "Custo por lead", value: kpis.cpl != null ? formatEUR(Number(kpis.cpl)) : "—" },
        { label: "Impressões", value: kpis.impressions != null ? nf.format(kpis.impressions) : "—" },
      ]
    : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="bv-eyebrow">{firstName ? `Olá, ${firstName}` : "Bem-vindo"}</p>
        <h1 className="mt-1 text-[26px] font-semibold leading-tight">{client.name}</h1>
      </div>

      <PhaseBar phase={client.phase} />

      {proposalTitle && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-l-4 border-yellow bg-white px-5 py-4">
          <p>
            <strong>Tem uma proposta para rever:</strong> {proposalTitle}
          </p>
          <span className="text-sm text-slate-500">Disponível em breve no portal</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card
          title="O que precisamos de si"
          action={pending.length > 0 ? <StatusPill tone="wait">{pending.length} em falta</StatusPill> : undefined}
        >
          {requests.length === 0 ? (
            <Empty>Nada pendente da sua parte. Obrigado.</Empty>
          ) : (
            <ul className="divide-y divide-slate-50">
              {requests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{r.title}</p>
                    {r.description && <p className="mt-0.5 text-[14px] text-slate-700">{r.description}</p>}
                    <p className="mt-0.5 text-[13px] text-slate-500">
                      {REQUEST_KIND_LABEL[r.kind]}
                      {r.due_date && ` · até ${formatDate(r.due_date)}`}
                    </p>
                  </div>
                  {r.status === "enviado" ? (
                    <StatusPill tone="neutral">Enviado, a confirmar</StatusPill>
                  ) : canAct ? (
                    <form action={markRequestSentAction}>
                      <input type="hidden" name="request_id" value={r.id} />
                      <button className={ghostButtonClass}>Marcar como feito</button>
                    </form>
                  ) : (
                    <StatusPill tone="wait">Em falta</StatusPill>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Resultados deste mês"
          action={
            <Link href="/resultados" className="text-[13px] font-bold text-slate-600 hover:text-navy">
              Ver dashboard
            </Link>
          }
        >
          {kpiTiles && kpis ? (
            <>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
                {kpiTiles.map((k) => (
                  <div key={k.label}>
                    <dt className="text-[13px] text-slate-500">{k.label}</dt>
                    <dd className="mt-0.5 font-display text-[22px] font-semibold tabular-nums">{k.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-5 text-[12px] text-slate-500">
                Atualizado a {formatDate(kpis.updated_at)} · dados atualizados todos os dias às 7h
              </p>
            </>
          ) : (
            <Empty>Os resultados aparecem aqui quando as campanhas estiverem ativas.</Empty>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Em curso">
          {tasks.length === 0 ? (
            <Empty>Sem tarefas em curso para mostrar.</Empty>
          ) : (
            <ul className="divide-y divide-slate-50">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-4 py-2.5">
                  <span className="min-w-0 flex-1 truncate">{t.name}</span>
                  <span className="text-[13px] text-slate-500">{t.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Último report">
          {report ? (
            <>
              <p className="text-[13px] text-slate-500">
                {new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" }).format(new Date(report.month))}
              </p>
              <p className="mt-2 text-slate-700">{report.summary}</p>
            </>
          ) : (
            <Empty>O primeiro report mensal aparece aqui no início do próximo mês.</Empty>
          )}
        </Card>
      </div>
    </div>
  );
}
