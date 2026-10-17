# Portal de Clientes · Bizzi Vision

Portal em `portal.bizzi.vision`: Next.js (Vercel) + Supabase (UE, Frankfurt).

## O que já existe (Fase 1 · base)

- Login por **email pré-aprovado + código** (sem passwords, sem registo aberto).
- Papéis: `admin`, `gestor`, `cliente_admin`, `cliente_leitor`, com permissões na base de dados (RLS).
- **Backoffice** (`/admin`): lista de clientes, criar cliente (admin), fase e link do Looker Studio,
  aprovar e remover emails (admin), pedidos ao cliente, alertas de retenção (admin).
- **Portal do cliente** (`/inicio`): fases, "O que precisamos de si", resultados do mês,
  tarefas em curso, último report. `/resultados` mostra o Looker Studio incorporado.
- Base de dados com propostas, blocos (21 blocos base), proposta financeira, contratos,
  KPIs, tarefas visíveis, reports e auditoria.

## Configuração (uma vez)

### 1. Supabase
1. Criar projeto em supabase.com, região **Central EU (Frankfurt)**.
2. **SQL Editor** → correr, por ordem:
   `supabase/migrations/0001_base.sql` e `supabase/migrations/0002_seed_blocks.sql`.
3. **Authentication → Sign In / Providers**:
   - Email: ativo. **Desligar "Allow new users to sign up"** (só entra quem o admin aprova).
   - Email OTP length: 6. OTP expiry: 600 segundos.
4. **Authentication → Email Templates → Magic Link**: trocar o corpo para mostrar o código:
   ```html
   <h2>O seu código de acesso</h2>
   <p>Use este código para entrar no Portal Bizzi Vision:</p>
   <p style="font-size:28px;letter-spacing:6px"><strong>{{ .Token }}</strong></p>
   <p>Válido durante 10 minutos. Se não pediu este código, ignore este email.</p>
   ```
5. **Authentication → URL Configuration**: Site URL = `https://portal.bizzi.vision`.
6. **Criar o primeiro admin** (o Bruno):
   - Authentication → Users → Add user → email `bruno.barbosa@bizzi.vision`, "Auto confirm".
   - SQL Editor:
     ```sql
     insert into public.profiles (id, email, full_name, role)
     select id, email, 'Bruno Barbosa', 'admin' from auth.users
     where email = 'bruno.barbosa@bizzi.vision';
     ```
7. Mais tarde: Authentication → SMTP → ligar o Resend, para os emails saírem de `portal@bizzi.vision`
   (o SMTP de teste do Supabase só envia poucos emails por hora).

### 2. Vercel
1. Importar o repositório do GitHub (Pro, região das funções: Frankfurt `fra1`).
2. Environment Variables (ver `.env.example`):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Settings → Domains → `portal.bizzi.vision`.

### 3. Cloudflare (DNS de bizzi.vision)
- Registo **CNAME** `portal` → valor indicado pela Vercel, com **nuvem cinzenta (DNS only)**.

## Desenvolvimento local
```bash
cp .env.example .env.local   # preencher
npm install
npm run dev
```

## Make (escritas automáticas)
O Make escreve com a service role (ignora RLS) nas tabelas `client_kpis` (todos os dias às 7h),
`visible_tasks` (ClickUp, só tarefas com "Visível ao cliente") e `client_requests`.
Nunca colocar a service role em nada que corra no browser.

## Segurança: regras-chave
- Gestor nunca lê `proposal_financials`, `contracts` nem blocos `admin_only`.
- Cliente só lê o seu cliente; nunca vê rascunhos; `cliente_leitor` não vê financeira.
- Aceitar proposta e marcar pendentes passam por funções na base de dados que validam o papel.
- Retenção: 6 meses após offboarding o admin recebe um alerta; **nada é apagado automaticamente**.
