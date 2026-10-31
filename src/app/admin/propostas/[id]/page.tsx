import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, StatusPill, buttonClass, formatDate, ghostButtonClass, inputClass } from "@/components/ui";
import { formatEUR, monthlyFee } from "@/lib/pricing";
import {
  SECTION_LABEL,
  SECTION_ORDER,
  STATUS_LABEL,
  STATUS_TONE,
  dailyInvestment,
  loadLibrary,
  loadProposal,
  platformsInProposal,
} from "@/lib/proposals";
import {
  addBlockAction,
  deleteProposalAction,
  saveFinancialsAction,
  sendProposalAction,
  unsendProposalAction,
  updateProposalMetaAction,
} from "../actions";
import { BlockList, type ListItem } from "./BlockList";

export default async function ProposalBuilder({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  const me = await requireStaff();
  const { id } = await params;
  const { msg } = await searchParams;
  const supabase = await createClient();

  const data = await loadProposal(supabase, id);
  if (!data) notFound();
  const { proposal: p, items, financials, client } = data;
  const library = await loadLibrary(supabase);

  const isAdmin = me.role === "admin";
  const draft = p.status === "rascunho";
  const inProposal = new Set(items.map((i) => i.block.id));
  const available = library.filter((b) => b.active && !inProposal.has(b.id));
  const hasFeeBlock = items.some((i) => i.block.slug === "fee-mensal");
  const daily = dailyInvestment(items);
  const detectedPlatforms = platformsInProposal(items);
  const calcFee = financials ? monthlyFee(financials.platforms, financials.technical_campaigns) : null;

  const listItems: ListItem[] = items.map((i) => ({
    id: i.id,
    title: i.snapshot?.title ?? i.block.title,
    sectionLabel: SECTION_LABEL[i.block.section],
    adminOnly: i.block.admin_only,
    calculated: i.block.kind === "calculado",
    // blocos com conteúdo gerado (tabela de tiers, prazos do contrato) não precisam de texto
    hasBody: Boolean((i.snapshot?.body ?? i.block.body).trim()) || ["tabela-tiers", "duracao-pagamentos"].includes(i.block.slug),
    fields: i.block.fields,
    values: i.values,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="bv-eyebrow">
            <Link href={`/admin/clientes/${client.id}`} className="hover:text-navy">
              {client.name}
            </Link>{" "}
            · Proposta
          </p>
          <h1 className="mt-1 text-[26px] leading-tight font-semibold">{p.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-500">
            <StatusPill tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</StatusPill>
            {p.sent_at && <span>Enviada a {formatDate(p.sent_at)}</span>}
            {p.accepted_at && <span>Aceite a {formatDate(p.accepted_at)}</span>}
            {p.valid_until && p.status !== "aceite" && <span>Válida até {formatDate(p.valid_until)}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/propostas/${p.id}/pre-visualizar`} className={ghostButtonClass}>
            Pré-visualizar como o cliente
          </Link>
          {p.status === "enviada" && (
            <form action={unsendProposalAction}>
              <input type="hidden" name="proposal_id" value={p.id} />
              <button className={ghostButtonClass}>Voltar a rascunho</button>
            </form>
          )}
          {draft && (
            <form action={sendProposalAction}>
              <input type="hidden" name="proposal_id" value={p.id} />
              <button className="rounded-md bg-yellow px-4 py-2 text-[14px] font-bold text-navy hover:bg-yellow-600">
                Enviar ao cliente
              </button>
            </form>
          )}
        </div>
      </div>

      {msg && (
        <p role="status" className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm">
          {msg}
        </p>
      )}

      {!draft && (
        <p className="rounded-md border-l-4 border-yellow bg-white px-4 py-3 text-sm">
          {p.status === "aceite"
            ? "Proposta aceite pelo cliente. Já não pode ser alterada; os pedidos ao cliente foram criados."
            : "Proposta enviada: está bloqueada e o cliente vê esta versão. Para alterar, volte a rascunho."}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card
          title={`Blocos (${items.length})`}
          action={draft ? <span className="text-[13px] text-slate-500">Arraste para reordenar</span> : undefined}
        >
          <BlockList proposalId={p.id} items={listItems} editable={draft} />
          {!isAdmin && (
            <p className="mt-4 text-[13px] text-slate-500">
              A proposta financeira e as condições gerais são geridas pelo Admin e não aparecem nesta lista.
            </p>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Resumo">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-[14px]">
              <div>
                <dt className="text-slate-500">Investimento em media</dt>
                <dd className="mt-0.5 font-display text-[18px] font-semibold tabular-nums">
                  {daily > 0 ? `${formatEUR(daily)}/dia` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Plataformas nos blocos</dt>
                <dd className="mt-0.5 font-display text-[18px] font-semibold tabular-nums">{detectedPlatforms || "—"}</dd>
              </div>
              {isAdmin && (
                <div className="col-span-2">
                  <dt className="text-slate-500">Fee mensal</dt>
                  <dd className="mt-0.5 font-display text-[18px] font-semibold tabular-nums">
                    {financials
                      ? formatEUR(Number(financials.fee_override ?? financials.monthly_fee ?? calcFee ?? 0))
                      : hasFeeBlock
                        ? "Por definir"
                        : "Sem bloco de fee"}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          {isAdmin && (
            <Card title="Proposta financeira">
              <form action={saveFinancialsAction} className="space-y-3">
                <input type="hidden" name="proposal_id" value={p.id} />
                <fieldset disabled={!draft} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="text-[13px] font-bold text-slate-700">Plataformas</span>
                      <input
                        name="platforms"
                        type="number"
                        min={1}
                        max={10}
                        required
                        defaultValue={financials?.platforms ?? Math.max(detectedPlatforms, 1)}
                        className={inputClass}
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[13px] font-bold text-slate-700">Campanhas técnicas</span>
                      <input
                        name="technical_campaigns"
                        type="number"
                        min={1}
                        max={50}
                        required
                        defaultValue={financials?.technical_campaigns ?? Math.max(detectedPlatforms, 1)}
                        className={inputClass}
                      />
                    </label>
                  </div>
                  <p className="text-[13px] text-slate-600">
                    Pela tabela:{" "}
                    <strong>
                      {financials
                        ? calcFee != null
                          ? `${formatEUR(calcFee)}/mês`
                          : "sob consulta (10+ campanhas): use o valor manual"
                        : "guarde para calcular"}
                    </strong>
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="text-[13px] font-bold text-slate-700">Fee manual (opcional)</span>
                      <input
                        name="fee_override"
                        inputMode="decimal"
                        defaultValue={financials?.fee_override ?? ""}
                        placeholder="Substitui a tabela"
                        className={inputClass}
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[13px] font-bold text-slate-700">Setup (opcional)</span>
                      <input
                        name="setup_fee"
                        inputMode="decimal"
                        defaultValue={financials?.setup_fee ?? ""}
                        placeholder="Valor único"
                        className={inputClass}
                      />
                    </label>
                  </div>
                  <label className="block space-y-1">
                    <span className="text-[13px] font-bold text-slate-700">Nota visível ao cliente (opcional)</span>
                    <textarea name="notes" rows={2} defaultValue={financials?.notes ?? ""} className={inputClass} />
                  </label>
                </fieldset>
                {draft && <button className={buttonClass}>Guardar financeira</button>}
              </form>
            </Card>
          )}

          {draft && (
            <Card title="Adicionar blocos">
              {available.length === 0 ? (
                <p className="text-sm text-slate-500">Todos os blocos da biblioteca já estão na proposta.</p>
              ) : (
                <div className="space-y-4">
                  {SECTION_ORDER.map((section) => {
                    const blocks = available.filter((b) => b.section === section);
                    if (blocks.length === 0) return null;
                    return (
                      <div key={section}>
                        <p className="bv-eyebrow mb-1.5">{SECTION_LABEL[section]}</p>
                        <ul className="space-y-1">
                          {blocks.map((b) => (
                            <li key={b.id}>
                              <form action={addBlockAction} className="flex items-center gap-3">
                                <input type="hidden" name="proposal_id" value={p.id} />
                                <input type="hidden" name="block_id" value={b.id} />
                                <span className="min-w-0 flex-1 truncate text-[14px]">{b.title}</span>
                                <button className={ghostButtonClass}>Adicionar</button>
                              </form>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="mt-4 text-[13px] text-slate-500">
                O bloco entra na sua secção. Textos-base em{" "}
                <Link href="/admin/blocos" className="font-bold underline-offset-2 hover:underline">
                  Biblioteca de blocos
                </Link>
                .
              </p>
            </Card>
          )}

          {draft && (
            <Card title="Título e validade">
              <form action={updateProposalMetaAction} className="space-y-3">
                <input type="hidden" name="proposal_id" value={p.id} />
                <input name="title" defaultValue={p.title} required className={inputClass} aria-label="Título" />
                <label className="block space-y-1">
                  <span className="block text-[13px] font-bold text-slate-700">Válida até</span>
                  <input
                    name="valid_until"
                    type="date"
                    required
                    defaultValue={p.valid_until ?? ""}
                    className={`${inputClass} max-w-[200px]`}
                  />
                </label>
                <button className={buttonClass}>Guardar</button>
              </form>
              <form action={deleteProposalAction} className="mt-4 border-t border-slate-100 pt-4">
                <input type="hidden" name="proposal_id" value={p.id} />
                <input type="hidden" name="client_id" value={client.id} />
                <button className="text-[13px] text-slate-500 hover:text-negative">Apagar este rascunho</button>
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
