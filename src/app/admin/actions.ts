"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const back = (clientId: string, msg: string) =>
  redirect(`/admin/clientes/${clientId}?msg=${encodeURIComponent(msg)}`);

async function audit(actorId: string, clientId: string | null, action: string, meta = {}) {
  const admin = createAdminClient();
  await admin.from("audit_log").insert({ actor_id: actorId, client_id: clientId, action, meta });
}

// ---------- Clientes ----------

const newClientSchema = z.object({
  name: z.string().trim().min(2, "Nome demasiado curto"),
  website: z.string().trim().optional(),
  nif: z.string().trim().optional(),
});

export async function createClientAction(formData: FormData) {
  const me = await requireAdmin();
  const parsed = newClientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/admin/clientes/novo?msg=${encodeURIComponent(parsed.error.issues[0].message)}`);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({ name: parsed.data.name, website: parsed.data.website || null, nif: parsed.data.nif || null })
    .select("id")
    .single();
  if (error || !data) redirect(`/admin/clientes/novo?msg=${encodeURIComponent("Não foi possível criar o cliente.")}`);

  await audit(me.id, data.id, "cliente_criado", { name: parsed.data.name });
  redirect(`/admin/clientes/${data.id}?msg=${encodeURIComponent("Cliente criado.")}`);
}

const updateClientSchema = z.object({
  client_id: z.uuid(),
  phase: z.enum(["proposta", "onboarding", "setup", "ativo", "offboarding", "arquivado"]),
  website: z.string().trim().optional(),
  looker_url: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || v.startsWith("https://lookerstudio.google.com/"), "O link tem de ser do Looker Studio"),
});

export async function updateClientAction(formData: FormData) {
  const me = await requireStaff();
  const parsed = updateClientSchema.safeParse(Object.fromEntries(formData));
  const clientId = String(formData.get("client_id") ?? "");
  if (!parsed.success) back(clientId, parsed.error!.issues[0].message);

  const { client_id, phase, website, looker_url } = parsed.data!;
  const supabase = await createClient();
  const { data: before } = await supabase.from("clients").select("phase, offboarded_at").eq("id", client_id).single();

  const patch: Record<string, unknown> = {
    phase,
    website: website || null,
    looker_url: looker_url || null,
  };
  // Começa a contagem dos 6 meses de retenção quando entra em offboarding.
  if (phase === "offboarding" && !before?.offboarded_at) patch.offboarded_at = new Date().toISOString();

  const { error } = await supabase.from("clients").update(patch).eq("id", client_id);
  if (error) back(client_id, "Não foi possível guardar.");

  if (before?.phase !== phase) await audit(me.id, client_id, "fase_alterada", { de: before?.phase, para: phase });
  revalidatePath(`/admin/clientes/${client_id}`);
  back(client_id, "Alterações guardadas.");
}

// ---------- Utilizadores (só admin) ----------

const addUserSchema = z.object({
  client_id: z.uuid(),
  email: z.email("Email inválido").transform((v) => v.trim().toLowerCase()),
  full_name: z.string().trim().optional(),
  role: z.enum(["cliente_admin", "cliente_leitor"]),
});

export async function addClientUserAction(formData: FormData) {
  const me = await requireAdmin();
  const clientId = String(formData.get("client_id") ?? "");
  const parsed = addUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(clientId, parsed.error.issues[0].message);
  const { email, full_name, role, client_id } = parsed.data!;

  const admin = createAdminClient();
  const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) back(client_id, "Este email já tem acesso ao portal.");

  const { data: created, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error || !created.user) back(client_id, "Não foi possível aprovar o email.");

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user!.id,
    email,
    full_name: full_name || null,
    role,
    client_id,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user!.id);
    back(client_id, "Não foi possível criar o perfil.");
  }

  await audit(me.id, client_id, "utilizador_aprovado", { email, role });
  revalidatePath(`/admin/clientes/${client_id}`);
  back(client_id, `${email} aprovado. Já pode entrar em portal.bizzi.vision com código.`);
}

export async function removeUserAction(formData: FormData) {
  const me = await requireAdmin();
  const clientId = String(formData.get("client_id") ?? "");
  const userId = z.uuid().parse(formData.get("user_id"));
  if (userId === me.id) back(clientId, "Não pode remover o seu próprio acesso.");

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("email, client_id").eq("id", userId).single();
  if (!target || target.client_id !== clientId) back(clientId, "Utilizador não encontrado.");

  await admin.auth.admin.deleteUser(userId); // apaga o perfil em cascata e termina sessões
  await audit(me.id, clientId, "acesso_removido", { email: target!.email });
  revalidatePath(`/admin/clientes/${clientId}`);
  back(clientId, `Acesso de ${target!.email} removido.`);
}

// ---------- Pendentes do cliente ----------

const requestSchema = z.object({
  client_id: z.uuid(),
  kind: z.enum(["dado", "acesso", "asset", "aprovacao", "questionario"]),
  title: z.string().trim().min(3, "Descreva o pedido"),
  description: z.string().trim().optional(),
  due_date: z.string().optional(),
});

export async function addRequestAction(formData: FormData) {
  const me = await requireStaff();
  const clientId = String(formData.get("client_id") ?? "");
  const parsed = requestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(clientId, parsed.error.issues[0].message);
  const d = parsed.data!;

  const supabase = await createClient();
  const { error } = await supabase.from("client_requests").insert({
    client_id: d.client_id,
    kind: d.kind,
    title: d.title,
    description: d.description || null,
    due_date: d.due_date || null,
  });
  if (error) back(d.client_id, "Não foi possível criar o pedido.");
  await audit(me.id, d.client_id, "pendente_criado", { title: d.title });
  revalidatePath(`/admin/clientes/${d.client_id}`);
  back(d.client_id, "Pedido criado. O cliente vê-o na página inicial.");
}

export async function setRequestStatusAction(formData: FormData) {
  await requireStaff();
  const clientId = String(formData.get("client_id") ?? "");
  const id = z.uuid().parse(formData.get("request_id"));
  const status = z.enum(["pendente", "concluido"]).parse(formData.get("status"));

  const supabase = await createClient();
  await supabase
    .from("client_requests")
    .update({ status, completed_at: status === "concluido" ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("client_id", clientId);
  revalidatePath(`/admin/clientes/${clientId}`);
  back(clientId, status === "concluido" ? "Pedido concluído." : "Pedido reaberto.");
}

export async function deleteRequestAction(formData: FormData) {
  await requireStaff();
  const clientId = String(formData.get("client_id") ?? "");
  const id = z.uuid().parse(formData.get("request_id"));
  const supabase = await createClient();
  await supabase.from("client_requests").delete().eq("id", id).eq("client_id", clientId);
  revalidatePath(`/admin/clientes/${clientId}`);
  back(clientId, "Pedido apagado.");
}
