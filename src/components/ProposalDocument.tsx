import { EXTRA_PLATFORM_FEE, TIER_ONE_PLATFORM, formatEUR } from "@/lib/pricing";
import {
  SECTION_LABEL,
  dailyInvestment,
  effectiveFee,
  itemContent,
  type FieldValue,
  type Financials,
  type ProposalItem,
} from "@/lib/proposals";

const HIDDEN_FIELDS = new Set(["cliente", "mes_ano", "validade_dias", "dias"]);

const longDate = (d: string) =>
  new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long", year: "numeric" }).format(new Date(d));

function formatValue(key: string, v: FieldValue) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (key === "invest_dia") return `${formatEUR(Number(v))} por dia`;
  return String(v);
}

function Paragraphs({ text }: { text: string }) {
  const parts = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className="space-y-3 text-[16px] leading-relaxed text-slate-800">
      {parts.map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p}
        </p>
      ))}
    </div>
  );
}

/**
 * A proposta tal como o cliente a lê. Recebe só o que a RLS deixou passar:
 * o cliente-leitor não recebe os blocos "só admin" nem a financeira.
 */
export function ProposalDocument({
  title,
  clientName,
  items,
  financials,
  validUntil,
  staffPreview = false,
}: {
  title: string;
  clientName: string;
  items: ProposalItem[];
  financials: Financials | null;
  validUntil: string | null;
  staffPreview?: boolean;
}) {
  const daily = dailyInvestment(items);
  let lastSection: string | null = null;

  return (
    <article className="overflow-hidden rounded-lg border border-slate-100 bg-white">
      {items.map((item) => {
        const { title: blockTitle, body } = itemContent(item);
        const b = item.block;
        const showSection = b.section !== lastSection && b.section !== "abertura" && !b.slug.startsWith("divisor");
        lastSection = b.section;

        // ---------- Capa ----------
        if (b.slug === "capa") {
          const mesAno = item.values.mes_ano ? String(item.values.mes_ano) : null;
          return (
            <header key={item.id} className="bg-navy px-6 py-14 text-white sm:px-12 sm:py-20">
              <p className="bv-wordmark text-[15px] text-yellow">Bizzi Vision</p>
              <h1 className="mt-10 max-w-2xl text-[30px] leading-[1.15] font-semibold sm:text-[40px]">{title}</h1>
              <p className="mt-4 text-[17px] text-slate-100">
                {String(item.values.cliente || clientName)}
                {mesAno && ` · ${mesAno}`}
              </p>
              {validUntil && (
                <p className="mt-10 text-[13px] tracking-[0.06em] text-slate-200 uppercase">
                  Válida até {longDate(validUntil)}
                </p>
              )}
            </header>
          );
        }

        // ---------- Divisores ----------
        if (b.slug.startsWith("divisor")) {
          return (
            <div key={item.id} className="border-t border-slate-100 bg-slate-50 px-6 py-8 sm:px-12">
              <p className="bv-eyebrow">{SECTION_LABEL[b.section]}</p>
              <h2 className="mt-1 text-[24px] font-semibold">{fillDivider(blockTitle, item.values)}</h2>
            </div>
          );
        }

        const fieldRows = b.fields
          .filter((f) => !HIDDEN_FIELDS.has(f.key) && !(b.body.includes(`{{${f.key}}}`)))
          .map((f) => ({ label: f.label, value: formatValue(f.key, item.values[f.key] ?? null) }))
          .filter((r) => r.value !== null);

        return (
          <section key={item.id} className="border-t border-slate-100 px-6 py-9 sm:px-12">
            {showSection && <p className="bv-eyebrow mb-1">{SECTION_LABEL[b.section]}</p>}
            <h2 className="text-[21px] leading-snug font-semibold">{blockTitle}</h2>

            <div className="mt-4 space-y-5">
              {body ? (
                <Paragraphs text={body} />
              ) : (
                staffPreview &&
                b.kind !== "calculado" &&
                fieldRows.length === 0 && (
                  <p className="rounded-md border border-dashed border-slate-200 px-4 py-3 text-[14px] text-slate-500">
                    Texto deste bloco por preencher na Biblioteca de blocos. O cliente vê só o título.
                  </p>
                )
              )}

              {fieldRows.length > 0 && (
                <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  {fieldRows.map((r) => (
                    <div key={r.label}>
                      <dt className="text-[13px] font-bold text-slate-500">{r.label}</dt>
                      <dd className="mt-0.5 whitespace-pre-line">{r.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {b.slug === "investimento-60-dias" && <Investment items={items} daily={daily} days={Number(item.values.dias) || 60} />}
              {b.slug === "fee-mensal" && <Fee financials={financials} />}
              {b.slug === "tabela-tiers" && <Tiers />}
              {b.slug === "duracao-pagamentos" && <Terms terms={b.generates.contrato} />}
            </div>
          </section>
        );
      })}
    </article>
  );
}

/** "Divisor · Estratégia" → "Estratégia", com o nome do cliente se o bloco o tiver. */
function fillDivider(text: string, values: Record<string, FieldValue>) {
  const name = text.replace(/^Divisor · /, "");
  return values.cliente ? `${name} · ${values.cliente}` : name;
}

function Investment({ items, daily, days }: { items: ProposalItem[]; daily: number; days: number }) {
  const rows = items.filter((i) => Number(i.values.invest_dia) > 0);
  if (rows.length === 0) {
    return <p className="text-[14px] text-slate-500">Sem investimento diário definido nos canais desta proposta.</p>;
  }
  return (
    <div className="rounded-md bg-slate-50 px-5 py-4">
      <table className="w-full text-[15px]">
        <tbody>
          {rows.map((i) => (
            <tr key={i.id} className="border-b border-slate-100 last:border-0">
              <td className="py-2">{itemContent(i).title}</td>
              <td className="py-2 text-right tabular-nums">{formatEUR(Number(i.values.invest_dia))}/dia</td>
              <td className="py-2 text-right tabular-nums">{formatEUR(Number(i.values.invest_dia) * days)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="pt-3 font-bold">Total em {days} dias</td>
            <td className="pt-3 text-right tabular-nums">{formatEUR(daily)}/dia</td>
            <td className="pt-3 text-right font-display text-[18px] font-semibold tabular-nums">{formatEUR(daily * days)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function Fee({ financials }: { financials: Financials | null }) {
  const fee = effectiveFee(financials);
  if (fee == null || !financials) {
    return <p className="text-[14px] text-slate-500">Valor sob consulta.</p>;
  }
  return (
    <div className="rounded-md border-l-4 border-yellow bg-yellow-50 px-5 py-4">
      <p className="font-display text-[30px] font-semibold tabular-nums">
        {formatEUR(fee)}
        <span className="ml-1 font-body text-[15px] font-normal text-slate-700">/mês + IVA</span>
      </p>
      <p className="mt-1 text-[14px] text-slate-700">
        {financials.platforms} {financials.platforms === 1 ? "plataforma" : "plataformas"} ·{" "}
        {financials.technical_campaigns}{" "}
        {financials.technical_campaigns === 1 ? "campanha técnica" : "campanhas técnicas"}
      </p>
      {financials.setup_fee != null && Number(financials.setup_fee) > 0 && (
        <p className="mt-2 text-[15px]">
          Setup inicial: <strong>{formatEUR(Number(financials.setup_fee))}</strong> + IVA, faturado uma vez
        </p>
      )}
      {financials.notes && <p className="mt-2 text-[14px] whitespace-pre-line text-slate-700">{financials.notes}</p>}
    </div>
  );
}

function Tiers() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[320px] text-[15px]">
        <thead className="text-[12px] tracking-[0.06em] text-slate-500 uppercase">
          <tr className="border-b border-slate-100">
            <th className="py-2 text-left font-bold">Campanhas técnicas</th>
            <th className="py-2 text-right font-bold">1 plataforma</th>
            <th className="py-2 text-right font-bold">2 plataformas</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(TIER_ONE_PLATFORM).map(([n, v]) => (
            <tr key={n} className="border-b border-slate-50">
              <td className="py-1.5">{n}</td>
              <td className="py-1.5 text-right tabular-nums">{formatEUR(v)}</td>
              <td className="py-1.5 text-right tabular-nums text-slate-600">
                {Number(n) >= 2 ? formatEUR(v + EXTRA_PLATFORM_FEE) : "—"}
              </td>
            </tr>
          ))}
          <tr>
            <td className="py-1.5">10 ou mais</td>
            <td className="py-1.5 text-right text-slate-600" colSpan={2}>
              Sob consulta
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Terms({ terms }: { terms: unknown }) {
  if (!terms || typeof terms !== "object") return null;
  const t = terms as Record<string, number>;
  const rows = [
    t.duracao_meses && ["Duração do contrato", `${t.duracao_meses} meses`],
    t.adaptacao_meses && ["Período de adaptação", `${t.adaptacao_meses} meses`],
    t.aviso_dias && ["Aviso prévio de rescisão", `${t.aviso_dias} dias`],
    t.fatura_dia && ["Faturação", `Dia ${t.fatura_dia} de cada mês`],
    t.prazo_pagamento_dias_uteis && ["Prazo de pagamento", `${t.prazo_pagamento_dias_uteis} dias úteis`],
  ].filter(Boolean) as [string, string][];
  return (
    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-[13px] font-bold text-slate-500">{k}</dt>
          <dd className="mt-0.5">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
