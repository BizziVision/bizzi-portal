import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, buttonClass, inputClass } from "@/components/ui";
import { SECTION_LABEL, SECTION_ORDER, loadLibrary } from "@/lib/proposals";
import { updateBlockAction } from "../propostas/actions";

const KIND_LABEL = { fixo: "Fixo", variavel: "Com campos", calculado: "Calculado" } as const;

export default async function BlockLibrary({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const me = await requireStaff();
  const { msg } = await searchParams;
  const supabase = await createClient();
  const blocks = await loadLibrary(supabase);

  return (
    <div className="space-y-6">
      <div>
        <p className="bv-eyebrow">Backoffice</p>
        <h1 className="mt-1 text-[26px] font-semibold">Biblioteca de blocos</h1>
        <p className="mt-2 max-w-2xl text-[14px] text-slate-600">
          O texto-base de cada bloco vale para todas as propostas. Use {"{{campo}}"} para inserir um valor da
          proposta, por exemplo {"{{cliente}}"}. Uma proposta enviada guarda o texto que tinha no envio, por isso
          editar aqui não muda o que o cliente já recebeu.
          {me.role !== "admin" && " Os blocos da proposta financeira e das condições são geridos pelo Admin."}
        </p>
      </div>

      {msg && (
        <p role="status" className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm">
          {msg}
        </p>
      )}

      {SECTION_ORDER.map((section) => {
        const list = blocks.filter((b) => b.section === section);
        if (list.length === 0) return null;
        return (
          <Card key={section} title={SECTION_LABEL[section]}>
            <ul className="divide-y divide-slate-50">
              {list.map((b) => (
                <li key={b.id} id={b.slug} className="scroll-mt-6 py-3">
                  <details>
                    <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                      <span className="min-w-0 flex-1">
                        <span className={`block font-bold ${b.active ? "" : "text-slate-400 line-through"}`}>
                          {b.title}
                        </span>
                        <span className="block text-[12px] text-slate-500">
                          {KIND_LABEL[b.kind]}
                          {b.admin_only && " · só Admin"}
                          {b.fields.length > 0 && ` · campos: ${b.fields.map((f) => f.key).join(", ")}`}
                          {!b.body.trim() && b.kind !== "calculado" && " · sem texto"}
                        </span>
                      </span>
                      <span className="text-[13px] font-bold text-slate-600">Editar</span>
                    </summary>
                    <form action={updateBlockAction} className="mt-3 space-y-3">
                      <input type="hidden" name="block_id" value={b.id} />
                      <input name="title" defaultValue={b.title} required className={inputClass} aria-label="Título" />
                      <textarea
                        name="body"
                        rows={6}
                        defaultValue={b.body}
                        className={inputClass}
                        aria-label="Texto-base"
                        placeholder="Texto que o cliente lê neste bloco. Separe parágrafos com uma linha em branco."
                      />
                      {Boolean(b.generates.pedidos?.length || b.generates.tarefas?.length) && (
                        <p className="text-[13px] text-slate-500">
                          {b.generates.pedidos?.length
                            ? `Ao aceitar, cria ${b.generates.pedidos.length} ${b.generates.pedidos.length === 1 ? "pedido" : "pedidos"} ao cliente. `
                            : ""}
                          {b.generates.tarefas?.length ? `Tarefas previstas: ${b.generates.tarefas.join(", ")}.` : ""}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-4">
                        <button className={buttonClass}>Guardar bloco</button>
                        <label className="flex items-center gap-2 text-[14px]">
                          <input type="checkbox" name="active" defaultChecked={b.active} className="size-4 accent-navy" />
                          Ativo (entra nas propostas novas)
                        </label>
                      </div>
                    </form>
                  </details>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
