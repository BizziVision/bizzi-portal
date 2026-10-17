-- =====================================================================
-- Bizzi Vision · Portal de Clientes · Migração 0001 (base)
-- Correr uma vez no SQL Editor do Supabase (projeto na região UE).
--
-- Regras de acesso (resumo):
--   admin           → tudo
--   gestor          → tudo menos proposta financeira, contratos,
--                     blocos "só admin" e renovação
--   cliente_admin   → só o seu cliente; vê financeira e contrato próprios;
--                     aceita propostas e conclui pendentes
--   cliente_leitor  → só o seu cliente; só leitura; sem financeira
--
-- Escritas sensíveis (criar utilizadores, mudar papéis) passam sempre
-- pelo servidor com a service role, nunca pelo browser.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- Tipos ----------
create type public.user_role as enum ('admin', 'gestor', 'cliente_admin', 'cliente_leitor');
create type public.client_phase as enum ('proposta', 'onboarding', 'setup', 'ativo', 'offboarding', 'arquivado');
create type public.block_section as enum ('abertura', 'sobre', 'estrategia', 'financeira', 'condicoes', 'fecho');
create type public.block_kind as enum ('fixo', 'variavel', 'calculado');
create type public.proposal_status as enum ('rascunho', 'enviada', 'aceite', 'recusada');
create type public.request_kind as enum ('dado', 'acesso', 'asset', 'aprovacao', 'questionario');
create type public.request_status as enum ('pendente', 'enviado', 'concluido');
create type public.report_status as enum ('rascunho', 'publicado');
create type public.contract_status as enum ('rascunho', 'enviado', 'visto', 'assinado', 'recusado');

-- ---------- Clientes ----------
create table public.clients (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  legal_name       text,
  nif              text,
  website          text,
  phase            public.client_phase not null default 'proposta',
  drive_folder_id  text,
  clickup_list_id  text,
  looker_url       text,           -- URL de incorporação do Looker Studio
  offboarded_at    timestamptz,    -- início da contagem dos 6 meses
  created_at       timestamptz not null default now()
);

-- ---------- Perfis (1:1 com auth.users) ----------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null unique,
  full_name   text,
  role        public.user_role not null,
  client_id   uuid references public.clients (id) on delete cascade,
  created_at  timestamptz not null default now(),
  -- equipa Bizzi não pertence a um cliente; utilizadores de cliente pertencem sempre
  constraint profile_client_matches_role check (
    (role in ('admin', 'gestor') and client_id is null) or
    (role in ('cliente_admin', 'cliente_leitor') and client_id is not null)
  )
);

-- ---------- Funções auxiliares para RLS ----------
-- security definer + search_path fixo: leem o perfil sem recursão de políticas.
create or replace function public.auth_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.auth_client_id() returns uuid
language sql stable security definer set search_path = public as $$
  select client_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role() = 'admin', false)
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role() in ('admin', 'gestor'), false)
$$;

create or replace function public.is_client_admin_of(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role() = 'cliente_admin' and public.auth_client_id() = cid, false)
$$;

-- ---------- Biblioteca de blocos ----------
create table public.blocks (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null,
  section     public.block_section not null,
  kind        public.block_kind not null,
  admin_only  boolean not null default false,  -- escondido do gestor
  sort_order  int not null default 0,
  fields      jsonb not null default '[]'::jsonb,  -- campos preenchidos por cliente
  generates   jsonb not null default '{}'::jsonb,  -- tarefas, pedidos, questionário, assets
  active      boolean not null default true,
  updated_at  timestamptz not null default now()
);

-- ---------- Propostas ----------
create table public.proposals (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete cascade,
  title        text not null,
  status       public.proposal_status not null default 'rascunho',
  valid_until  date,
  sent_at      timestamptz,
  accepted_at  timestamptz,
  accepted_by  uuid references public.profiles (id),
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now()
);

create table public.proposal_blocks (
  id           uuid primary key default gen_random_uuid(),
  proposal_id  uuid not null references public.proposals (id) on delete cascade,
  block_id     uuid not null references public.blocks (id),
  position     int not null,
  "values"     jsonb not null default '{}'::jsonb,
  unique (proposal_id, position)
);

-- Proposta financeira: tabela à parte para o gestor nunca a ler.
create table public.proposal_financials (
  proposal_id          uuid primary key references public.proposals (id) on delete cascade,
  platforms            int not null default 1 check (platforms >= 1),
  technical_campaigns  int not null default 1 check (technical_campaigns >= 1),
  monthly_fee          numeric(10,2),       -- calculado pela tabela de tiers
  fee_override         numeric(10,2),       -- ajuste manual do admin
  setup_fee            numeric(10,2),
  notes                text,
  updated_at           timestamptz not null default now()
);

