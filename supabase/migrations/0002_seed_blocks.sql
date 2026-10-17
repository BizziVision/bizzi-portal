-- =====================================================================
-- Biblioteca de blocos base (a partir da proposta inHabitus, out. 2026)
-- "fields"    → campos preenchidos por cliente na proposta
-- "generates" → o que o bloco cria no fluxo (tarefas Bizzi, pedidos ao
--               cliente, perguntas do questionário, tipos de assets)
-- =====================================================================

insert into public.blocks (slug, title, section, kind, admin_only, sort_order, fields, generates) values
('capa', 'Capa', 'abertura', 'variavel', false, 10,
  '[{"key":"cliente","label":"Nome do cliente"},{"key":"mes_ano","label":"Mês e ano"},{"key":"validade_dias","label":"Validade (dias)","default":30}]',
  '{}'),

('divisor-sobre', 'Divisor · Sobre nós', 'sobre', 'fixo', false, 20, '[]', '{}'),
('sobre-bizzi', 'Sobre a Bizzi Vision', 'sobre', 'fixo', false, 30, '[]', '{}'),
('tres-pilares', 'Como trabalhamos · 3 pilares', 'sobre', 'fixo', false, 40, '[]', '{}'),
('portfolio', 'Portfólio', 'sobre', 'fixo', false, 50, '[]', '{}'),

('divisor-estrategia', 'Divisor · Estratégia', 'estrategia', 'variavel', false, 60,
  '[{"key":"cliente","label":"Nome do cliente"}]', '{}'),

('estrategia-visao-geral', 'Estratégia de Paid Media · visão geral', 'estrategia', 'variavel', false, 70,
  '[{"key":"objetivo","label":"Objetivo"},{"key":"canais","label":"Canais e papel de cada um"}]',
  '{"questionario":["Objetivo de negócio principal","Como mede hoje o sucesso comercial"]}'),

('google-search', 'Google Ads · Search', 'estrategia', 'variavel', false, 80,
  '[{"key":"invest_dia","label":"Investimento/dia (€)","type":"number"},{"key":"temas","label":"Temas de pesquisa"},{"key":"conta_nova","label":"Conta nova?","type":"boolean"},{"key":"credito_google","label":"Crédito Google Partners","type":"boolean"}]',
  '{"platform":"google_ads","tarefas":["Criar ou ligar conta Google Ads ao MCC","Estrutura de campanhas Search","Pesquisa de palavras-chave","Configurar conversões Google Ads"],
    "pedidos":[{"kind":"acesso","title":"Dar acesso à conta Google Ads (ou dados para criar conta)"},{"kind":"dado","title":"Dados de faturação para Google Ads"}],
    "questionario":["Zonas geográficas a cobrir","Produtos ou serviços prioritários","Palavras que os clientes usam para vos procurar","Principais concorrentes"],
    "assets":[{"campaign":"Google Search","types":["copy"]}]}'),

('meta-trafego-lp', 'Meta Ads · tráfego para landing page', 'estrategia', 'variavel', false, 90,
  '[{"key":"invest_dia","label":"Investimento/dia (€)","type":"number"},{"key":"angulos","label":"Ângulos de comunicação (até 3)"},{"key":"funil","label":"Funil"}]',
  '{"platform":"meta_ads","tarefas":["Rever Business Manager e utilizadores","Pixel e Conversions API","Criar públicos","Estrutura de campanhas Meta"],
    "pedidos":[{"kind":"acesso","title":"Adicionar a Bizzi Vision como parceiro no Business Manager"},{"kind":"acesso","title":"Acesso à página de Facebook e conta de Instagram"}],
    "questionario":["Perfil do cliente ideal","Principais objeções à compra","Mensagens ou ângulos a evitar"],
    "assets":[{"campaign":"Meta Ads","types":["copy","criativos"]}]}'),

('investimento-60-dias', 'Investimento · primeiros 60 dias', 'estrategia', 'calculado', false, 100,
  '[{"key":"dias","label":"Dias do período","default":60}]',
  '{"calc":"soma de invest_dia dos blocos de plataforma × dias"}'),

('medicao', 'Medição · do clique à venda', 'estrategia', 'variavel', false, 110,
  '[{"key":"etapas","label":"Etapas do funil"},{"key":"crm","label":"CRM usado"}]',
  '{"tarefas":["Plano de medição","GTM e GA4","Consent Mode v2 e CMP","Conversões offline e integração CRM"],
    "pedidos":[{"kind":"acesso","title":"Acesso ao website (CMS) ou ao Google Tag Manager"},{"kind":"acesso","title":"Acesso ao CRM ou contacto técnico"},{"kind":"dado","title":"Confirmar a CMP (banner de cookies) usada no site"}],
    "questionario":["Que CRM usam","Como é feita a qualificação de leads","Quem acompanha as leads comercialmente"]}'),

('plano-60-dias', 'Plano dos primeiros 60 dias', 'estrategia', 'fixo', false, 120, '[]', '{}'),

('divisor-financeira', 'Divisor · Proposta financeira', 'financeira', 'fixo', true, 130, '[]', '{}'),
('fee-mensal', 'Fee mensal de serviço', 'financeira', 'calculado', true, 140,
  '[]', '{"calc":"tier(campanhas técnicas) + 90 € × (plataformas − 1)"}'),
('tabela-tiers', 'Tabela de tiers', 'financeira', 'fixo', true, 150, '[]', '{}'),
('implementacoes-tecnicas', 'Implementações técnicas à parte', 'financeira', 'fixo', true, 160, '[]', '{}'),

('divisor-condicoes', 'Divisor · Condições gerais', 'condicoes', 'fixo', true, 170, '[]', '{}'),
('ambito-servico', 'Âmbito do serviço', 'condicoes', 'fixo', true, 180, '[]', '{}'),
('resumo-contrato', 'Resumo do contrato', 'condicoes', 'fixo', true, 190, '[]',
  '{"contrato":"base do template no eSignatures"}'),
('duracao-pagamentos', 'Duração, rescisão e pagamentos', 'condicoes', 'fixo', true, 200, '[]',
  '{"contrato":{"duracao_meses":6,"adaptacao_meses":3,"aviso_dias":30,"fatura_dia":1,"prazo_pagamento_dias_uteis":5}}'),

('obrigado', 'Obrigado · confidencialidade', 'fecho', 'fixo', false, 210, '[]', '{}');
