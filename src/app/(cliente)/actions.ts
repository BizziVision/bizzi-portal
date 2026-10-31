"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** O cliente marca um pedido como enviado. A permissão é verificada na base de dados. */
export async function markRequestSentAction(formData: FormData) {
  await requireProfile();
  const id = z.uuid().parse(formData.get("request_id"));
  const supabase = await createClient();
  await supabase.rpc("complete_request", { r_id: id });
  revalidatePath("/inicio");
}

/** Aceitar a proposta: a base de dados confirma que é o cliente admin e que está dentro da validade. */
export async function acceptProposalAction(formData: FormData) {
  await requireProfile();
  const id = z.uuid().parse(formData.get("proposal_id"));
  if (formData.get("confirm") !== "on") redirect(`/proposta/${id}?erro=confirmar`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_proposal", { p_id: id });
  if (error) redirect(`/proposta/${id}?erro=indisponivel`);
  revalidatePath("/inicio");
  redirect(`/proposta/${id}?aceite=1`);
}
