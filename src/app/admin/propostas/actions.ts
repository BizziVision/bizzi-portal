"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { monthlyFee } from "@/lib/pricing";
import { defaultValues, loadLibrary, type Block, type FieldValue } from "@/lib/proposals";
import { createClient } from "@/lib/supabase/server";

const builderUrl = (id: string, msg?: string) =>
  `/admin/propostas/${id}${msg ? `?msg=${encodeURIComponent(msg)}` : ""}`;
const back = (id: string, msg: string): never => redirect(builderUrl(id, msg));

/** Mensagem legível de um erro da base de dados (as funções levantam texto em português). */
const dbMessage = (e: { message?: string } | null, fallback: string) =>
  e?.message && !/violates|permission denied|syntax/i.test(e.message) ? e.message : fallback;

// ---------- Criar ----------

const createSchema = z.object({
  client_id: z.uuid(),
  title: z.string().trim().min(3, "Dê um título à proposta"),
});

export async function createProposalAction(formData: FormData) {
  await requireStaff();
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  const clientId = String(formData.get("client_id") ?? "");
  if (!parsed.success) redirect(`/admin/clientes/${clientId}?msg=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const { client_id, title } = parsed.data!;

  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("name").eq("id", client_id).single();
  if (!client) redirect("/admin");

  const validUntil = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  const { data: proposal, error } = await supabase
    .from("proposals")
    .insert({ client_id, title, valid_until: validUntil })
    .select("id")
    .single();
  if (error || !proposal) redirect(`/admin/clientes/${client_id}?msg=${encodeURIComponent("Não foi possível criar a proposta.")}`);

  // Começa com toda a biblioteca ativa que quem cria pode ver, pela ordem-base.
  const library = (await loadLibrary(supabase)).filter((b) => b.active);
  if (library.length > 0) {
    await supabase.from("proposal_blocks").insert(
      library.map((b, i) => ({
        proposal_id: proposal!.id,
        block_id: b.id,
        position: i + 1,
        values: defaultValues(b, client!.name),
      })),
    );
  }
  redirect(builderUrl(proposal!.id, "Proposta criada com todos os blocos. Retire o que não se aplica."));
}

// ---------- Título e validade ----------

const metaSchema = z.object({
  proposal_id: z.uuid(),
  title: z.string().trim().min(3, "Título demasiado curto"),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de validade inválida"),
});

export async function updateProposalMetaAction(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("proposal_id") ?? "");
  const parsed = metaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(id, parsed.error.issues[0].message);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proposals")
    .update({ title: parsed.data!.title, valid_until: parsed.data!.valid_until })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) back(id, "Não foi possível guardar. A proposta já foi enviada?");
  revalidatePath(builderUrl(id));
  back(id, "Guardado.");
}

// ---------- Blocos ----------

export async function addBlockAction(formData: FormData) {
  await requireStaff();
  const id = z.uuid().parse(formData.get("proposal_id"));
  const blockId = z.uuid().parse(formData.get("block_id"));
  const supabase = await createClient();

  const [{ data: block }, { data: proposal }] = await Promise.all([
    supabase.from("blocks").select("*").eq("id", blockId).single(),
    supabase.from("proposals").select("client_id, clients(name)").eq("id", id).single(),
  ]);
  if (!block || !proposal) back(id, "Bloco indisponível.");
  const clientName = (proposal as unknown as { clients: { name: string } }).clients?.name ?? "";

  const { error } = await supabase.rpc("add_proposal_block", {
    p_id: id,
    b_id: blockId,
    v: defaultValues(block as Block, clientName),
  });
  if (error) back(id, dbMessage(error, "Não foi possível adicionar o bloco."));
  revalidatePath(builderUrl(id));
  back(id, `«${(block as Block).title}» adicionado.`);
}

export async function removeBlockAction(formData: FormData) {
  await requireStaff();
  const id = z.uuid().parse(formData.get("proposal_id"));
  const itemId = z.uuid().parse(formData.get("item_id"));
  const supabase = await createClient();
  const { data } = await supabase.from("proposal_blocks").delete().eq("id", itemId).eq("proposal_id", id).select("id");
  if (!data?.length) back(id, "Não foi possível retirar o bloco.");
  revalidatePath(builderUrl(id));
  back(id, "Bloco retirado.");
}

/** Chamada pelo arrastar e largar. Devolve um erro em vez de redirecionar. */
export async function reorderBlocksAction(proposalId: string, orderedIds: string[]) {
  await requireStaff();
  const pid = z.uuid().parse(proposalId);
  const ids = z.array(z.uuid()).max(200).parse(orderedIds);
  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_proposal_blocks", { p_id: pid, ordered: ids });
  revalidatePath(builderUrl(pid));
  return error ? { error: dbMessage(error, "Não foi possível guardar a nova ordem.") } : { ok: true };
}

export async function saveBlockValuesAction(formData: FormData) {
  await requireStaff();
  const id = z.uuid().parse(formData.get("proposal_id"));
  const itemId = z.uuid().parse(formData.get("item_id"));
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("proposal_blocks")
    .select("id, block:blocks(fields, title)")
    .eq("id", itemId)
    .eq("proposal_id", id)
    .single();
  const block = (item as unknown as { block: Pick<Block, "fields" | "title"> } | null)?.block;
  if (!block) back(id, "Bloco não encontrado.");

  const values: Record<string, FieldValue> = {};
  for (const f of block!.fields) {
    const raw = formData.get(`f_${f.key}`);
    if (f.type === "boolean") values[f.key] = raw === "on";
    else if (f.type === "number") {
      const n = Number(String(raw ?? "").replace(",", "."));
      values[f.key] = raw === null || raw === "" || !Number.isFinite(n) ? null : n;
    } else values[f.key] = String(raw ?? "").trim();
  }

  const { data, error } = await supabase.from("proposal_blocks").update({ values }).eq("id", itemId).select("id");
  if (error || !data?.length) back(id, "Não foi possível guardar. A proposta já foi enviada?");
  revalidatePath(builderUrl(id));
  back(id, `«${block!.title}» guardado.`);
}

// ---------- Proposta financeira (só admin) ----------

const optionalMoney = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number(v.replace(",", "."))))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Valor inválido");

const financialsSchema = z.object({
  proposal_id: z.uuid(),
  platforms: z.coerce.number().int().min(1, "Pelo menos 1 plataforma").max(10),
  technical_campaigns: z.coerce.number().int().min(1, "Pelo menos 1 campanha técnica").max(50),
  fee_override: optionalMoney,
  setup_fee: optionalMoney,
  notes: z.string().trim().max(1000).optional(),
});

export async function saveFinancialsAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("proposal_id") ?? "");
  const parsed = financialsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(id, parsed.error.issues[0].message);
  const d = parsed.data!;

  const supabase = await createClient();
  const { error } = await supabase.from("proposal_financials").upsert({
    proposal_id: d.proposal_id,
    platforms: d.platforms,
    technical_campaigns: d.technical_campaigns,
    monthly_fee: monthlyFee(d.platforms, d.technical_campaigns),
    fee_override: d.fee_override,
    setup_fee: d.setup_fee,
    notes: d.notes || null,
    updated_at: new Date().toISOString(),
  });
  if (error) back(id, "Não foi possível guardar a proposta financeira.");
  revalidatePath(builderUrl(id));
  back(id, "Proposta financeira guardada.");
}

// ---------- Estado ----------

export async function sendProposalAction(formData: FormData) {
  await requireStaff();
  const id = z.uuid().parse(formData.get("proposal_id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_proposal", { p_id: id });
  if (error) back(id, dbMessage(error, "Não foi possível enviar."));
  revalidatePath(builderUrl(id));
  back(id, "Proposta enviada. O cliente já a vê no portal; avise-o por email ou mensagem.");
}

export async function unsendProposalAction(formData: FormData) {
  await requireStaff();
  const id = z.uuid().parse(formData.get("proposal_id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("unsend_proposal", { p_id: id });
  if (error) back(id, dbMessage(error, "Não foi possível retirar a proposta."));
  revalidatePath(builderUrl(id));
  back(id, "A proposta voltou a rascunho e deixou de estar visível para o cliente.");
}

export async function deleteProposalAction(formData: FormData) {
  await requireStaff();
  const id = z.uuid().parse(formData.get("proposal_id"));
  const clientId = z.uuid().parse(formData.get("client_id"));
  const supabase = await createClient();
  const { data } = await supabase.from("proposals").delete().eq("id", id).select("id");
  if (!data?.length) back(id, "Só se apagam rascunhos (e o gestor não apaga propostas com parte financeira).");
  redirect(`/admin/clientes/${clientId}?msg=${encodeURIComponent("Rascunho apagado.")}`);
}

// ---------- Biblioteca de blocos ----------

const blockSchema = z.object({
  block_id: z.uuid(),
  title: z.string().trim().min(2, "Título demasiado curto"),
  body: z.string().max(5000),
  active: z.string().optional(),
});

export async function updateBlockAction(formData: FormData) {
  await requireStaff();
  const parsed = blockSchema.safeParse(Object.fromEntries(formData));
  const go = (msg: string, anchor = "") => redirect(`/admin/blocos?msg=${encodeURIComponent(msg)}${anchor}`);
  if (!parsed.success) go(parsed.error.issues[0].message);
  const d = parsed.data!;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blocks")
    .update({ title: d.title, body: d.body.trim(), active: d.active === "on", updated_at: new Date().toISOString() })
    .eq("id", d.block_id)
    .select("slug");
  if (error || !data?.length) go("Não foi possível guardar o bloco.");
  revalidatePath("/admin/blocos");
  go(`«${d.title}» guardado. As propostas já enviadas não mudam.`, `#${data![0].slug}`);
}