-- ---------- Contratos (eSignatures) ----------
create table public.contracts (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients (id) on delete cascade,
  proposal_id        uuid references public.proposals (id),
  esign_contract_id  text unique,
  status             public.contract_status not null default 'rascunho',
  signed_at          timestamptz,
  drive_file_id      text,
  starts_on          date,
  created_at         timestamptz not null default now()
);

-- ---------- Pendentes do cliente ----------
create table public.client_requests (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients (id) on delete cascade,
  kind             public.request_kind not null,
  title            text not null,
  description      text,
  due_date         date,
  status           public.request_status not null default 'pendente',
  source_block_id  uuid references public.blocks (id),
  completed_at     timestamptz,
  completed_by     uuid references public.profiles (id),
  created_at       timestamptz not null default now()
);

-- ---------- Tarefas ClickUp visíveis ao cliente (sincronizadas pelo Make) ----------
create table public.visible_tasks (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients (id) on delete cascade,
  clickup_task_id  text not null unique,
  name             text not null,
  status           text not null,
  due_date         date,
  updated_at       timestamptz not null default now()
);

-- ---------- KPIs do mês (escritos diariamente às 7h pelo Make) ----------
create table public.client_kpis (
  client_id    uuid not null references public.clients (id) on delete cascade,
  month        date not null,           -- primeiro dia do mês
  spend        numeric(12,2),
  leads        int,
  cpl          numeric(10,2),
  impressions  bigint,
  clicks       bigint,
  updated_at   timestamptz not null default now(),
  primary key (client_id, month)
);

-- ---------- Reports mensais ----------
create table public.reports (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients (id) on delete cascade,
  month         date not null,
  summary       text,                    -- resumo executivo
  body          jsonb not null default '{}'::jsonb,
  status        public.report_status not null default 'rascunho',
  published_at  timestamptz,
  unique (client_id, month)
);

-- ---------- Auditoria ----------
create table public.audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid references public.profiles (id),
  client_id  uuid references public.clients (id) on delete set null,
  action     text not null,
  entity     text,
  entity_id  text,
  meta       jsonb not null default '{}'::jsonb,
  at         timestamptz not null default now()
);

create index on public.profiles (client_id);
create index on public.proposals (client_id);
create index on public.proposal_blocks (proposal_id);
create index on public.client_requests (client_id, status);
create index on public.visible_tasks (client_id);
create index on public.reports (client_id, month desc);
create index on public.audit_log (client_id, at desc);

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.clients              enable row level security;
alter table public.profiles             enable row level security;
alter table public.blocks               enable row level security;
alter table public.proposals            enable row level security;
alter table public.proposal_blocks      enable row level security;
alter table public.proposal_financials  enable row level security;
alter table public.contracts            enable row level security;
alter table public.client_requests      enable row level security;
alter table public.visible_tasks        enable row level security;
alter table public.client_kpis          enable row level security;
alter table public.reports              enable row level security;
alter table public.audit_log            enable row level security;

-- Clientes
create policy clients_select on public.clients for select to authenticated
  using (public.is_staff() or id = public.auth_client_id());
create policy clients_insert on public.clients for insert to authenticated
  with check (public.is_admin());
create policy clients_update on public.clients for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy clients_delete on public.clients for delete to authenticated
  using (public.is_admin());

-- Perfis: só leitura pelo browser. Criar/alterar é feito no servidor (service role).
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff() or client_id = public.auth_client_id());

-- Blocos e blocos-da-proposta referem-se uns aos outros; para evitar
-- recursão entre políticas, as verificações cruzadas vivem em funções
-- security definer.
create or replace function public.can_see_block_content(b_admin_only boolean) returns boolean
language sql stable security definer set search_path = public as $$
  -- equipa: gestor não vê blocos "só admin"; cliente: leitor não vê blocos "só admin"
  select case
    when public.is_admin() then true
    when public.auth_role() = 'gestor' then not b_admin_only
    when public.auth_role() = 'cliente_admin' then true
    when public.auth_role() = 'cliente_leitor' then not b_admin_only
    else false
  end
$$;

create or replace function public.client_has_block(b_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.proposal_blocks pb
    join public.proposals p on p.id = pb.proposal_id
    where pb.block_id = b_id
      and p.client_id = public.auth_client_id()
      and p.status <> 'rascunho'
  )
$$;

create or replace function public.can_read_proposal_block(p_id uuid, b_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.proposals p, public.blocks b
    where p.id = p_id and b.id = b_id
      and public.can_see_block_content(b.admin_only)
      and (public.is_staff() or (p.client_id = public.auth_client_id() and p.status <> 'rascunho'))
  )
$$;

create or replace function public.can_write_block(b_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks b
    where b.id = b_id and public.is_staff() and public.can_see_block_content(b.admin_only)
  )
$$;

-- Blocos: equipa vê a biblioteca (gestor sem os "só admin");
-- cliente vê só os blocos das suas propostas já enviadas.
create policy blocks_select on public.blocks for select to authenticated
  using (
    public.can_see_block_content(admin_only)
    and (public.is_staff() or public.client_has_block(id))
  );
