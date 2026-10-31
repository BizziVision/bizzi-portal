-- =====================================================================
-- Bizzi Vision · Portal de Clientes · Migração 0003 (propostas)
-- Correr depois da 0001 e da 0002, no SQL Editor do Supabase.
--
-- O que acrescenta:
--   · texto base de cada bloco, editável na biblioteca;
--   · "fotografia" dos blocos no momento do envio, para a proposta
--     que o cliente vê não mudar se a biblioteca for editada depois;
--   · propostas enviadas ficam bloqueadas (voltar a rascunho para editar);
--   · funções para adicionar, reordenar, enviar e aceitar propostas;
--   · ao aceitar, os pedidos ao cliente definidos nos blocos são criados.
-- =====================================================================

-- ---------- Texto base dos blocos ----------
alter table public.blocks add column if not exists body text not null default '';

-- Fotografia {title, body} tirada no envio.
alter table public.proposal_blocks add column if not exists snapshot jsonb;

-- Posições únicas verificadas só no fim da transação, para poder reordenar.
alter table public.proposal_blocks drop constraint if exists proposal_blocks_proposal_id_position_key;
alter table public.proposal_blocks
  add constraint proposal_blocks_proposal_id_position_key
  unique (proposal_id, position) deferrable initially deferred;

-- ---------- Só se edita o que está em rascunho ----------
create or replace function public.proposal_is_draft(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.proposals where id = p_id and status = 'rascunho')
$$;

drop policy if exists proposal_blocks_write on public.proposal_blocks;
create policy proposal_blocks_write on public.proposal_blocks for all to authenticated
  using (public.can_write_block(block_id) and public.proposal_is_draft(proposal_id))
  with check (public.can_write_block(block_id) and public.proposal_is_draft(proposal_id));

drop policy if exists financials_write on public.proposal_financials;
create policy financials_write on public.proposal_financials for all to authenticated
  using (public.is_admin() and public.proposal_is_draft(proposal_id))
  with check (public.is_admin() and public.proposal_is_draft(proposal_id));

-- A equipa altera o estado só através das funções abaixo; o resto dos
-- campos (título, validade) só em rascunho. Propostas só se apagam em rascunho.
drop policy if exists proposals_write on public.proposals;
create policy proposals_insert on public.proposals for insert to authenticated
  with check (public.is_staff() and status = 'rascunho');
create policy proposals_update on public.proposals for update to authenticated
  using (public.is_staff() and status = 'rascunho')
  with check (public.is_staff() and status = 'rascunho');
-- Tem de ser security definer: dentro de uma política, a RLS esconderia
-- precisamente os blocos que se quer detetar.
create or replace function public.proposal_has_hidden_blocks(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.proposal_blocks pb join public.blocks b on b.id = pb.block_id
     where pb.proposal_id = p_id and not public.can_see_block_content(b.admin_only)
  )
$$;

-- O gestor não apaga propostas com blocos que não vê.
create policy proposals_delete on public.proposals for delete to authenticated
  using (public.is_staff() and status = 'rascunho' and not public.proposal_has_hidden_blocks(id));

