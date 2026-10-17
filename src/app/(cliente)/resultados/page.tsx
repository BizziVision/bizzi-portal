import { createClient } from "@/lib/supabase/server";
import { Card, Empty } from "@/components/ui";

export default async function ResultsPage() {
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("looker_url").single();
  const url = client?.looker_url;
  const safe = url && url.startsWith("https://lookerstudio.google.com/");

  return (
    <div className="space-y-6">
      <div>
        <p className="bv-eyebrow">Dashboard</p>
        <h1 className="mt-1 text-[26px] font-semibold">Resultados</h1>
        <p className="mt-1 text-slate-700">Dados atualizados todos os dias às 7h.</p>
      </div>
      {safe ? (
        <div className="overflow-hidden rounded-lg border border-slate-100 bg-white">
          <iframe
            src={url}
            title="Dashboard de resultados"
            className="block h-[78vh] min-h-[560px] w-full"
            sandbox="allow-scripts allow-same-origin allow-popups"
            referrerPolicy="no-referrer"
          />
        </div>
      ) : (
        <Card>
          <Empty>O dashboard fica disponível aqui quando as campanhas estiverem ativas.</Empty>
        </Card>
      )}
    </div>
  );
}
