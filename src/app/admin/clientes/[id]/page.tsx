import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  Empty,
  StatusPill,
  buttonClass,
  formatDate,
  ghostButtonClass,
  inputClass,
} from "@/components/ui";
import {
  PHASE_LABEL,
  REQUEST_KIND_LABEL,
  ROLE_LABEL,
  type Client,
  type ClientRequest,
  type Profile,
} from "@/lib/types";
import {
  addClientUserAction,
  addRequestAction,
  deleteRequestAction,
  removeUserAction,
  setRequestStatusAction,
  updateClientAction,
} from "../../actions";
import { createProposalAction } from "../../propostas/actions";
import { STATUS_LABEL, STATUS_TONE, type Proposal } from "@/lib/proposals";

const REQUEST_STATUS = {
  pendente: { tone: "wait", label: "Em falta" },
  enviado: { tone: "neutral", label: "Enviado pelo cliente" },
  concluido: { tone: "ok", label: "Concluído" },
} as const;

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  const me = await requireStaff();
  const { id } = await params;
  const { msg } = await searchParams;
  const supabase = await createClient();

  const { data: client } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (!client) notFound();
  const c = client as Client;

  const [{ data: users }, { data: requests }, { data: proposals }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role, client_id").eq("client_id", id).order("email"),
    supabase.from("client_requests").select("*").eq("client_id", id).order("created_at", { ascending: false }),
    supabase
      .from("proposals")
      .select("id, title, status, sent_at, accepted_at, created_at")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const isAdmin = me.role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <p className="bv-eyebrow">Cliente · {PHASE_LABEL[c.phase]}</p>
        <h1 className="mt-1 text-[26px] font-semibold">{c.name}</h1>
      </div>

      {msg && (
        <p role="status" className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm">
          {msg}
        </p>
      )}

      <Card title="Propostas">
        {!proposals || proposals.length === 0 ? (
          <Empty>Ainda não há propostas para este cliente.</Empty>
        ) : (
          <ul className="divide-y divide-slate-50">
            {(proposals as Proposal[]).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <Link href={`/admin/propostas/${p.id}`} className="min-w-0 flex-1 truncate font-bold hover:underline">
                  {p.title}
                </Link>
                <span className="text-[13px] text-slate-500">
                  {p.accepted_at
                    ? `aceite a ${formatDate(p.accepted_at)}`
                    : p.sent_at
                      ? `enviada a ${formatDate(p.sent_at)}`
                      : `criada a ${formatDate(p.created_at)}`}
                </span>
                <StatusPill tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</StatusPill>
              </li>
            ))}
          </ul>
        )}
        <form action={createProposalAction} className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
          <input type="hidden" name="client_id" value={c.id} />
          <input
            name="title"
            required
            defaultValue={`Proposta de Paid Media · ${c.name}`}
            className={`${inputClass} min-w-0 flex-1`}
            aria-label="Título da nova proposta"
          />
          <button className={buttonClass}>Nova proposta</button>
        </form>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Pendentes do cliente */}
        <Card title="Pedidos ao cliente">
          {!requests || requests.length === 0 ? (
            <Empty>Sem pedidos. Os pedidos aparecem na página inicial do cliente.</Empty>
          ) : (
            <ul className="divide-y divide-slate-50">
              {(requests as ClientRequest[]).map((r) => {
                const st = REQUEST_STATUS[r.status];
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{r.title}</p>
                      <p className="text-[13px] text-slate-500">
                        {REQUEST_KIND_LABEL[r.kind]}
                        {r.due_date && ` · até ${formatDate(r.due_date)}`}
                      </p>
                    </div>
                    <StatusPill tone={st.tone}>{st.label}</StatusPill>
                    <form action={setRequestStatusAction}>
                      <input type="hidden" name="client_id" value={c.id} />
                      <input type="hidden" name="request_id" value={r.id} />
                      <input type="hidden" name="status" value={r.status === "concluido" ? "pendente" : "concluido"} />
                      <button className={ghostButtonClass}>{r.status === "concluido" ? "Reabrir" : "Concluir"}</button>
                    </form>
                    <form action={deleteRequestAction}>
                      <input type="hidden" name="client_id" value={c.id} />
                      <input type="hidden" name="request_id" value={r.id} />
                      <button className="text-[13px] text-slate-500 hover:text-negative">Apagar</button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}

          <form action={addRequestAction} className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-[1fr_150px]">
            <input type="hidden" name="client_id" value={c.id} />
            <input name="title" required className={inputClass} placeholder="Novo pedido, ex.: Dar acesso ao Google Ads" />
            <select name="kind" className={inputClass} defaultValue="acesso">
              {Object.entries(REQUEST_KIND_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <input name="description" className={inputClass} placeholder="Instruções (opcional)" />
            <input name="due_date" type="date" className={inputClass} aria-label="Prazo" />
            <div className="sm:col-span-2">
              <button className={buttonClass}>Adicionar pedido</button>
            </div>
          </form>
        </Card>

        <div className="space-y-6">
          {/* Dados do cliente */}
          <Card title="Dados e fase">
            <form action={updateClientAction} className="space-y-3">
              <input type="hidden" name="client_id" value={c.id} />
              <label className="block space-y-1">
                <span className="text-[13px] font-bold text-slate-700">Fase</span>
                <select name="phase" defaultValue={c.phase} className={inputClass}>
                  {Object.entries(PHASE_LABEL).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[13px] font-bold text-slate-700">Website</span>
                <input name="website" defaultValue={c.website ?? ""} className={inputClass} />
              </label>
              <label className="block space-y-1">
                <span className="text-[13px] font-bold text-slate-700">Link de incorporação do Looker Studio</span>
                <input
                  name="looker_url"
                  defaultValue={c.looker_url ?? ""}
                  className={inputClass}
                  placeholder="https://lookerstudio.google.com/embed/reporting/…"
                />
              </label>
              {c.offboarded_at && (
                <p className="text-[13px] text-slate-500">Offboarding desde {formatDate(c.offboarded_at)}.</p>
              )}
              <button className={buttonClass}>Guardar</button>
            </form>
          </Card>

          {/* Acessos */}
          <Card title="Acessos ao portal">
            {!users || users.length === 0 ? (
              <Empty>Ninguém deste cliente tem acesso ainda.</Empty>
            ) : (
              <ul className="divide-y divide-slate-50">
                {(users as Profile[]).map((u) => (
                  <li key={u.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{u.full_name || u.email}</p>
                      <p className="truncate text-[13px] text-slate-500">
                        {u.full_name ? `${u.email} · ` : ""}
                        {ROLE_LABEL[u.role]}
                      </p>
                    </div>
                    {isAdmin && (
                      <form action={removeUserAction}>
                        <input type="hidden" name="client_id" value={c.id} />
                        <input type="hidden" name="user_id" value={u.id} />
                        <button className="text-[13px] text-slate-500 hover:text-negative">Remover</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {isAdmin ? (
              <form action={addClientUserAction} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                <input type="hidden" name="client_id" value={c.id} />
                <input name="email" type="email" required className={inputClass} placeholder="email@cliente.pt" />
                <input name="full_name" className={inputClass} placeholder="Nome (opcional)" />
                <select name="role" defaultValue="cliente_admin" className={inputClass}>
                  <option value="cliente_admin">Cliente · admin (aprova e envia)</option>
                  <option value="cliente_leitor">Cliente · leitura</option>
                </select>
                <button className={buttonClass}>Aprovar email</button>
              </form>
            ) : (
              <p className="mt-3 text-[13px] text-slate-500">Só o Admin aprova emails.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
