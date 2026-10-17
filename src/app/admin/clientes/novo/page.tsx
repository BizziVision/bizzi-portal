import { requireAdmin } from "@/lib/auth";
import { Card, buttonClass, inputClass } from "@/components/ui";
import { createClientAction } from "../../actions";

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  await requireAdmin();
  const { msg } = await searchParams;
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <p className="bv-eyebrow">Backoffice</p>
        <h1 className="mt-1 text-[26px] font-semibold">Novo cliente</h1>
      </div>
      <Card>
        <form action={createClientAction} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-bold text-slate-700">Nome do cliente</span>
            <input name="name" required className={inputClass} placeholder="Ex.: inHabitus" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-bold text-slate-700">Website</span>
            <input name="website" className={inputClass} placeholder="https://" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-bold text-slate-700">NIF (opcional)</span>
            <input name="nif" className={inputClass} />
          </label>
          {msg && <p className="text-sm text-negative">{msg}</p>}
          <button className={buttonClass}>Criar cliente</button>
        </form>
      </Card>
    </div>
  );
}
