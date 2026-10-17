"use server";

import { revalidatePath } from "next/cache";
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