create policy blocks_write on public.blocks for all to authenticated
  using (public.is_staff() and public.can_see_block_content(admin_only))
  with check (public.is_staff() and public.can_see_block_content(admin_only));

-- Propostas: clientes nunca veem rascunhos.
create policy proposals_select on public.proposals for select to authenticated
  using (public.is_staff() or (client_id = public.auth_client_id() and status <> 'rascunho'));
create policy proposals_write on public.proposals for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy proposal_blocks_select on public.proposal_blocks for select to authenticated
  using (public.can_read_proposal_block(proposal_id, block_id));
create policy proposal_blocks_write on public.proposal_blocks for all to authenticated
  using (public.can_write_block(block_id))
  with check (public.can_write_block(block_id));

-- Financeira: só admin e cliente_admin do próprio cliente (proposta já enviada).
create policy financials_select on public.proposal_financials for select to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.proposals p
      where p.id = proposal_financials.proposal_id
        and p.status <> 'rascunho'
        and public.is_client_admin_of(p.client_id)
    )
  );
create policy financials_write on public.proposal_financials for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Contratos: só admin e cliente_admin do próprio cliente.
create policy contracts_select on public.contracts for select to authenticated
  using (public.is_admin() or public.is_client_admin_of(client_id));
create policy contracts_write on public.contracts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Pendentes: cliente lê; conclui só através da função complete_request().
create policy requests_select on public.client_requests for select to authenticated
  using (public.is_staff() or client_id = public.auth_client_id());
create policy requests_write on public.client_requests for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Tarefas visíveis e KPIs: leitura para equipa e cliente; escrita pelo Make (service role).
create policy tasks_select on public.visible_tasks for select to authenticated
  using (public.is_staff() or client_id = public.auth_client_id());
create policy kpis_select on public.client_kpis for select to authenticated
  using (public.is_staff() or client_id = public.auth_client_id());

-- Reports: cliente só vê publicados.
create policy reports_select on public.reports for select to authenticated
  using (public.is_staff() or (client_id = public.auth_client_id() and status = 'publicado'));
create policy reports_write on public.reports for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Auditoria: só admin lê. Escrita só por funções e servidor.
create policy audit_select on public.audit_log for select to authenticated
  using (public.is_admin());

-- =====================================================================
-- Ações do cliente (funções controladas)
-- =====================================================================

-- Aceitar proposta: só cliente_admin, só propostas enviadas do próprio cliente.
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
  insert into public.audit_log (actor_id, client_id, action, entity, entity_id)
  values (auth.uid(), v_client, 'proposta_aceite', 'proposal', p_id::text);
end $$;

-- Marcar um pendente como enviado: só cliente_admin do próprio cliente.
-- A equipa confirma depois e passa a "concluido".
create or replace function public.complete_request(r_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_client uuid;
begin
  select client_id into v_client from public.client_requests
   where id = r_id and status = 'pendente';
  if v_client is null or not public.is_client_admin_of(v_client) then
    raise exception 'Sem permissão';
  end if;
  update public.client_requests
     set status = 'enviado', completed_at = now(), completed_by = auth.uid()
   where id = r_id;
  insert into public.audit_log (actor_id, client_id, action, entity, entity_id)
  values (auth.uid(), v_client, 'pendente_enviado', 'client_request', r_id::text);
end $$;

revoke all on function public.accept_proposal(uuid) from public, anon;
revoke all on function public.complete_request(uuid) from public, anon;
grant execute on function public.accept_proposal(uuid) to authenticated;
grant execute on function public.complete_request(uuid) to authenticated;

-- =====================================================================
-- Alertas de retenção (6 meses após offboarding) — só lista, nunca apaga.
-- =====================================================================
create or replace view public.retention_alerts with (security_invoker = true) as
  select id as client_id, name, offboarded_at,
         (offboarded_at + interval '6 months')::date as review_on
    from public.clients
   where public.is_admin()
     and offboarded_at is not null
     and offboarded_at + interval '6 months' <= now()
     and phase <> 'arquivado';

-- Funções auxiliares: só para utilizadores autenticados.
revoke all on function public.auth_role(), public.auth_client_id(), public.is_admin(),
  public.is_staff(), public.is_client_admin_of(uuid), public.can_see_block_content(boolean),
  public.client_has_block(uuid), public.can_read_proposal_block(uuid, uuid),
  public.can_write_block(uuid) from public, anon;
grant execute on function public.auth_role(), public.auth_client_id(), public.is_admin(),
  public.is_staff(), public.is_client_admin_of(uuid), public.can_see_block_content(boolean),
  public.client_has_block(uuid), public.can_read_proposal_block(uuid, uuid),
  public.can_write_block(uuid) to authenticated;
