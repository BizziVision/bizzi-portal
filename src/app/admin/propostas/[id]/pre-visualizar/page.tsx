import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProposalDocument } from "@/components/ProposalDocument";
import { loadProposal } from "@/lib/proposals";

export default async function ProposalPreview({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ como?: string }>;
}) {
  const me = await requireStaff();
  const { id } = await params;
  const { como } = await searchParams;
  const supabase = await createClient();
  const data = await loadProposal(supabase, id);
  if (!data) notFound();

  // "Como leitor": o cliente só de leitura não vê os blocos só-admin nem a financeira.
  const asReader = como === "leitor";
  const items = asReader ? data.items.filter((i) => !i.block.admin_only) : data.items;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-[13px]">
        <Link href={`/admin/propostas/${id}`} className="font-bold text-slate-600 hover:text-navy">
          ← Voltar ao construtor
        </Link>
        {me.role === "admin" && (
          <span className="flex gap-3">
            <Link
              href={`/admin/propostas/${id}/pre-visualizar`}
              className={asReader ? "text-slate-500 hover:text-navy" : "font-bold text-navy"}
            >
              Como cliente admin
            </Link>
            <Link
              href={`/admin/propostas/${id}/pre-visualizar?como=leitor`}
              className={asReader ? "font-bold text-navy" : "text-slate-500 hover:text-navy"}
            >
              Como cliente leitor
            </Link>
          </span>
        )}
      </div>
      <ProposalDocument
        title={data.proposal.title}
        clientName={data.client.name}
        items={items}
        financials={asReader ? null : data.financials}
        validUntil={data.proposal.valid_until}
        staffPreview
      />
    </div>
  );
}
