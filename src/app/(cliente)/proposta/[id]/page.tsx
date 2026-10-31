import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProposalDocument } from "@/components/ProposalDocument";
import { buttonClass } from "@/components/ui";
import { loadProposal } from "@/lib/proposals";
import { acceptProposalAction } from "../../actions";

const longDate = (d: string) =>
  new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long", year: "numeric" }).format(new Date(d));

export default async function ClientProposal({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aceite?: string; erro?: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;
  const { aceite, erro } = await searchParams;
  const supabase = await createClient();

  // A RLS só devolve propostas enviadas ou aceites deste cliente.
  const data = await loadProposal(supabase, id);
  if (!data) notFound();
  const { proposal: p, items, financials, client } = data;

  const today = new Date().toISOString().slice(0, 10);
  const expired = p.status === "enviada" && p.valid_until != null && p.valid_until < today;
  const canAccept = profile.role === "cliente_admin" && p.status === "enviada" && !expired;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/inicio" className="text-[13px] font-bold text-slate-600 hover:text-navy">
        ← Início
      </Link>

      {aceite && (
        <div role="status" className="rounded-lg border-l-4 border-positive bg-white px-5 py-4">
          <p className="font-bold">Proposta aceite. Obrigado!</p>
          <p className="mt-1 text-[14px] text-slate-700">
            O próximo passo é o contrato, que lhe enviamos para assinatura eletrónica. Na página inicial já tem a lista
            do que precisamos de si para arrancar.
          </p>
        </div>
      )}

      <ProposalDocument
        title={p.title}
        clientName={client.name}
        items={items}
        financials={financials}
        validUntil={p.valid_until}
      />

      <section className="rounded-lg border border-slate-100 bg-white px-6 py-6 sm:px-12" aria-labelledby="decisao">
        <h2 id="decisao" className="text-[18px] font-semibold">
          {p.status === "aceite" ? "Proposta aceite" : "Aceitar a proposta"}
        </h2>

        {p.status === "aceite" ? (
          <p className="mt-2 text-slate-700">
            Aceite{p.accepted_at ? ` a ${longDate(p.accepted_at)}` : ""}. Se tiver dúvidas, fale connosco por email ou
            mensagem.
          </p>
        ) : expired ? (
          <p className="mt-2 text-slate-700">
            Esta proposta expirou{p.valid_until ? ` a ${longDate(p.valid_until)}` : ""}. Fale connosco para a
            atualizarmos.
          </p>
        ) : canAccept ? (
          <form action={acceptProposalAction} className="mt-3 space-y-4">
            <input type="hidden" name="proposal_id" value={p.id} />
            <label className="flex items-start gap-3 text-[15px]">
              <input type="checkbox" name="confirm" required className="mt-1 size-4 shrink-0 accent-navy" />
              <span>
                Li a proposta e aceito-a em nome de <strong>{client.name}</strong>. O contrato segue depois para
                assinatura.
              </span>
            </label>
            {erro === "confirmar" && <p className="text-[14px] text-negative">Confirme que leu a proposta.</p>}
            {erro === "indisponivel" && (
              <p className="text-[14px] text-negative">
                Não foi possível aceitar. A proposta pode ter sido atualizada ou expirado; recarregue a página ou fale
                connosco.
              </p>
            )}
            <button className={buttonClass}>Aceitar proposta</button>
          </form>
        ) : (
          <p className="mt-2 text-slate-700">
            Só a pessoa responsável pela conta pode aceitar a proposta. Se tiver dúvidas, fale connosco por email ou
            mensagem.
          </p>
        )}
      </section>
    </div>
  );
}
