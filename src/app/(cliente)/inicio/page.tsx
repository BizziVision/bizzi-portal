import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Empty } from "@/components/ui";
import type { Client, ClientRequest } from "@/lib/types";
import { ClientHomeView } from "./ClientHomeView";

export default async function ClientHome() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  const month = monthStart.toISOString().slice(0, 10);

  // RLS garante que só chegam dados deste cliente.
  const [{ data: client }, { data: requests }, { data: kpis }, { data: tasks }, { data: report }, { data: proposal }] =
    await Promise.all([
      supabase.from("clients").select("*").single(),
      supabase.from("client_requests").select("*").neq("status", "concluido").order("due_date", { nullsFirst: false }),
      supabase.from("client_kpis").select("*").eq("month", month).maybeSingle(),
      supabase.from("visible_tasks").select("id, name, status").neq("status", "complete").order("due_date").limit(6),
      supabase.from("reports").select("month, summary").order("month", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("proposals").select("title").eq("status", "enviada").limit(1).maybeSingle(),
    ]);

  if (!client) return <Empty>Não foi possível carregar os dados. Contacte a Bizzi Vision.</Empty>;

  return (
    <ClientHomeView
      client={client as Client}
      firstName={profile.full_name?.split(" ")[0]}
      canAct={profile.role === "cliente_admin"}
      requests={(requests ?? []) as ClientRequest[]}
      kpis={kpis}
      tasks={tasks ?? []}
      report={report}
      proposalTitle={proposal?.title ?? null}
    />
  );
}
