import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { monthlyFee } from "@/lib/pricing";

export type ProposalStatus = "rascunho" | "enviada" | "aceite" | "recusada";
export type BlockSection = "abertura" | "sobre" | "estrategia" | "financeira" | "condicoes" | "fecho";
export type BlockKind = "fixo" | "variavel" | "calculado";

export interface BlockField {
  key: string;
  label: string;
  type?: "number" | "boolean" | "text";
  default?: string | number | boolean;
}

export interface Block {
  id: string;
  slug: string;
  title: string;
  section: BlockSection;
  kind: BlockKind;
  admin_only: boolean;
  sort_order: number;
  fields: BlockField[];
  generates: {
    platform?: string;
    tarefas?: string[];
    pedidos?: { kind: string; title: string }[];
    questionario?: string[];
    contrato?: unknown;
    calc?: string;
  };
  body: string;
  active: boolean;
}

export type FieldValue = string | number | boolean | null;

export interface ProposalItem {
  id: string;
  position: number;
  values: Record<string, FieldValue>;
  snapshot: { title: string; body: string } | null;
  block: Block;
}

export interface Proposal {
  id: string;
  client_id: string;
  title: string;
  status: ProposalStatus;
  valid_until: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  created_at: string;
}

export interface Financials {
  proposal_id: string;
  platforms: number;
  technical_campaigns: number;
  monthly_fee: number | null;
  fee_override: number | null;
  setup_fee: number | null;
  notes: string | null;
}

export const STATUS_LABEL: Record<ProposalStatus, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada ao cliente",
  aceite: "Aceite",
  recusada: "Recusada",
};

export const STATUS_TONE: Record<ProposalStatus, "neutral" | "wait" | "ok"> = {
  rascunho: "neutral",
  enviada: "wait",
  aceite: "ok",
  recusada: "neutral",
};

export const SECTION_LABEL: Record<BlockSection, string> = {
  abertura: "Abertura",
  sobre: "Sobre nós",
  estrategia: "Estratégia",
  financeira: "Proposta financeira",
  condicoes: "Condições gerais",
  fecho: "Fecho",
};

export const SECTION_ORDER: BlockSection[] = ["abertura", "sobre", "estrategia", "financeira", "condicoes", "fecho"];

const BLOCK_COLUMNS = "id, slug, title, section, kind, admin_only, sort_order, fields, generates, body, active";

/** Proposta + blocos (já filtrados pela RLS para quem pede) + financeira, se visível. */
export async function loadProposal(supabase: SupabaseClient, id: string) {
  const { data: proposal } = await supabase
    .from("proposals")
    .select("id, client_id, title, status, valid_until, sent_at, accepted_at, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!proposal) return null;

  const [{ data: items }, { data: financials }, { data: client }] = await Promise.all([
    supabase
      .from("proposal_blocks")
      .select(`id, position, values, snapshot, block:blocks(${BLOCK_COLUMNS})`)
      .eq("proposal_id", id)
      .order("position"),
    supabase.from("proposal_financials").select("*").eq("proposal_id", id).maybeSingle(),
    supabase.from("clients").select("id, name").eq("id", proposal.client_id).single(),
  ]);

  return {
    proposal: proposal as Proposal,
    // um bloco sem leitura (RLS) chega sem "block": fica de fora
    items: ((items ?? []) as unknown as ProposalItem[]).filter((i) => i.block),
    financials: (financials as Financials | null) ?? null,
    client: client as { id: string; name: string },
  };
}

export async function loadLibrary(supabase: SupabaseClient) {
  const { data } = await supabase.from("blocks").select(BLOCK_COLUMNS).order("sort_order");
  return (data ?? []) as Block[];
}

/** Valores por omissão de um bloco novo numa proposta. */
export function defaultValues(block: Block, clientName: string): Record<string, FieldValue> {
  const mesAno = new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" }).format(new Date());
  const out: Record<string, FieldValue> = {};
  for (const f of block.fields) {
    if (f.key === "cliente") out[f.key] = clientName;
    else if (f.key === "mes_ano") out[f.key] = mesAno.charAt(0).toUpperCase() + mesAno.slice(1);
    else if (f.default !== undefined) out[f.key] = f.default;
  }
  return out;
}

/** Título e texto a mostrar: a fotografia do envio, ou a biblioteca enquanto é rascunho. */
export function itemContent(item: ProposalItem) {
  return {
    title: item.snapshot?.title ?? item.block.title,
    body: fillPlaceholders(item.snapshot?.body ?? item.block.body, item.values),
  };
}

export function fillPlaceholders(text: string, values: Record<string, FieldValue>) {
  return text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key: string) => {
    const v = values[key];
    return v === null || v === undefined || v === "" ? "" : String(v);
  });
}

/** Investimento diário total dos blocos de plataforma da proposta. */
export function dailyInvestment(items: ProposalItem[]) {
  return items.reduce((sum, i) => {
    const v = Number(i.values.invest_dia);
    return Number.isFinite(v) && v > 0 ? sum + v : sum;
  }, 0);
}

/** Plataformas distintas nos blocos da proposta (sugestão para a financeira). */
export function platformsInProposal(items: ProposalItem[]) {
  return new Set(items.map((i) => i.block.generates?.platform).filter(Boolean)).size;
}

export function effectiveFee(f: Financials | null): number | null {
  if (!f) return null;
  if (f.fee_override != null) return Number(f.fee_override);
  if (f.monthly_fee != null) return Number(f.monthly_fee);
  return monthlyFee(f.platforms, f.technical_campaigns);
}