-- ---------- Adicionar um bloco no sítio certo ----------
-- Entra depois do último bloco da proposta com ordem-base menor ou igual,
-- e os seguintes descem uma posição.
create or replace function public.add_proposal_block(p_id uuid, b_id uuid, v jsonb default '{}'::jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_sort int;
  v_pos  int;
  v_id   uuid;
begin
  if not public.is_staff() then raise exception 'Sem permissão'; end if;
  if not public.proposal_is_draft(p_id) then raise exception 'A proposta já foi enviada'; end if;
  select sort_order into v_sort from public.blocks
   where id = b_id and active and public.can_see_block_content(admin_only);
  if v_sort is null then raise exception 'Bloco indisponível'; end if;

  select coalesce(max(pb.position) + 1, 0) into v_pos
    from public.proposal_blocks pb join public.blocks b on b.id = pb.block_id
   where pb.proposal_id = p_id and b.sort_order <= v_sort;
  if v_pos = 0 then v_pos := 1; end if;

  update public.proposal_blocks set position = position + 1
   where proposal_id = p_id and position >= v_pos;
  insert into public.proposal_blocks (proposal_id, block_id, position, "values")
  values (p_id, b_id, v_pos, coalesce(v, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end $$;

-- ---------- Reordenar ----------
-- Recebe a nova ordem dos blocos que quem chama vê. Os blocos que não vê
-- (o gestor e os blocos "só admin") ficam exatamente onde estavam.
create or replace function public.reorder_proposal_blocks(p_id uuid, ordered uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ids   uuid[];
  v_slots int[];
  i       int;
begin
  if not public.is_staff() then raise exception 'Sem permissão'; end if;
  if not public.proposal_is_draft(p_id) then raise exception 'A proposta já foi enviada'; end if;

  select array_agg(pb.id order by pb.position), array_agg(pb.position order by pb.position)
    into v_ids, v_slots
    from public.proposal_blocks pb join public.blocks b on b.id = pb.block_id
   where pb.proposal_id = p_id and public.can_see_block_content(b.admin_only);

  if v_ids is null then return; end if;
  if (select array_agg(x order by x) from unnest(ordered) x)
     is distinct from (select array_agg(x order by x) from unnest(v_ids) x) then
    raise exception 'Lista de blocos desatualizada. Recarregue a página.';
  end if;

  for i in 1 .. array_length(ordered, 1) loop
    update public.proposal_blocks set position = v_slots[i]
     where id = ordered[i] and proposal_id = p_id;
  end loop;
end $$;

-- ---------- Enviar ao cliente ----------
-- Só o admin envia propostas com blocos "só admin" (financeira e condições),
-- porque o gestor não vê os valores que estaria a comprometer.
create or replace function public.send_proposal(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_client uuid;
  v_has_admin_blocks boolean;
  v_has_fee_block boolean;
begin
  if not public.is_staff() then raise exception 'Sem permissão'; end if;
  select client_id into v_client from public.proposals where id = p_id and status = 'rascunho';
  if v_client is null then raise exception 'Só se envia uma proposta em rascunho'; end if;
  if not exists (select 1 from public.proposal_blocks where proposal_id = p_id) then
    raise exception 'A proposta não tem blocos';
  end if;

  select bool_or(b.admin_only), bool_or(b.slug = 'fee-mensal')
    into v_has_admin_blocks, v_has_fee_block
    from public.proposal_blocks pb join public.blocks b on b.id = pb.block_id
   where pb.proposal_id = p_id;

  if v_has_admin_blocks and not public.is_admin() then
    raise exception 'Esta proposta tem a parte financeira: só o Admin a pode enviar';
  end if;
  if v_has_fee_block and not exists (
    select 1 from public.proposal_financials
     where proposal_id = p_id and coalesce(fee_override, monthly_fee) is not null
  ) then
    raise exception 'Falta definir o fee mensal na proposta financeira';
  end if;

  update public.proposal_blocks pb
     set snapshot = jsonb_build_object('title', b.title, 'body', b.body)
    from public.blocks b
   where b.id = pb.block_id and pb.proposal_id = p_id;

  update public.proposals
     set status = 'enviada', sent_at = now(),
         valid_until = coalesce(valid_until, current_date + 30)
   where id = p_id;

  insert into public.audit_log (actor_id, client_id, action, entity, entity_id)
  values (auth.uid(), v_client, 'proposta_enviada', 'proposal', p_id::text);
end $$;

-- ---------- Voltar a rascunho (antes de o cliente aceitar) ----------
create or replace function public.unsend_proposal(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_client uuid;
begin
  if not public.is_staff() then raise exception 'Sem permissão'; end if;
  select client_id into v_client from public.proposals where id = p_id and status = 'enviada';
  if v_client is null then raise exception 'Só uma proposta enviada e ainda não aceite volta a rascunho'; end if;
  if not public.is_admin() and exists (
    select 1 from public.proposal_blocks pb join public.blocks b on b.id = pb.block_id
     where pb.proposal_id = p_id and b.admin_only
  ) then
    raise exception 'Esta proposta tem a parte financeira: só o Admin a pode alterar';
  end if;

  update public.proposal_blocks set snapshot = null where proposal_id = p_id;
  update public.proposals set status = 'rascunho', sent_at = null where id = p_id;
  insert into public.audit_log (actor_id, client_id, action, entity, entity_id)
  values (auth.uid(), v_client, 'proposta_retirada', 'proposal', p_id::text);
end $$;

-- ---------- Aceitar (substitui a versão da 0001) ----------
-- Além de aceitar e passar o cliente a onboarding, cria os pedidos ao
-- cliente definidos nos blocos da proposta (sem duplicar pedidos abertos).
create or replace function public.accept_proposal(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_client uuid;
begin
  select client_id into v_client from public.proposals
   where id = p_id and status = 'enviada'
     and (valid_until is null or valid_until >= current_date);
  if v_client is null then
    raise exception 'Proposta indisponível para aceitação';
  end if;
  if not public.is_client_admin_of(v_client) then
    raise exception 'Sem permissão';
  end if;

  update public.proposals
     set status = 'aceite', accepted_at = now(), accepted_by = auth.uid()
   where id = p_id;
  update public.clients set phase = 'onboarding'
   where id = v_client and phase = 'proposta';

  insert into public.client_requests (client_id, kind, title, source_block_id)
  select distinct on (r->>'title') v_client, (r->>'kind')::public.request_kind, r->>'title', b.id
    from public.proposal_blocks pb
    join public.blocks b on b.id = pb.block_id
    cross join lateral jsonb_array_elements(coalesce(b.generates->'pedidos', '[]'::jsonb)) r
   where pb.proposal_id = p_id
     and not exists (
       select 1 from public.client_requests cr
        where cr.client_id = v_client and cr.title = r->>'title' and cr.status <> 'concluido'
     )
   order by r->>'title', pb.position;

  insert into public.audit_log (actor_id, client_id, action, entity, entity_id)
  values (auth.uid(), v_client, 'proposta_aceite', 'proposal', p_id::text);
end $$;

revoke all on function public.proposal_has_hidden_blocks(uuid) from public, anon;
grant execute on function public.proposal_has_hidden_blocks(uuid) to authenticated;
revoke all on function public.proposal_is_draft(uuid), public.add_proposal_block(uuid, uuid, jsonb),
  public.reorder_proposal_blocks(uuid, uuid[]), public.send_proposal(uuid),
  public.unsend_proposal(uuid), public.accept_proposal(uuid) from public, anon;
grant execute on function public.proposal_is_draft(uuid), public.add_proposal_block(uuid, uuid, jsonb),
  public.reorder_proposal_blocks(uuid, uuid[]), public.send_proposal(uuid),
  public.unsend_proposal(uuid), public.accept_proposal(uuid) to authenticated;

-- ---------- Texto base de alguns blocos ----------
-- Só os blocos cujo conteúdo é conhecido sem os slides originais. Os
-- restantes preenchem-se em Backoffice → Biblioteca de blocos.
-- {{campo}} é substituído pelo valor desse campo na proposta.
update public.blocks set body = 'Proposta de Paid Media para {{cliente}} · {{mes_ano}}.'
 where slug = 'capa' and body = '';
update public.blocks set body = 'Investimento em media estimado para o arranque, a partir do investimento diário de cada canal desta proposta. Valores pagos diretamente às plataformas, sem IVA.'
 where slug = 'investimento-60-dias' and body = '';
update public.blocks set body = 'Fee mensal de gestão, calculado pelo número de campanhas técnicas e de plataformas. Valores sem IVA e sem investimento em media.'
 where slug = 'fee-mensal' and body = '';
update public.blocks set body = 'Fee mensal para uma plataforma, por número de campanhas técnicas. Cada plataforma adicional acrescenta 90 €/mês.'
 where slug = 'tabela-tiers' and body = '';
